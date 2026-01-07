/**
 * Batch Database Writer
 *
 * Batches database writes for performance
 */

import type Database from 'better-sqlite3';
import type { ProcessedData, BatchWriteResult, BatchWriterConfig } from './types';
import {
  NodeRepository,
  PositionRepository,
  TelemetryRepository,
  MessageRepository
} from '@/lib/db/db';

export class BatchWriter {
  private db: Database.Database;
  private config: BatchWriterConfig;
  private buffer: ProcessedData[] = [];
  private flushTimeout: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  // Repositories
  private nodeRepo: NodeRepository;
  private posRepo: PositionRepository;
  private telRepo: TelemetryRepository;
  private msgRepo: MessageRepository;

  // Statistics
  private stats = {
    totalProcessed: 0,
    totalFailed: 0,
    batchesWritten: 0,
    lastBatchSize: 0,
    lastBatchTime: 0,
    avgBatchSize: 0,
    avgBatchTime: 0
  };

  constructor(db: Database.Database, config: Partial<BatchWriterConfig> = {}) {
    this.db = db;
    this.config = {
      maxBatchSize: config.maxBatchSize || 100,
      maxWaitMs: config.maxWaitMs || 500
    };

    // Initialize repositories
    this.nodeRepo = new NodeRepository(db);
    this.posRepo = new PositionRepository(db);
    this.telRepo = new TelemetryRepository(db);
    this.msgRepo = new MessageRepository(db);

    // Start periodic flush
    this.startPeriodicFlush();
  }

  /**
   * Add data to buffer
   */
  add(data: ProcessedData): void {
    if (this.isShuttingDown) {
      console.warn('BatchWriter is shutting down, rejecting new data');
      return;
    }

    this.buffer.push(data);

    // Flush if batch size reached
    if (this.buffer.length >= this.config.maxBatchSize) {
      this.flush();
    }
  }

  /**
   * Add multiple items to buffer
   */
  addMany(data: ProcessedData[]): void {
    for (const item of data) {
      this.add(item);
    }
  }

  /**
   * Flush buffer to database
   */
  async flush(): Promise<BatchWriteResult> {
    if (this.buffer.length === 0) {
      return {
        success: true,
        processed: 0,
        failed: 0,
        errors: []
      };
    }

    const batch = this.buffer.splice(0, this.buffer.length);
    const startTime = Date.now();
    const errors: Error[] = [];
    let processed = 0;
    let failed = 0;

    try {
      // Group by type for batch operations
      const nodes: ProcessedData[] = [];
      const positions: ProcessedData[] = [];
      const telemetry: ProcessedData[] = [];
      const messages: ProcessedData[] = [];

      for (const item of batch) {
        switch (item.type) {
          case 'nodeinfo':
            nodes.push(item);
            break;
          case 'position':
            positions.push(item);
            break;
          case 'telemetry':
            telemetry.push(item);
            break;
          case 'text':
          case 'message':
            messages.push(item);
            break;
        }
      }

      // Write in transaction for atomicity
      const txn = this.db.transaction(() => {
        // Write nodes (upsert one by one - they update each other)
        for (const item of nodes) {
          try {
            if (item.type === 'nodeinfo') {
              this.nodeRepo.upsert(item.data);
              processed++;
            }
          } catch (error) {
            errors.push(error as Error);
            failed++;
          }
        }

        // Ensure stub nodes exist for positions and telemetry
        // This prevents foreign key failures when we receive position/telemetry before nodeinfo
        const ensureNodeStmt = this.db.prepare(`
          INSERT OR IGNORE INTO nodes (
            id, node_num, short_name, long_name, hw_model, role,
            last_heard, created_at, updated_at
          ) VALUES (?, ?, 'UNK', 'Unknown Node', 'UNSET', 0, ?, ?, ?)
        `);

        const nodeIdsToEnsure = new Set<string>();
        for (const item of positions) {
          if (item.type === 'position') {
            nodeIdsToEnsure.add(item.data.nodeId);
          }
        }
        for (const item of telemetry) {
          if (item.type === 'telemetry') {
            nodeIdsToEnsure.add(item.data.nodeId);
          }
        }

        const now = Date.now();
        for (const nodeId of nodeIdsToEnsure) {
          // Extract nodeNum from nodeId (e.g., "!298a814d" -> 696942925)
          const nodeNum = nodeId.startsWith('!')
            ? parseInt(nodeId.slice(1), 16)
            : 0;
          ensureNodeStmt.run(nodeId, nodeNum, now, now, now);
        }

        // Batch write positions
        if (positions.length > 0) {
          try {
            const posData = positions
              .filter((item) => item.type === 'position')
              .map((item) => (item as any).data);
            this.posRepo.insertMany(posData);
            processed += positions.length;
          } catch (error) {
            errors.push(error as Error);
            failed += positions.length;
          }
        }

        // Batch write telemetry
        if (telemetry.length > 0) {
          try {
            const telData = telemetry
              .filter((item) => item.type === 'telemetry')
              .map((item) => (item as any).data);
            this.telRepo.insertMany(telData);
            processed += telemetry.length;

            // Update node battery/voltage from telemetry
            for (const item of telemetry) {
              if (item.type === 'telemetry') {
                this.nodeRepo.updateTelemetryInfo(
                  item.data.nodeId,
                  item.data.batteryLevel,
                  item.data.voltage
                );
              }
            }
          } catch (error) {
            errors.push(error as Error);
            failed += telemetry.length;
          }
        }

        // Batch write messages
        if (messages.length > 0) {
          try {
            const msgData = messages
              .filter((item) => item.type === 'text' || item.type === 'message')
              .map((item) => (item as any).data);
            this.msgRepo.insertMany(msgData);
            processed += messages.length;
          } catch (error) {
            errors.push(error as Error);
            failed += messages.length;
          }
        }
      });

      txn();

      // Update statistics
      const batchTime = Date.now() - startTime;
      this.stats.totalProcessed += processed;
      this.stats.totalFailed += failed;
      this.stats.batchesWritten++;
      this.stats.lastBatchSize = batch.length;
      this.stats.lastBatchTime = batchTime;

      // Calculate rolling averages
      this.stats.avgBatchSize =
        (this.stats.avgBatchSize * (this.stats.batchesWritten - 1) + batch.length) /
        this.stats.batchesWritten;
      this.stats.avgBatchTime =
        (this.stats.avgBatchTime * (this.stats.batchesWritten - 1) + batchTime) /
        this.stats.batchesWritten;

      if (errors.length > 0) {
        console.error(`Batch write completed with ${errors.length} errors:`);
        errors.forEach((err, i) => {
          console.error(`  Error ${i + 1}:`, err.message, err.stack);
        });
      }

      return {
        success: errors.length === 0,
        processed,
        failed,
        errors
      };
    } catch (error) {
      console.error('Batch write failed:', error);
      this.stats.totalFailed += batch.length;
      return {
        success: false,
        processed: 0,
        failed: batch.length,
        errors: [error as Error]
      };
    }
  }

  /**
   * Start periodic flush timer
   */
  private startPeriodicFlush(): void {
    this.flushTimeout = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush();
      }
    }, this.config.maxWaitMs);
  }

  /**
   * Stop periodic flush timer
   */
  private stopPeriodicFlush(): void {
    if (this.flushTimeout) {
      clearInterval(this.flushTimeout);
      this.flushTimeout = null;
    }
  }

  /**
   * Shutdown and flush remaining buffer
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.stopPeriodicFlush();

    // Flush any remaining data
    if (this.buffer.length > 0) {
      console.log(`Flushing ${this.buffer.length} remaining items...`);
      await this.flush();
    }

    console.log('BatchWriter shutdown complete');
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      bufferSize: this.buffer.length,
      config: this.config
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalProcessed: 0,
      totalFailed: 0,
      batchesWritten: 0,
      lastBatchSize: 0,
      lastBatchTime: 0,
      avgBatchSize: 0,
      avgBatchTime: 0
    };
  }

  /**
   * Check if writer is healthy
   */
  isHealthy(): boolean {
    // Healthy if buffer is not full and last batch completed in reasonable time
    const bufferOk = this.buffer.length < this.config.maxBatchSize * 0.9;
    const latencyOk = this.stats.lastBatchTime < 200; // < 200ms
    return bufferOk && (this.stats.batchesWritten === 0 || latencyOk);
  }
}
