/**
 * WebSocket Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionManager } from '../connection-manager';
import { Broadcaster } from '../broadcaster';
import type { WebSocket } from 'ws';
import type { NodeUpdate, PositionUpdate } from '../protocol';

// Mock WebSocket
const createMockWebSocket = () => {
  const handlers: Record<string, Function> = {};

  return {
    readyState: 1, // OPEN
    OPEN: 1,
    CLOSED: 3,
    CLOSING: 2,
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      handlers[event] = handler;
    }),
    emit: vi.fn((event: string, ...args: any[]) => {
      handlers[event]?.(...args);
    }),
    _handlers: handlers
  } as unknown as WebSocket;
};

describe('ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager(1000, 2000); // Short intervals for testing
  });

  afterEach(() => {
    manager.shutdown();
  });

  it('should add and track connections', () => {
    const ws = createMockWebSocket();
    manager.add('test-1', ws);

    expect(manager.getCount()).toBe(1);
    expect(manager.get('test-1')).toBe(ws);
  });

  it('should remove connections', () => {
    const ws = createMockWebSocket();
    manager.add('test-1', ws);
    manager.remove('test-1');

    expect(manager.getCount()).toBe(0);
    expect(manager.get('test-1')).toBeUndefined();
  });

  it('should send messages to connections', () => {
    const ws = createMockWebSocket();
    manager.add('test-1', ws);

    const result = manager.send('test-1', { type: 'pong', timestamp: Date.now() });

    expect(result).toBe(true);
    expect(ws.send).toHaveBeenCalled();
  });

  it('should broadcast to all connections', () => {
    const ws1 = createMockWebSocket();
    const ws2 = createMockWebSocket();

    manager.add('test-1', ws1);
    manager.add('test-2', ws2);

    const sent = manager.broadcast({ type: 'pong', timestamp: Date.now() });

    expect(sent).toBe(2);
    expect(ws1.send).toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalled();
  });

  it('should exclude connections from broadcast', () => {
    const ws1 = createMockWebSocket();
    const ws2 = createMockWebSocket();

    manager.add('test-1', ws1);
    manager.add('test-2', ws2);

    const sent = manager.broadcast(
      { type: 'pong', timestamp: Date.now() },
      { excludeId: 'test-1' }
    );

    expect(sent).toBe(1);
    expect(ws1.send).not.toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalled();
  });

  it('should track connection stats', () => {
    const ws = createMockWebSocket();
    manager.add('test-1', ws);
    manager.send('test-1', { type: 'pong', timestamp: Date.now() });

    const stats = manager.getStats();
    expect(stats.connections).toBe(1);
    expect(stats.totalMessagesSent).toBe(1);
    expect(stats.totalBytesTransmitted).toBeGreaterThan(0);
  });

  it('should update connection filter', () => {
    const ws = createMockWebSocket();
    manager.add('test-1', ws);

    manager.updateFilter('test-1', {
      nodeIds: ['node1', 'node2']
    });

    const state = manager.getState('test-1');
    expect(state?.filter).toBeDefined();
    expect(state?.filter?.nodeIds).toEqual(['node1', 'node2']);
  });
});

describe('Broadcaster', () => {
  let manager: ConnectionManager;
  let broadcaster: Broadcaster;

  beforeEach(() => {
    manager = new ConnectionManager();
    broadcaster = new Broadcaster(manager);
  });

  afterEach(() => {
    broadcaster.shutdown();
    manager.shutdown();
  });

  it('should queue node updates', () => {
    const update: NodeUpdate = {
      id: 'node1',
      shortName: 'TEST',
      lastHeard: Date.now()
    };

    broadcaster.queueNodeUpdate(update);

    const stats = broadcaster.getStats();
    expect(stats.pendingNodes).toBe(1);
  });

  it('should queue position updates', () => {
    const update: PositionUpdate = {
      id: 1,
      nodeId: 'node1',
      latitude: 40.7128,
      longitude: -74.0060,
      timestamp: Date.now()
    };

    broadcaster.queuePositionUpdate(update);

    const stats = broadcaster.getStats();
    expect(stats.pendingPositions).toBe(1);
  });

  it('should merge duplicate node updates', () => {
    const update1: NodeUpdate = {
      id: 'node1',
      shortName: 'TEST1',
      lastHeard: Date.now()
    };
    const update2: NodeUpdate = {
      id: 'node1',
      shortName: 'TEST2',
      lastHeard: Date.now()
    };

    broadcaster.queueNodeUpdate(update1);
    broadcaster.queueNodeUpdate(update2);

    const stats = broadcaster.getStats();
    expect(stats.pendingNodes).toBe(1); // Merged, not 2
  });

  it('should flush updates periodically', async () => {
    const ws = createMockWebSocket();
    manager.add('test-1', ws);

    const update: NodeUpdate = {
      id: 'node1',
      shortName: 'TEST',
      lastHeard: Date.now()
    };

    broadcaster.queueNodeUpdate(update);

    // Wait for broadcast interval
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(ws.send).toHaveBeenCalled();
    const stats = broadcaster.getStats();
    expect(stats.pendingNodes).toBe(0);
  });
});

describe('Protocol Functions', () => {
  it('should convert DB node to update', async () => {
    const { dbNodeToUpdate } = await import('../protocol');
    const dbNode = {
      id: 'node1',
      node_num: 123,
      short_name: 'TEST',
      long_name: 'Test Node',
      hw_model: 'TBEAM',
      role: 1,
      last_heard: Date.now(),
      snr: 8.5,
      rssi: -95,
      hops_away: 2,
      battery_level: 85,
      voltage: 4.1,
      created_at: Date.now(),
      updated_at: Date.now()
    };

    const update = dbNodeToUpdate(dbNode);

    expect(update.id).toBe('node1');
    expect(update.nodeNum).toBe(123);
    expect(update.shortName).toBe('TEST');
    expect(update.snr).toBe(8.5);
  });

  it('should check if position is within bounds', async () => {
    const { isWithinBounds } = await import('../protocol');

    const bounds = {
      north: 41,
      south: 40,
      east: -73,
      west: -75 // West should be more negative than east
    };

    expect(isWithinBounds(40.7128, -74.0060, bounds)).toBe(true);
    expect(isWithinBounds(42, -74, bounds)).toBe(false); // Latitude out of bounds
    expect(isWithinBounds(40.5, -72, bounds)).toBe(false); // Longitude out of bounds (east)
    expect(isWithinBounds(40.5, -76, bounds)).toBe(false); // Longitude out of bounds (west)
  });

  it('should match filter correctly', async () => {
    const { matchesFilter } = await import('../protocol');

    const filter = {
      nodeIds: ['node1', 'node2']
    };

    expect(matchesFilter('node1', null, filter)).toBe(true);
    expect(matchesFilter('node3', null, filter)).toBe(false);
    expect(matchesFilter('node3', null, undefined)).toBe(true);
  });
});
