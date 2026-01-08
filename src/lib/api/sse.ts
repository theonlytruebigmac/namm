/**
 * SSE Client Manager
 *
 * Real-time updates from server via Server-Sent Events
 * Replaces WebSocket client with simpler SSE approach
 */

import { transformNode, transformMessage, type APINode, type APIMessage } from "./transformers";
import type { Node, Message, NodeRole } from "@/types";

// ============================================================================
// Helper Functions
// ============================================================================

// Role mapping for MQTT/SSE data (numeric role to string)
const ROLE_MAP: Record<number, NodeRole> = {
  0: "CLIENT",
  1: "CLIENT_MUTE",
  2: "ROUTER",
  3: "ROUTER_CLIENT",
  4: "REPEATER",
  5: "TRACKER",
  6: "SENSOR",
  7: "TAK",
  8: "CLIENT_HIDDEN",
  9: "LOST_AND_FOUND",
  10: "TAK_TRACKER",
  11: "ROUTER",
  12: "ROUTER_CLIENT",
};

function getRoleString(role?: number | string): NodeRole {
  if (role === undefined) return "CLIENT";
  if (typeof role === "string") return role as NodeRole;
  return ROLE_MAP[role] || "CLIENT";
}

/**
 * Transform NodeUpdate (flat format from SSE) to Node
 */
function transformNodeUpdate(data: Record<string, unknown>): Node {
  // If it has a 'user' property, it's APINode format
  if (data.user) {
    return transformNode(data as unknown as APINode);
  }

  // Otherwise it's NodeUpdate format (flat)
  return {
    id: data.id as string,
    nodeNum: (data.nodeNum as number) || 0,
    shortName: (data.shortName as string) || "Unknown",
    longName: (data.longName as string) || "Unknown Node",
    hwModel: (data.hwModel as string) || "Unknown",
    role: getRoleString(data.role as number | string | undefined),
    batteryLevel: data.batteryLevel as number | undefined,
    voltage: data.voltage as number | undefined,
    channelUtilization: data.channelUtilization as number | undefined,
    airUtilTx: data.airUtilTx as number | undefined,
    uptime: data.uptime as number | undefined,
    lastHeard: (data.lastHeard as number) || Date.now(),
    snr: data.snr as number | undefined,
    rssi: data.rssi as number | undefined,
    hopsAway: data.hopsAway as number | undefined,
    isFavorite: false,
  };
}

// ============================================================================
// SSE Event Types
// ============================================================================

export type SSEEventType =
  | "node.update"
  | "node.new"
  | "message.new"
  | "device.stats"
  | "device.connection"
  | "mqtt_raw"
  | "error";

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: number;
}

// ============================================================================
// Event Handlers
// ============================================================================

export type EventHandler<T = unknown> = (data: T) => void;

// MQTT Raw packet type
export interface MQTTRawPacket {
  id: number;
  topic: string;
  payload: string;
  timestamp: number;
  parsedType: string;
  nodeId?: string;
  data?: unknown;
}

interface EventHandlers {
  "node.update": EventHandler<Node>[];
  "node.new": EventHandler<Node>[];
  "message.new": EventHandler<Message>[];
  "device.stats": EventHandler<Record<string, unknown>>[];
  "device.connection": EventHandler<{ connected: boolean; reason?: string }>[];
  "mqtt_raw": EventHandler<MQTTRawPacket[]>[];
  error: EventHandler<{ message: string; code?: string }>[];
}

// Type to extract handler data type from event type
type EventDataType<T extends SSEEventType> =
  T extends "node.update" ? Node :
  T extends "node.new" ? Node :
  T extends "message.new" ? Message :
  T extends "device.stats" ? Record<string, unknown> :
  T extends "device.connection" ? { connected: boolean; reason?: string } :
  T extends "mqtt_raw" ? MQTTRawPacket[] :
  T extends "error" ? { message: string; code?: string } :
  unknown;

// ============================================================================
// SSE Manager Class
// ============================================================================

export class SSEManager {
  private eventSource: EventSource | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 3000;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private handlers: EventHandlers = {
    "node.update": [],
    "node.new": [],
    "message.new": [],
    "device.stats": [],
    "device.connection": [],
    "mqtt_raw": [],
    error: [],
  };
  private isIntentionallyClosed = false;

  constructor(url?: string) {
    this.url = url || this.getSSEURL();
  }

  /**
   * Get SSE URL from environment or default
   */
  private getSSEURL(): string {
    if (typeof window === "undefined") {
      return "/api/sse/stream";
    }

    const sseUrl = process.env.NEXT_PUBLIC_SSE_URL;
    if (sseUrl) return sseUrl;

    // Use relative URL for SSE
    return "/api/sse/stream";
  }

  /**
   * Connect to SSE stream
   */
  connect(): void {
    if (this.eventSource?.readyState === EventSource.OPEN) {
      console.log("[SSE Client] Already connected, skipping");
      return;
    }

    this.isIntentionallyClosed = false;

    try {
      if (this.reconnectAttempts === 0) {
        console.log(`[SSE Client] Connecting to: ${this.url}`);
      }

      this.eventSource = new EventSource(this.url);

      this.eventSource.onopen = () => {
        console.log("[SSE Client] Connected");
        this.reconnectAttempts = 0;
        this.emit("device.connection", { connected: true });
      };

      this.eventSource.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.eventSource.onerror = (error) => {
        console.error("[SSE Client] Error:", error);

        if (this.eventSource?.readyState === EventSource.CLOSED) {
          this.emit("device.connection", { connected: false, reason: "Connection lost" });
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.warn("[SSE Client] Failed to create EventSource:", error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from SSE stream
   */
  disconnect(): void {
    console.log("[SSE Client] Disconnecting");
    this.isIntentionallyClosed = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.reconnectAttempts = 0;
  }

  /**
   * Check if SSE is connected
   */
  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  /**
   * Subscribe to SSE events
   */
  on<T extends SSEEventType>(
    event: T,
    handler: EventHandler<EventDataType<T>>
  ): () => void {
    (this.handlers[event] as EventHandler<EventDataType<T>>[]).push(handler);

    return () => {
      const handlers = this.handlers[event] as EventHandler<EventDataType<T>>[];
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  /**
   * Unsubscribe from SSE events
   */
  off<T extends SSEEventType>(event: T, handler: EventHandler<EventDataType<T>>): void {
    const handlers = this.handlers[event] as EventHandler<EventDataType<T>>[];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Handle incoming SSE messages
   */
  private handleMessage(data: string): void {
    try {
      const event = JSON.parse(data);
      this.processEvent(event);
    } catch (error) {
      console.error("[SSE Client] Failed to parse message:", error);
    }
  }

  /**
   * Process SSE event
   */
  private processEvent(event: { type: string; data: unknown; timestamp: number }): void {
    switch (event.type) {
      case "connected":
        console.log("[SSE Client] Received connected event");
        break;

      case "ping":
        // Keep-alive ping, no action needed
        break;

      case "snapshot":
        this.handleSnapshot(event.data as {
          nodes: Record<string, unknown>[];
          positions: Record<string, unknown>[];
          recentMessages: Record<string, unknown>[];
        });
        break;

      case "node_update":
        this.handleNodeUpdate(event.data as { nodes: Record<string, unknown>[] });
        break;

      case "position_update":
        this.handlePositionUpdate(event.data as { positions: Record<string, unknown>[] });
        break;

      case "telemetry_update":
        // Telemetry updates node data
        this.handleTelemetryUpdate(event.data as { telemetry: Record<string, unknown>[] });
        break;

      case "message":
        this.handleMessageUpdate(event.data as { messages: Record<string, unknown>[] });
        break;

      case "mqtt_raw":
        this.handleMQTTRaw(event.data as { packets: MQTTRawPacket[] });
        break;

      default:
        // Unknown event type
        break;
    }
  }

  /**
   * Handle initial snapshot
   */
  private handleSnapshot(data: {
    nodes: Record<string, unknown>[];
    positions: Record<string, unknown>[];
    recentMessages: Record<string, unknown>[];
  }): void {
    console.log(`[SSE Client] Received snapshot: ${data.nodes?.length || 0} nodes, ${data.recentMessages?.length || 0} messages`);

    // Emit node updates
    for (const nodeData of data.nodes || []) {
      const node = transformNodeUpdate(nodeData);
      this.emit("node.update", node);
    }

    // Emit message updates
    for (const msgData of data.recentMessages || []) {
      const message = transformMessage(msgData as unknown as APIMessage);
      this.emit("message.new", message);
    }
  }

  /**
   * Handle node updates
   */
  private handleNodeUpdate(data: { nodes: Record<string, unknown>[] }): void {
    for (const nodeData of data.nodes || []) {
      const node = transformNodeUpdate(nodeData);
      this.emit("node.update", node);
    }
  }

  /**
   * Handle position updates (update node with position)
   */
  private handlePositionUpdate(data: { positions: Record<string, unknown>[] }): void {
    for (const posData of data.positions || []) {
      // Emit as node update with position
      const node: Node = {
        id: posData.nodeId as string,
        nodeNum: 0,
        shortName: "",
        longName: "",
        hwModel: "",
        role: "CLIENT" as NodeRole,
        lastHeard: posData.timestamp as number,
        position: {
          latitude: posData.latitude as number,
          longitude: posData.longitude as number,
          altitude: posData.altitude as number | undefined,
        },
        isFavorite: false,
      };
      this.emit("node.update", node);
    }
  }

  /**
   * Handle telemetry updates
   */
  private handleTelemetryUpdate(data: { telemetry: Record<string, unknown>[] }): void {
    for (const telData of data.telemetry || []) {
      const node: Node = {
        id: telData.nodeId as string,
        nodeNum: 0,
        shortName: "",
        longName: "",
        hwModel: "",
        role: "CLIENT" as NodeRole,
        lastHeard: telData.timestamp as number,
        batteryLevel: telData.batteryLevel as number | undefined,
        voltage: telData.voltage as number | undefined,
        channelUtilization: telData.channelUtilization as number | undefined,
        airUtilTx: telData.airUtilTx as number | undefined,
        uptime: telData.uptime as number | undefined,
        isFavorite: false,
      };
      this.emit("node.update", node);
    }
  }

  /**
   * Handle message updates
   */
  private handleMessageUpdate(data: { messages: Record<string, unknown>[] }): void {
    for (const msgData of data.messages || []) {
      const message = transformMessage(msgData as unknown as APIMessage);
      this.emit("message.new", message);
    }
  }

  /**
   * Handle raw MQTT packets
   */
  private handleMQTTRaw(data: { packets: MQTTRawPacket[] }): void {
    this.emit("mqtt_raw", data.packets || []);
  }

  /**
   * Emit event to handlers
   */
  private emit<T extends SSEEventType>(event: T, data: EventDataType<T>): void {
    const handlers = this.handlers[event] as EventHandler<EventDataType<T>>[];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`[SSE Client] Error in ${event} handler:`, error);
      }
    }
  }

  /**
   * Schedule reconnect attempt
   */
  private scheduleReconnect(): void {
    if (this.isIntentionallyClosed) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[SSE Client] Max reconnect attempts reached");
      this.emit("error", {
        message: "Connection lost. Please refresh the page.",
        code: "MAX_RECONNECT",
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);

    console.log(`[SSE Client] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let sseManagerInstance: SSEManager | null = null;

/**
 * Get or create SSE manager singleton
 */
export function getSSEManager(): SSEManager {
  if (typeof window === "undefined") {
    // Return a dummy manager for SSR
    return new SSEManager();
  }

  if (!sseManagerInstance) {
    sseManagerInstance = new SSEManager();
  }
  return sseManagerInstance;
}

/**
 * Reset SSE manager (for testing)
 */
export function resetSSEManager(): void {
  if (sseManagerInstance) {
    sseManagerInstance.disconnect();
    sseManagerInstance = null;
  }
}

// Re-export types for compatibility
export type { EventHandler as SSEEventHandler };
