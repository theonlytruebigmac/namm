/**
 * Priority Queue
 *
 * Message prioritization for critical updates
 */

import type { ProcessedData } from './types';

export enum MessagePriority {
  CRITICAL = 0,  // Emergency messages, node offline
  HIGH = 1,      // Node info updates, important telemetry
  NORMAL = 2,    // Regular position/telemetry
  LOW = 3        // Historical data, bulk imports
}

export interface PriorityMessage {
  id: string;
  priority: MessagePriority;
  data: ProcessedData;
  timestamp: number;
}

export class PriorityQueue {
  private queues: Map<MessagePriority, PriorityMessage[]>;
  private maxSize: number;
  private currentSize: number = 0;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
    this.queues = new Map([
      [MessagePriority.CRITICAL, []],
      [MessagePriority.HIGH, []],
      [MessagePriority.NORMAL, []],
      [MessagePriority.LOW, []]
    ]);
  }

  /**
   * Enqueue a message with priority
   */
  enqueue(id: string, data: ProcessedData, priority?: MessagePriority): boolean {
    if (this.currentSize >= this.maxSize) {
      // Drop low priority messages if queue is full
      if (priority === MessagePriority.LOW || priority === MessagePriority.NORMAL) {
        return false;
      }
      // Make room by dropping low priority messages
      this.dropLowPriority();
    }

    // Determine priority if not specified
    if (priority === undefined) {
      priority = this.determinePriority(data);
    }

    const message: PriorityMessage = {
      id,
      priority,
      data,
      timestamp: Date.now()
    };

    const queue = this.queues.get(priority)!;
    queue.push(message);
    this.currentSize++;

    return true;
  }

  /**
   * Dequeue messages in priority order
   */
  dequeue(count: number): PriorityMessage[] {
    const results: PriorityMessage[] = [];

    // Process in priority order
    for (const priority of [
      MessagePriority.CRITICAL,
      MessagePriority.HIGH,
      MessagePriority.NORMAL,
      MessagePriority.LOW
    ]) {
      const queue = this.queues.get(priority)!;

      while (queue.length > 0 && results.length < count) {
        const message = queue.shift()!;
        results.push(message);
        this.currentSize--;
      }

      if (results.length >= count) break;
    }

    return results;
  }

  /**
   * Determine priority based on message content
   */
  private determinePriority(data: ProcessedData): MessagePriority {
    switch (data.type) {
      case 'nodeinfo':
        // New node or significant node changes are high priority
        return MessagePriority.HIGH;

      case 'telemetry':
        // Low battery is critical
        if (data.data.batteryLevel !== undefined && data.data.batteryLevel !== null && data.data.batteryLevel < 20) {
          return MessagePriority.CRITICAL;
        }
        // High channel utilization is high priority
        if (data.data.channelUtilization !== undefined && data.data.channelUtilization !== null && data.data.channelUtilization > 80) {
          return MessagePriority.HIGH;
        }
        return MessagePriority.NORMAL;

      case 'position':
        // Positions are normal priority
        return MessagePriority.NORMAL;

      case 'message':
        // Direct messages are high priority
        if (!data.data.to.startsWith('!ffffffff')) {
          return MessagePriority.HIGH;
        }
        // Broadcast messages are normal
        return MessagePriority.NORMAL;

      default:
        return MessagePriority.NORMAL;
    }
  }

  /**
   * Drop low priority messages to make room
   */
  private dropLowPriority(): void {
    const lowQueue = this.queues.get(MessagePriority.LOW)!;
    if (lowQueue.length > 0) {
      lowQueue.shift();
      this.currentSize--;
      return;
    }

    const normalQueue = this.queues.get(MessagePriority.NORMAL)!;
    if (normalQueue.length > 0) {
      normalQueue.shift();
      this.currentSize--;
    }
  }

  /**
   * Get queue depth
   */
  getDepth(): number {
    return this.currentSize;
  }

  /**
   * Get queue utilization (0-1)
   */
  getUtilization(): number {
    return this.currentSize / this.maxSize;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      total: this.currentSize,
      maxSize: this.maxSize,
      utilization: this.getUtilization(),
      byPriority: {
        critical: this.queues.get(MessagePriority.CRITICAL)!.length,
        high: this.queues.get(MessagePriority.HIGH)!.length,
        normal: this.queues.get(MessagePriority.NORMAL)!.length,
        low: this.queues.get(MessagePriority.LOW)!.length
      }
    };
  }

  /**
   * Clear all queues
   */
  clear(): void {
    this.queues.forEach(queue => queue.length = 0);
    this.currentSize = 0;
  }
}
