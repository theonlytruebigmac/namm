/**
 * Message Deduplicator
 *
 * Detects duplicate messages using hash-based identification
 */

import crypto from 'crypto';
import type { ProcessedData, DedupeResult } from './types';

export class Deduplicator {
  /**
   * Generate a hash for a message
   * Uses node ID + type + timestamp (rounded to second) for deduplication
   */
  static generateHash(data: ProcessedData): string {
    let key: string;

    switch (data.type) {
      case 'nodeinfo':
        // Dedupe nodeinfo by node ID + hw model + role
        key = `nodeinfo:${data.data.id}:${data.data.hwModel}:${data.data.role}`;
        break;

      case 'position':
        // Dedupe position by node ID + coordinates (rounded)
        const lat = Math.round(data.data.position.latitude * 1000) / 1000;
        const lon = Math.round(data.data.position.longitude * 1000) / 1000;
        key = `position:${data.data.nodeId}:${lat}:${lon}`;
        break;

      case 'telemetry':
        // Dedupe telemetry by node ID + timestamp (rounded to 10 seconds)
        const timestamp = Math.floor(data.data.timestamp / 10000) * 10000;
        key = `telemetry:${data.data.nodeId}:${timestamp}`;
        break;

      case 'message':
        // Dedupe message by message ID (should be unique)
        key = `message:${data.data.id}`;
        break;

      default:
        key = `unknown:${Date.now()}`;
    }

    // Generate SHA256 hash
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Check if data is a duplicate and generate hash
   */
  static checkDuplicate(
    data: ProcessedData,
    existingHashes: Set<string> | Map<string, any>
  ): DedupeResult {
    const hash = this.generateHash(data);
    const isDuplicate = existingHashes.has(hash);

    return {
      isDuplicate,
      hash
    };
  }

  /**
   * Generate a unique ID for queue management
   * Similar to hash but includes microsecond timestamp for uniqueness
   */
  static generateQueueId(data: ProcessedData): string {
    const hash = this.generateHash(data);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${hash.substring(0, 16)}-${timestamp}-${random}`;
  }

  /**
   * Extract node ID from processed data
   */
  static getNodeId(data: ProcessedData): string {
    switch (data.type) {
      case 'nodeinfo':
        return data.data.id;
      case 'position':
        return data.data.nodeId;
      case 'telemetry':
        return data.data.nodeId;
      case 'message':
        return data.data.from;
      default:
        return 'unknown';
    }
  }

  /**
   * Get priority for message type (1-5, higher = more important)
   */
  static getPriority(data: ProcessedData): number {
    switch (data.type) {
      case 'message':
        return 5; // Highest priority
      case 'nodeinfo':
        return 4;
      case 'position':
        return 3;
      case 'telemetry':
        return 2; // Lowest priority
      default:
        return 1;
    }
  }
}
