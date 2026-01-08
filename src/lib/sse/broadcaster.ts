/**
 * SSE Broadcaster
 *
 * Broadcasts updates to connected SSE clients with throttling
 * Replaces WebSocket broadcaster with simpler SSE-based approach
 */

import { getDatabase } from '@/lib/db';
import { NodeRepository, PositionRepository, MessageRepository } from '@/lib/db/db';
import type {
  NodeUpdate,
  PositionUpdate,
  TelemetryUpdate,
  MessageUpdate,
  MQTTRawPacket,
  SnapshotData,
} from '@/lib/websocket/protocol';
import {
  dbNodeToUpdate,
  dbPositionToUpdate,
  dbMessageToUpdate,
} from '@/lib/websocket/protocol';

// SSE Event types
export type SSEEventType =
  | 'connected'
  | 'snapshot'
  | 'node_update'
  | 'position_update'
  | 'telemetry_update'
  | 'message'
  | 'mqtt_raw'
  | 'ping';

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: number;
}

// Client controller for SSE stream
interface SSEClient {
  id: string;
  controller: ReadableStreamDefaultController;
  connectedAt: number;
}

export class SSEBroadcaster {
  private clients = new Map<string, SSEClient>();
  private nodeRepo: NodeRepository;
  private posRepo: PositionRepository;
  private msgRepo: MessageRepository;

  // Throttling - batch updates
  private pendingUpdates = {
    nodes: new Map<string, NodeUpdate>(),
    positions: [] as PositionUpdate[],
    telemetry: [] as TelemetryUpdate[],
    messages: [] as MessageUpdate[],
    mqttRaw: [] as MQTTRawPacket[]
  };
  private broadcastTimer: NodeJS.Timeout | null = null;
  private broadcastIntervalMs = 100; // Broadcast every 100ms
  private mqttPacketId = 0;
  private pingTimer: NodeJS.Timeout | null = null;

  constructor() {
    const db = getDatabase();
    this.nodeRepo = new NodeRepository(db);
    this.posRepo = new PositionRepository(db);
    this.msgRepo = new MessageRepository(db);

    this.startBroadcastTimer();
    this.startPingTimer();
  }

  /**
   * Add a new SSE client
   */
  addClient(id: string, controller: ReadableStreamDefaultController): void {
    this.clients.set(id, {
      id,
      controller,
      connectedAt: Date.now()
    });
    console.log(`[SSE] Client connected: ${id} (${this.clients.size} total)`);
  }

  /**
   * Remove an SSE client
   */
  removeClient(id: string): void {
    this.clients.delete(id);
    console.log(`[SSE] Client disconnected: ${id} (${this.clients.size} remaining)`);
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
   * Queue a raw MQTT packet for live stream broadcast
   */
  queueMQTTRaw(topic: string, payload: string, parsedType: string, nodeId?: string, data?: unknown): void {
    this.mqttPacketId++;
    this.pendingUpdates.mqttRaw.push({
      id: this.mqttPacketId,
      topic,
      payload,
      timestamp: Date.now(),
      parsedType,
      nodeId,
      data
    });
  }

  /**
   * Send initial snapshot to a specific client
   */
  sendSnapshot(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

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

      this.sendToClient(client, {
        type: 'snapshot',
        data: snapshot,
        timestamp: Date.now()
      });

      console.log(`[SSE] Sent snapshot to ${clientId}: ${nodes.length} nodes, ${positions.length} positions`);
    } catch (error) {
      console.error('[SSE] Error sending snapshot:', error);
    }
  }

  /**
   * Send event to a specific client
   */
  private sendToClient(client: SSEClient, event: SSEEvent): void {
    try {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      client.controller.enqueue(data);
    } catch (error) {
      // Client likely disconnected, remove it
      console.error(`[SSE] Error sending to ${client.id}, removing client`);
      this.clients.delete(client.id);
    }
  }

  /**
   * Broadcast event to all connected clients
   */
  private broadcast(event: SSEEvent): void {
    const data = `data: ${JSON.stringify(event)}\n\n`;

    for (const [id, client] of this.clients) {
      try {
        client.controller.enqueue(data);
      } catch (error) {
        // Client likely disconnected, remove it
        console.error(`[SSE] Error broadcasting to ${id}, removing client`);
        this.clients.delete(id);
      }
    }
  }

  /**
   * Start broadcast timer for batching updates
   */
  private startBroadcastTimer(): void {
    this.broadcastTimer = setInterval(() => {
      this.flushUpdates();
    }, this.broadcastIntervalMs);
  }

  /**
   * Start ping timer to keep connections alive
   */
  private startPingTimer(): void {
    // Send ping every 30 seconds
    this.pingTimer = setInterval(() => {
      this.broadcast({
        type: 'ping',
        data: null,
        timestamp: Date.now()
      });
    }, 30000);
  }

  /**
   * Flush pending updates to all clients
   */
  private flushUpdates(): void {
    // Nothing to broadcast
    if (
      this.pendingUpdates.nodes.size === 0 &&
      this.pendingUpdates.positions.length === 0 &&
      this.pendingUpdates.telemetry.length === 0 &&
      this.pendingUpdates.messages.length === 0 &&
      this.pendingUpdates.mqttRaw.length === 0
    ) {
      return;
    }

    const now = Date.now();

    // Broadcast node updates
    if (this.pendingUpdates.nodes.size > 0) {
      const nodes = Array.from(this.pendingUpdates.nodes.values());
      this.broadcast({
        type: 'node_update',
        data: { nodes },
        timestamp: now
      });
      this.pendingUpdates.nodes.clear();
    }

    // Broadcast position updates
    if (this.pendingUpdates.positions.length > 0) {
      this.broadcast({
        type: 'position_update',
        data: { positions: this.pendingUpdates.positions },
        timestamp: now
      });
      this.pendingUpdates.positions = [];
    }

    // Broadcast telemetry updates
    if (this.pendingUpdates.telemetry.length > 0) {
      this.broadcast({
        type: 'telemetry_update',
        data: { telemetry: this.pendingUpdates.telemetry },
        timestamp: now
      });
      this.pendingUpdates.telemetry = [];
    }

    // Broadcast messages
    if (this.pendingUpdates.messages.length > 0) {
      this.broadcast({
        type: 'message',
        data: { messages: this.pendingUpdates.messages },
        timestamp: now
      });
      this.pendingUpdates.messages = [];
    }

    // Broadcast raw MQTT packets for live stream
    if (this.pendingUpdates.mqttRaw.length > 0) {
      this.broadcast({
        type: 'mqtt_raw',
        data: { packets: this.pendingUpdates.mqttRaw },
        timestamp: now
      });
      this.pendingUpdates.mqttRaw = [];
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      clients: this.clients.size,
      pendingNodes: this.pendingUpdates.nodes.size,
      pendingPositions: this.pendingUpdates.positions.length,
      pendingTelemetry: this.pendingUpdates.telemetry.length,
      pendingMessages: this.pendingUpdates.messages.length,
      pendingMqttRaw: this.pendingUpdates.mqttRaw.length,
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
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    // Flush remaining updates
    this.flushUpdates();

    // Close all client connections
    for (const [id, client] of this.clients) {
      try {
        client.controller.close();
      } catch {
        // Ignore errors during shutdown
      }
      this.clients.delete(id);
    }

    console.log('[SSE] Broadcaster shutdown complete');
  }
}
