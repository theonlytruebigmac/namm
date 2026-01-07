/**
 * WebSocket Broadcaster
 *
 * Broadcasts updates to connected WebSocket clients with throttling and filtering
 */

import { getDatabase } from '@/lib/db';
import { NodeRepository, PositionRepository, MessageRepository } from '@/lib/db/db';
import type { ConnectionManager } from './connection-manager';
import type {
  WSServerMessage,
  NodeUpdate,
  PositionUpdate,
  TelemetryUpdate,
  MessageUpdate,
  SnapshotData,
  SubscriptionFilter
} from './protocol';
import {
  dbNodeToUpdate,
  dbPositionToUpdate,
  dbTelemetryToUpdate,
  dbMessageToUpdate,
  matchesFilter
} from './protocol';

export class Broadcaster {
  private nodeRepo: NodeRepository;
  private posRepo: PositionRepository;
  private msgRepo: MessageRepository;

  // Throttling
  private pendingUpdates = {
    nodes: new Map<string, NodeUpdate>(),
    positions: [] as PositionUpdate[],
    telemetry: [] as TelemetryUpdate[],
    messages: [] as MessageUpdate[]
  };
  private broadcastTimer: NodeJS.Timeout | null = null;
  private broadcastIntervalMs = 100; // Broadcast every 100ms

  constructor(private connectionManager: ConnectionManager) {
    const db = getDatabase();
    this.nodeRepo = new NodeRepository(db);
    this.posRepo = new PositionRepository(db);
    this.msgRepo = new MessageRepository(db);

    this.startBroadcastTimer();
  }

  /**
   * Queue a node update for broadcast
   */
  queueNodeUpdate(update: NodeUpdate): void {
    // Merge with existing update (only keep latest)
    this.pendingUpdates.nodes.set(update.id, update);
  }

  /**
   * Queue a position update for broadcast
   */
  queuePositionUpdate(update: PositionUpdate): void {
    this.pendingUpdates.positions.push(update);
  }

  /**
   * Queue a telemetry update for broadcast
   */
  queueTelemetryUpdate(update: TelemetryUpdate): void {
    this.pendingUpdates.telemetry.push(update);
  }

  /**
   * Queue a message for broadcast
   */
  queueMessage(update: MessageUpdate): void {
    this.pendingUpdates.messages.push(update);
  }

  /**
   * Send initial snapshot to a new connection
   */
  sendSnapshot(connectionId: string): void {
    try {
      // Get recent nodes (active in last hour)
      const nodes = this.nodeRepo.getAll({
        activeWithin: 3600000 // 1 hour
      });

      // Get latest positions for active nodes
      const positions = this.posRepo.getLatestForAllNodes();

      // Get recent messages (last 50)
      const messages = this.msgRepo.getRecent(50);

      const snapshot: SnapshotData = {
        nodes: nodes.map(dbNodeToUpdate),
        positions: positions.map(dbPositionToUpdate),
        recentMessages: messages.map(dbMessageToUpdate),
        timestamp: Date.now()
      };

      const message: WSServerMessage = {
        type: 'snapshot',
        data: snapshot
      };

      this.connectionManager.send(connectionId, message);
      console.log(`Sent snapshot to ${connectionId}: ${nodes.length} nodes, ${positions.length} positions`);
    } catch (error) {
      console.error('Error sending snapshot:', error);
      this.connectionManager.send(connectionId, {
        type: 'error',
        error: 'Failed to load snapshot',
        code: 'SNAPSHOT_ERROR'
      });
    }
  }

  /**
   * Start broadcast timer
   */
  private startBroadcastTimer(): void {
    this.broadcastTimer = setInterval(() => {
      this.flushUpdates();
    }, this.broadcastIntervalMs);
  }

  /**
   * Flush pending updates to clients
   */
  private flushUpdates(): void {
    // Nothing to broadcast
    if (
      this.pendingUpdates.nodes.size === 0 &&
      this.pendingUpdates.positions.length === 0 &&
      this.pendingUpdates.telemetry.length === 0 &&
      this.pendingUpdates.messages.length === 0
    ) {
      return;
    }

    // Broadcast node updates
    if (this.pendingUpdates.nodes.size > 0) {
      const nodes = Array.from(this.pendingUpdates.nodes.values());
      this.broadcastFiltered({
        type: 'node_update',
        nodes
      });
      this.pendingUpdates.nodes.clear();
    }

    // Broadcast position updates
    if (this.pendingUpdates.positions.length > 0) {
      this.broadcastFiltered({
        type: 'position_update',
        positions: this.pendingUpdates.positions
      });
      this.pendingUpdates.positions = [];
    }

    // Broadcast telemetry updates
    if (this.pendingUpdates.telemetry.length > 0) {
      this.broadcastFiltered({
        type: 'telemetry_update',
        telemetry: this.pendingUpdates.telemetry
      });
      this.pendingUpdates.telemetry = [];
    }

    // Broadcast messages
    if (this.pendingUpdates.messages.length > 0) {
      this.broadcastFiltered({
        type: 'message',
        messages: this.pendingUpdates.messages
      });
      this.pendingUpdates.messages = [];
    }
  }

  /**
   * Broadcast with filtering based on client subscriptions
   */
  private broadcastFiltered(message: WSServerMessage): void {
    const connectionIds = this.connectionManager.getConnectionIds();

    for (const id of connectionIds) {
      const state = this.connectionManager.getState(id);
      if (!state) continue;

      // Apply filter if client has one
      if (state.filter) {
        const filtered = this.filterMessage(message, state.filter);
        if (filtered) {
          this.connectionManager.send(id, filtered);
        }
      } else {
        // No filter, send all
        this.connectionManager.send(id, message);
      }
    }
  }

  /**
   * Filter message based on subscription filter
   */
  private filterMessage(
    message: WSServerMessage,
    filter: SubscriptionFilter
  ): WSServerMessage | null {
    switch (message.type) {
      case 'node_update':
        if (filter.messageTypes && !filter.messageTypes.includes('node')) {
          return null;
        }
        const filteredNodes = message.nodes.filter((node) => {
          if (filter.nodeIds && !filter.nodeIds.includes(node.id)) {
            return false;
          }
          return true;
        });
        return filteredNodes.length > 0
          ? { type: 'node_update', nodes: filteredNodes }
          : null;

      case 'position_update':
        if (filter.messageTypes && !filter.messageTypes.includes('position')) {
          return null;
        }
        const filteredPositions = message.positions.filter((pos) => {
          if (filter.nodeIds && !filter.nodeIds.includes(pos.nodeId)) {
            return false;
          }
          if (filter.bounds && !matchesFilter(pos.nodeId, pos, filter)) {
            return false;
          }
          return true;
        });
        return filteredPositions.length > 0
          ? { type: 'position_update', positions: filteredPositions }
          : null;

      case 'message':
        if (filter.messageTypes && !filter.messageTypes.includes('message')) {
          return null;
        }
        const filteredMessages = message.messages.filter((msg) => {
          if (filter.nodeIds) {
            return (
              filter.nodeIds.includes(msg.fromId) ||
              filter.nodeIds.includes(msg.toId)
            );
          }
          return true;
        });
        return filteredMessages.length > 0
          ? { type: 'message', messages: filteredMessages }
          : null;

      default:
        // Pass through other message types
        return message;
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      pendingNodes: this.pendingUpdates.nodes.size,
      pendingPositions: this.pendingUpdates.positions.length,
      pendingTelemetry: this.pendingUpdates.telemetry.length,
      pendingMessages: this.pendingUpdates.messages.length,
      broadcastIntervalMs: this.broadcastIntervalMs
    };
  }

  /**
   * Shutdown broadcaster
   */
  shutdown(): void {
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }

    // Flush remaining updates
    this.flushUpdates();

    console.log('Broadcaster shutdown complete');
  }
}
