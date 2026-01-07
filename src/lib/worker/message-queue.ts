/**
 * Message Queue with LRU Eviction
 *
 * In-memory queue for MQTT messages with automatic eviction
 * when capacity is reached
 */

import { LRUCache } from 'lru-cache';
import type { QueuedMessage, ProcessedData, QueueConfig } from './types';

export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private cache: LRUCache<string, boolean>;
  private config: QueueConfig;
  private droppedCount = 0;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      maxSize: config.maxSize || 10000,
      dedupeWindowMs: config.dedupeWindowMs || 60000 // 1 minute
    };

    // LRU cache for fast duplicate detection
    this.cache = new LRUCache<string, boolean>({
      max: this.config.maxSize * 2, // Track more for deduplication
      ttl: this.config.dedupeWindowMs
    });
  }

  /**
   * Enqueue a message
   * Returns false if queue is full and message was dropped
   */
  enqueue(id: string, data: ProcessedData): boolean {
    // Check if queue is full
    if (this.queue.length >= this.config.maxSize) {
      this.droppedCount++;
      return false;
    }

    const message: QueuedMessage = {
      id,
      data,
      timestamp: Date.now(),
      retries: 0
    };

    this.queue.push(message);
    this.cache.set(id, true);
    return true;
  }

  /**
   * Check if a message ID exists in the cache (is duplicate)
   */
  isDuplicate(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Dequeue up to N messages
   */
  dequeue(count: number): QueuedMessage[] {
    const messages = this.queue.splice(0, Math.min(count, this.queue.length));
    return messages;
  }

  /**
   * Peek at the next N messages without removing them
   */
  peek(count: number): QueuedMessage[] {
    return this.queue.slice(0, Math.min(count, this.queue.length));
  }

  /**
   * Get current queue depth
   */
  getDepth(): number {
    return this.queue.length;
  }

  /**
   * Get queue utilization (0-1)
   */
  getUtilization(): number {
    return this.queue.length / this.config.maxSize;
  }

  /**
   * Get number of dropped messages
   */
  getDroppedCount(): number {
    return this.droppedCount;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      max: this.cache.max
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    this.cache.clear();
    this.droppedCount = 0;
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      depth: this.queue.length,
      maxSize: this.config.maxSize,
      utilization: this.getUtilization(),
      droppedCount: this.droppedCount,
      cacheSize: this.cache.size
    };
  }

  /**
   * Check if queue is healthy
   */
  isHealthy(): boolean {
    return this.getUtilization() < 0.9; // < 90% full
  }

  /**
   * Get oldest message timestamp
   */
  getOldestMessageAge(): number | null {
    if (this.queue.length === 0) return null;
    return Date.now() - this.queue[0].timestamp;
  }
}
