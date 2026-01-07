/**
 * Rate Limiter
 *
 * Limits message processing per node to prevent flooding
 */

import type { ProcessedData, RateLimitResult, RateLimiterConfig } from './types';
import { Deduplicator } from './deduplicator';

interface NodeRateLimit {
  nodeId: string;
  timestamps: number[];
  lastUpdate: number;
}

export class RateLimiter {
  private limits = new Map<string, NodeRateLimit>();
  private config: RateLimiterConfig;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = {
      maxUpdatesPerSecond: config.maxUpdatesPerSecond || 1,
      windowMs: config.windowMs || 1000
    };

    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a message should be rate limited
   */
  checkLimit(data: ProcessedData): RateLimitResult {
    const nodeId = Deduplicator.getNodeId(data);
    const now = Date.now();

    // Get or create rate limit entry
    let limit = this.limits.get(nodeId);
    if (!limit) {
      limit = {
        nodeId,
        timestamps: [],
        lastUpdate: now
      };
      this.limits.set(nodeId, limit);
    }

    // Remove timestamps outside the window
    limit.timestamps = limit.timestamps.filter(
      (ts) => now - ts < this.config.windowMs
    );

    // Check if limit exceeded
    const allowed = limit.timestamps.length < this.config.maxUpdatesPerSecond;

    if (allowed) {
      limit.timestamps.push(now);
      limit.lastUpdate = now;
    }

    const timeUntilNext = allowed
      ? 0
      : Math.max(0, limit.timestamps[0] + this.config.windowMs - now);

    return {
      allowed,
      nodeId,
      timeUntilNext
    };
  }

  /**
   * Manually allow a message (for testing or override)
   */
  allow(nodeId: string): void {
    const now = Date.now();
    let limit = this.limits.get(nodeId);
    if (!limit) {
      limit = {
        nodeId,
        timestamps: [],
        lastUpdate: now
      };
      this.limits.set(nodeId, limit);
    }
    limit.timestamps.push(now);
    limit.lastUpdate = now;
  }

  /**
   * Reset rate limit for a node
   */
  reset(nodeId: string): void {
    this.limits.delete(nodeId);
  }

  /**
   * Clear all rate limits
   */
  clear(): void {
    this.limits.clear();
  }

  /**
   * Clean up old entries (not updated in 5 minutes)
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [nodeId, limit] of this.limits.entries()) {
      if (now - limit.lastUpdate > maxAge) {
        this.limits.delete(nodeId);
      }
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      trackedNodes: this.limits.size,
      config: this.config
    };
  }

  /**
   * Get rate limit info for a specific node
   */
  getNodeInfo(nodeId: string): NodeRateLimit | null {
    return this.limits.get(nodeId) || null;
  }

  /**
   * Get all nodes currently being rate limited
   */
  getRateLimitedNodes(): string[] {
    const now = Date.now();
    const limited: string[] = [];

    for (const [nodeId, limit] of this.limits.entries()) {
      const recentCount = limit.timestamps.filter(
        (ts) => now - ts < this.config.windowMs
      ).length;

      if (recentCount >= this.config.maxUpdatesPerSecond) {
        limited.push(nodeId);
      }
    }

    return limited;
  }
}
