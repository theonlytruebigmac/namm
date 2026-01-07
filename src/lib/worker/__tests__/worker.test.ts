/**
 * Worker Tests
 *
 * Unit tests for message queue, deduplicator, rate limiter, and batch writer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema } from '@/lib/db/schema';
import { MessageQueue } from '../message-queue';
import { Deduplicator } from '../deduplicator';
import { RateLimiter } from '../rate-limiter';
import { BatchWriter } from '../batch-writer';
import type { ProcessedData } from '../types';

describe('MessageQueue', () => {
  let queue: MessageQueue;

  beforeEach(() => {
    queue = new MessageQueue({
      maxSize: 100,
      dedupeWindowMs: 1000
    });
  });

  afterEach(() => {
    queue.clear();
  });

  const createTestData = (): ProcessedData => ({
    type: 'nodeinfo',
    data: {
      id: '!12345678',
      nodeNum: 123456,
      shortName: 'TEST',
      longName: 'Test Node',
      hwModel: 'TBEAM',
      role: 1,
      lastHeard: Date.now()
    }
  });

  it('should enqueue messages', () => {
    const data = createTestData();
    const success = queue.enqueue('test-1', data);

    expect(success).toBe(true);
    expect(queue.getDepth()).toBe(1);
  });

  it('should detect duplicates', () => {
    const data = createTestData();
    queue.enqueue('test-1', data);

    expect(queue.isDuplicate('test-1')).toBe(true);
    expect(queue.isDuplicate('test-2')).toBe(false);
  });

  it('should dequeue messages', () => {
    queue.enqueue('test-1', createTestData());
    queue.enqueue('test-2', createTestData());

    const messages = queue.dequeue(1);
    expect(messages.length).toBe(1);
    expect(queue.getDepth()).toBe(1);
  });

  it('should reject messages when full', () => {
    // Fill queue
    for (let i = 0; i < 100; i++) {
      queue.enqueue(`test-${i}`, createTestData());
    }

    // Try to add one more
    const success = queue.enqueue('overflow', createTestData());
    expect(success).toBe(false);
    expect(queue.getDroppedCount()).toBe(1);
  });

  it('should calculate utilization', () => {
    queue.enqueue('test-1', createTestData());

    const utilization = queue.getUtilization();
    expect(utilization).toBe(0.01); // 1/100
  });

  it('should peek without removing', () => {
    queue.enqueue('test-1', createTestData());
    queue.enqueue('test-2', createTestData());

    const peeked = queue.peek(1);
    expect(peeked.length).toBe(1);
    expect(queue.getDepth()).toBe(2); // Still 2
  });

  it('should clear queue', () => {
    queue.enqueue('test-1', createTestData());
    queue.clear();

    expect(queue.getDepth()).toBe(0);
    expect(queue.getDroppedCount()).toBe(0);
  });
});

describe('Deduplicator', () => {
  it('should generate consistent hash for same data', () => {
    const data: ProcessedData = {
      type: 'nodeinfo',
      data: {
        id: '!12345678',
        nodeNum: 123456,
        shortName: 'TEST',
        longName: 'Test Node',
        hwModel: 'TBEAM',
        role: 1,
        lastHeard: Date.now()
      }
    };

    const hash1 = Deduplicator.generateHash(data);
    const hash2 = Deduplicator.generateHash(data);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
  });

  it('should generate different hash for different data', () => {
    const data1: ProcessedData = {
      type: 'nodeinfo',
      data: {
        id: '!12345678',
        nodeNum: 123456,
        shortName: 'TEST',
        longName: 'Test',
        hwModel: 'TBEAM',
        role: 1,
        lastHeard: Date.now()
      }
    };

    const data2: ProcessedData = {
      type: 'nodeinfo',
      data: {
        id: '!87654321',
        nodeNum: 654321,
        shortName: 'OTHER',
        longName: 'Other',
        hwModel: 'TBEAM',
        role: 1,
        lastHeard: Date.now()
      }
    };

    const hash1 = Deduplicator.generateHash(data1);
    const hash2 = Deduplicator.generateHash(data2);

    expect(hash1).not.toBe(hash2);
  });

  it('should check duplicate', () => {
    const data: ProcessedData = {
      type: 'message',
      data: {
        id: 12345,
        from: '!12345678',
        to: '!87654321',
        channel: 0,
        text: 'Hello',
        timestamp: Date.now()
      }
    };

    const cache = new Set<string>();

    const result1 = Deduplicator.checkDuplicate(data, cache);
    expect(result1.isDuplicate).toBe(false);

    cache.add(result1.hash);

    const result2 = Deduplicator.checkDuplicate(data, cache);
    expect(result2.isDuplicate).toBe(true);
  });

  it('should extract node ID', () => {
    const testCases: { data: ProcessedData; expected: string }[] = [
      {
        data: {
          type: 'nodeinfo',
          data: {
            id: '!12345678',
            nodeNum: 123456,
            shortName: 'TEST',
            longName: 'Test',
            hwModel: 'TBEAM',
            role: 1,
            lastHeard: Date.now()
          }
        },
        expected: '!12345678'
      },
      {
        data: {
          type: 'position',
          data: {
            nodeId: '!87654321',
            nodeNum: 654321,
            position: { latitude: 38.0, longitude: -84.5 },
            timestamp: Date.now()
          }
        },
        expected: '!87654321'
      }
    ];

    for (const { data, expected } of testCases) {
      expect(Deduplicator.getNodeId(data)).toBe(expected);
    }
  });

  it('should assign priorities', () => {
    const message: ProcessedData = {
      type: 'message',
      data: {
        id: 1,
        from: '!12345678',
        to: '!87654321',
        channel: 0,
        timestamp: Date.now()
      }
    };

    const telemetry: ProcessedData = {
      type: 'telemetry',
      data: {
        nodeId: '!12345678',
        nodeNum: 123456,
        timestamp: Date.now()
      }
    };

    expect(Deduplicator.getPriority(message)).toBeGreaterThan(
      Deduplicator.getPriority(telemetry)
    );
  });
});

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      maxUpdatesPerSecond: 2,
      windowMs: 1000
    });
  });

  afterEach(() => {
    limiter.clear();
  });

  const createTestData = (nodeId: string): ProcessedData => ({
    type: 'nodeinfo',
    data: {
      id: nodeId,
      nodeNum: 123456,
      shortName: 'TEST',
      longName: 'Test',
      hwModel: 'TBEAM',
      role: 1,
      lastHeard: Date.now()
    }
  });

  it('should allow first message', () => {
    const data = createTestData('!12345678');
    const result = limiter.checkLimit(data);

    expect(result.allowed).toBe(true);
    expect(result.nodeId).toBe('!12345678');
  });

  it('should rate limit after max updates', () => {
    const data = createTestData('!12345678');

    // First 2 should be allowed
    expect(limiter.checkLimit(data).allowed).toBe(true);
    expect(limiter.checkLimit(data).allowed).toBe(true);

    // Third should be rate limited
    const result = limiter.checkLimit(data);
    expect(result.allowed).toBe(false);
    expect(result.timeUntilNext).toBeGreaterThan(0);
  });

  it('should track different nodes separately', () => {
    const data1 = createTestData('!12345678');
    const data2 = createTestData('!87654321');

    // Both should be allowed
    expect(limiter.checkLimit(data1).allowed).toBe(true);
    expect(limiter.checkLimit(data2).allowed).toBe(true);
  });

  it('should reset rate limit', () => {
    const data = createTestData('!12345678');

    limiter.checkLimit(data);
    limiter.checkLimit(data);

    expect(limiter.checkLimit(data).allowed).toBe(false);

    limiter.reset('!12345678');

    expect(limiter.checkLimit(data).allowed).toBe(true);
  });

  it('should get rate limited nodes', () => {
    const data = createTestData('!12345678');

    limiter.checkLimit(data);
    limiter.checkLimit(data);
    limiter.checkLimit(data); // Rate limited

    const limited = limiter.getRateLimitedNodes();
    expect(limited).toContain('!12345678');
  });
});

describe('BatchWriter', () => {
  let db: Database.Database;
  let writer: BatchWriter;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
    writer = new BatchWriter(db, {
      maxBatchSize: 10,
      maxWaitMs: 100
    });
  });

  afterEach(async () => {
    await writer.shutdown();
    db.close();
  });

  const createNodeData = (): ProcessedData => ({
    type: 'nodeinfo',
    data: {
      id: '!12345678',
      nodeNum: 123456,
      shortName: 'TEST',
      longName: 'Test Node',
      hwModel: 'TBEAM',
      role: 1,
      lastHeard: Date.now()
    }
  });

  const createPositionData = (): ProcessedData => ({
    type: 'position',
    data: {
      nodeId: '!12345678',
      nodeNum: 123456,
      position: {
        latitude: 38.0,
        longitude: -84.5,
        altitude: 300
      },
      timestamp: Date.now()
    }
  });

  it('should add data to buffer', () => {
    writer.add(createNodeData());

    expect(writer.getBufferSize()).toBe(1);
  });

  it('should flush buffer', async () => {
    writer.add(createNodeData());

    const result = await writer.flush();

    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
    expect(writer.getBufferSize()).toBe(0);
  });

  it('should batch multiple items', async () => {
    writer.add(createNodeData());
    writer.add(createNodeData());
    writer.add(createNodeData());

    const result = await writer.flush();

    expect(result.processed).toBe(3);
  });

  it('should track statistics', async () => {
    writer.add(createNodeData());
    await writer.flush();

    const stats = writer.getStats();

    expect(stats.totalProcessed).toBe(1);
    expect(stats.batchesWritten).toBe(1);
    expect(stats.lastBatchSize).toBe(1);
  });

  it('should handle position inserts', async () => {
    // Must insert node first (foreign key)
    writer.add(createNodeData());
    await writer.flush();

    writer.add(createPositionData());
    const result = await writer.flush();

    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
  });

  it('should handle empty buffer', async () => {
    const result = await writer.flush();

    expect(result.success).toBe(true);
    expect(result.processed).toBe(0);
  });

  it('should report health', () => {
    expect(writer.isHealthy()).toBe(true);
  });
});
