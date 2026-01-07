/**
 * Phase 4 Optimization Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PriorityQueue, MessagePriority } from '../priority-queue';
import { compressJSON, decompressJSON, getCompressionRatio, estimateCompressionBenefit } from '@/lib/utils/compression';
import type { ProcessedData } from '../types';

describe('PriorityQueue', () => {
  let queue: PriorityQueue;

  beforeEach(() => {
    queue = new PriorityQueue(100);
  });

  afterEach(() => {
    queue.clear();
  });

  it('should enqueue messages with priority', () => {
    const data: ProcessedData = {
      type: 'nodeinfo',
      data: {
        id: 'node1',
        node_num: 123,
        short_name: 'TEST',
        long_name: 'Test Node',
        hw_model: 'TBEAM',
        role: 1,
        last_heard: Date.now(),
        snr: null,
        rssi: null,
        hops_away: null,
        battery_level: null,
        voltage: null,
        created_at: Date.now(),
        updated_at: Date.now()
      }
    };

    const result = queue.enqueue('msg1', data, MessagePriority.HIGH);
    expect(result).toBe(true);
    expect(queue.getDepth()).toBe(1);
  });

  it('should dequeue messages in priority order', () => {
    const normalData: ProcessedData = {
      type: 'position',
      data: {
        id: 1,
        node_id: 'node1',
        node_num: 123,
        latitude: 40.7128,
        longitude: -74.0060,
        altitude: null,
        precision_bits: null,
        timestamp: Date.now(),
        snr: null,
        rssi: null
      }
    };

    const criticalData: ProcessedData = {
      type: 'telemetry',
      data: {
        id: 1,
        node_id: 'node1',
        node_num: 123,
        timestamp: Date.now(),
        battery_level: 10, // Low battery
        voltage: 3.1,
        channel_utilization: null,
        air_util_tx: null,
        uptime: null,
        temperature: null
      }
    };

    // Enqueue normal first, critical second
    queue.enqueue('normal', normalData, MessagePriority.NORMAL);
    queue.enqueue('critical', criticalData, MessagePriority.CRITICAL);

    // Should dequeue critical first
    const messages = queue.dequeue(2);
    expect(messages[0].priority).toBe(MessagePriority.CRITICAL);
    expect(messages[1].priority).toBe(MessagePriority.NORMAL);
  });

  it('should automatically determine priority for telemetry', () => {
    const lowBatteryData: ProcessedData = {
      type: 'telemetry',
      data: {
        id: 1,
        node_id: 'node1',
        node_num: 123,
        timestamp: Date.now(),
        battery_level: 15, // Low battery
        voltage: 3.2,
        channel_utilization: null,
        air_util_tx: null,
        uptime: null,
        temperature: null
      }
    };

    queue.enqueue('msg1', lowBatteryData); // No priority specified

    const stats = queue.getStats();
    expect(stats.byPriority.critical).toBe(1);
  });

  it('should drop low priority messages when full', () => {
    const smallQueue = new PriorityQueue(5);

    // Fill with low priority
    for (let i = 0; i < 5; i++) {
      const data: ProcessedData = {
        type: 'position',
        data: {
          id: i,
          node_id: `node${i}`,
          node_num: i,
          latitude: 40,
          longitude: -74,
          altitude: null,
          precision_bits: null,
          timestamp: Date.now(),
          snr: null,
          rssi: null
        }
      };
      smallQueue.enqueue(`msg${i}`, data, MessagePriority.LOW);
    }

    expect(smallQueue.getDepth()).toBe(5);

    // Try to add critical message
    const criticalData: ProcessedData = {
      type: 'telemetry',
      data: {
        id: 100,
        node_id: 'critical',
        node_num: 100,
        timestamp: Date.now(),
        battery_level: 5,
        voltage: 3.0,
        channel_utilization: null,
        air_util_tx: null,
        uptime: null,
        temperature: null
      }
    };

    const result = smallQueue.enqueue('critical', criticalData, MessagePriority.CRITICAL);
    expect(result).toBe(true);
    expect(smallQueue.getDepth()).toBe(5); // Still 5, dropped one low priority
  });

  it('should track queue statistics', () => {
    const data: ProcessedData = {
      type: 'position',
      data: {
        id: 1,
        node_id: 'node1',
        node_num: 123,
        latitude: 40,
        longitude: -74,
        altitude: null,
        precision_bits: null,
        timestamp: Date.now(),
        snr: null,
        rssi: null
      }
    };

    queue.enqueue('msg1', data, MessagePriority.HIGH);
    queue.enqueue('msg2', data, MessagePriority.NORMAL);

    const stats = queue.getStats();
    expect(stats.total).toBe(2);
    expect(stats.byPriority.high).toBe(1);
    expect(stats.byPriority.normal).toBe(1);
    expect(stats.utilization).toBe(2 / 100);
  });
});

describe('Compression', () => {
  it('should compress and decompress JSON', () => {
    const data = {
      nodes: Array.from({ length: 100 }, (_, i) => ({
        id: `node${i}`,
        name: `Node ${i}`,
        latitude: 40 + i * 0.01,
        longitude: -74 + i * 0.01
      }))
    };

    const { data: compressed, compressed: wasCompressed } = compressJSON(data, { threshold: 100 });
    expect(wasCompressed).toBe(true);
    expect(compressed).toBeInstanceOf(Buffer);

    const decompressed = decompressJSON(compressed);
    expect(decompressed).toEqual(data);
  });

  it('should not compress small payloads', () => {
    const data = { id: 1, name: 'test' };
    const { compressed } = compressJSON(data, { threshold: 1024 });
    expect(compressed).toBe(false);
  });

  it('should calculate compression ratio', () => {
    const ratio = getCompressionRatio(1000, 300);
    expect(ratio).toBe(70); // 70% reduction
  });

  it('should estimate compression benefit', () => {
    const largeData = 'x'.repeat(10000);
    const estimate = estimateCompressionBenefit(largeData);

    expect(estimate.originalSize).toBe(10000);
    expect(estimate.compressedSize).toBeLessThan(estimate.originalSize);
    expect(estimate.ratio).toBeGreaterThan(0);
  });

  it('should handle compression of repeated data efficiently', () => {
    const repeatedData = {
      nodes: Array.from({ length: 1000 }, () => ({
        type: 'node',
        status: 'active',
        timestamp: Date.now()
      }))
    };

    const estimate = estimateCompressionBenefit(JSON.stringify(repeatedData));
    expect(estimate.ratio).toBeGreaterThan(80); // Should achieve >80% compression
    expect(estimate.worthCompressing).toBe(true);
  });
});
