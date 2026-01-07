/**
 * WebSocket Manager
 *
 * Real-time updates from Meshtastic via WebSocket
 */

import { transformNode, transformMessage, type APINode, type APIMessage } from "./transformers";
import type { Node, Message, NodeRole } from "@/types";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transform NodeUpdate (flat format from WebSocket) to Node
 * Handles both NodeUpdate format and APINode format
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
    role: ((data.role as string) || "CLIENT") as NodeRole,
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
// WebSocket Event Types
// ============================================================================

export type WebSocketEventType =
  | "node.update"
  | "node.new"
  | "message.new"
  | "device.stats"
  | "device.connection"
  | "mqtt_raw"
  | "error";

export interface WebSocketEvent {
  type: WebSocketEventType;
  data: unknown;
  timestamp: number;
}

export interface NodeUpdateEvent extends WebSocketEvent {
  type: "node.update" | "node.new";
  data: APINode;
}

export interface NewMessageEvent extends WebSocketEvent {
  type: "message.new";
  data: APIMessage;
}

export interface DeviceStatsEvent extends WebSocketEvent {
  type: "device.stats";
  data: {
    messagesReceived: number;
    messagesSent: number;
    nodesInMesh: number;
    channelUtilization: number;
    airUtilTx: number;
  };
}

export interface ConnectionEvent extends WebSocketEvent {
  type: "device.connection";
  data: {
    connected: boolean;
    reason?: string;
  };
}

export interface WSErrorEvent extends WebSocketEvent {
  type: "error";
  data: {
    message: string;
    code?: string;
  };
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
  "device.stats": EventHandler<DeviceStatsEvent["data"]>[];
  "device.connection": EventHandler<ConnectionEvent["data"]>[];
  "mqtt_raw": EventHandler<MQTTRawPacket[]>[];
  error: EventHandler<WSErrorEvent["data"]>[];
}

// Type to extract handler data type from event type
type EventDataType<T extends WebSocketEventType> =
  T extends "node.update" ? Node :
  T extends "node.new" ? Node :
  T extends "message.new" ? Message :
  T extends "device.stats" ? DeviceStatsEvent["data"] :
  T extends "device.connection" ? ConnectionEvent["data"] :
  T extends "mqtt_raw" ? MQTTRawPacket[] :
  T extends "error" ? WSErrorEvent["data"] :
  unknown;

// ============================================================================
// WebSocket Manager Class
// ============================================================================

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
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
    this.url = url || this.getWebSocketURL();
  }

  /**
   * Get WebSocket URL from environment or default
   */
  private getWebSocketURL(): string {
    if (typeof window === "undefined") {
      return "ws://localhost:3001/api/ws";
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (wsUrl) return wsUrl;

    // Construct from current location
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}/api/ws`;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    console.log(`[WS Client] connect() called, current ws readyState: ${this.ws?.readyState}`);
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log(`[WS Client] Already connected, skipping`);
      return;
    }

    this.isIntentionallyClosed = false;

    try {
      // Only log the first connection attempt, not reconnects
      if (this.reconnectAttempts === 0) {
        console.log(`Connecting to WebSocket: ${this.url}`);
      }
      this.ws = new WebSocket(this.url);
      console.log(`[WS Client] Created new WebSocket, readyState: ${this.ws.readyState}`);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    } catch (error) {
      if (this.reconnectAttempts === 0) {
        console.warn("Failed to create WebSocket connection:", error);
      }
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    console.log(`[WS Client] disconnect() called`);
    console.trace("[WS Client] disconnect() stack trace");
    this.isIntentionallyClosed = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.reconnectAttempts = 0;
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Subscribe to WebSocket events
   */
  on<T extends WebSocketEventType>(
    event: T,
    handler: EventHandler<EventDataType<T>>
  ): () => void {
    (this.handlers[event] as EventHandler<EventDataType<T>>[]).push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers[event] as EventHandler<EventDataType<T>>[];
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  /**
   * Unsubscribe from WebSocket events
   */
  off<T extends WebSocketEventType>(event: T, handler: EventHandler<EventDataType<T>>): void {
    const handlers = this.handlers[event] as EventHandler<EventDataType<T>>[];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log("WebSocket connected");
    this.reconnectAttempts = 0;

    // Notify connection established
    this.emit("device.connection", { connected: true });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      // Handle both string and Blob data
      if (event.data instanceof Blob) {
        // Convert Blob to text, then parse
        event.data.text().then(text => {
          this.processMessage(text);
        }).catch(err => {
          console.error("Failed to read WebSocket Blob:", err);
        });
        return;
      }

      this.processMessage(event.data);
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  }

  /**
   * Process parsed WebSocket message
   */
  private processMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        // Handle server format (node_update, message, etc.)
        case "node_update": {
          // Server sends { type: 'node_update', nodes: [...] }
          if (message.nodes && Array.isArray(message.nodes)) {
            for (const nodeData of message.nodes) {
              const node = transformNodeUpdate(nodeData);
              this.emit("node.update", node);
            }
          }
          break;
        }

        case "message": {
          // Server sends { type: 'message', messages: [...] }
          if (message.messages && Array.isArray(message.messages)) {
            for (const msgData of message.messages) {
              const transformedMessage = transformMessage(msgData);
              this.emit("message.new", transformedMessage);
            }
          }
          break;
        }

        case "snapshot": {
          // Handle initial snapshot
          console.log("WebSocket: Received snapshot message, parsing...");
          if (message.data) {
            const { nodes, positions, recentMessages } = message.data;
            console.log(`WebSocket: Snapshot has ${nodes?.length || 0} nodes, ${positions?.length || 0} positions, ${recentMessages?.length || 0} messages`);
            // Emit nodes
            if (nodes && Array.isArray(nodes)) {
              for (const nodeData of nodes) {
                const node = transformNodeUpdate(nodeData);
                this.emit("node.new", node);
              }
            }
            // Emit recent messages
            if (recentMessages && Array.isArray(recentMessages)) {
              for (const msgData of recentMessages) {
                const transformedMessage = transformMessage(msgData);
                this.emit("message.new", transformedMessage);
              }
            }
            console.log("WebSocket: Snapshot processed successfully, connection should stay open");
          }
          break;
        }

        case "mqtt_raw": {
          // Handle MQTT raw packets for live stream
          if (message.packets && Array.isArray(message.packets)) {
            this.emit("mqtt_raw", message.packets);
          }
          break;
        }

        case "pong": {
          // Ping-pong heartbeat
          break;
        }

        case "error": {
          console.error("WebSocket error event:", message);
          this.emit("error", {
            message: message.error || "Unknown error",
            code: message.code,
          });
          break;
        }

        // Legacy format support (message.new, node.update, etc.)
        case "node.update":
        case "node.new": {
          const nodeEvent = message as NodeUpdateEvent;
          const node = transformNodeUpdate(nodeEvent.data as unknown as Record<string, unknown>);
          this.emit(message.type, node);
          break;
        }

        case "message.new": {
          const msgEvent = message as NewMessageEvent;
          const transformedMessage = transformMessage(msgEvent.data);
          this.emit("message.new", transformedMessage);
          break;
        }

        case "device.stats": {
          const statsEvent = message as DeviceStatsEvent;
          this.emit("device.stats", statsEvent.data);
          break;
        }

        case "device.connection": {
          const connEvent = message as ConnectionEvent;
          this.emit("device.connection", connEvent.data);
          break;
        }

        default:
          // Silent for unknown types - could be position_update, telemetry_update, etc.
          // console.warn("Unknown WebSocket event type:", message.type);
          break;
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  }

  /**
   * Handle WebSocket error
   */
  private handleError(event: Event): void {
    // Only log the first error, not repeated ones during reconnection
    if (this.reconnectAttempts === 0) {
      console.warn("WebSocket connection unavailable - real-time updates disabled");
    }
    this.emit("error", {
      message: "WebSocket connection error",
      code: "WS_ERROR",
    });
  }

  /**
   * Handle WebSocket close
   */
  private handleClose(event: CloseEvent): void {
    // Always log close with details
    console.log(`WebSocket closed: code=${event.code}, reason="${event.reason || 'none'}", wasClean=${event.wasClean}`);

    // Notify disconnection
    this.emit("device.connection", {
      connected: false,
      reason: event.reason || "Connection closed",
    });

    // Attempt to reconnect if not intentionally closed
    if (!this.isIntentionallyClosed && event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Only log once when max attempts reached
      if (this.reconnectAttempts === this.maxReconnectAttempts) {
        console.log("WebSocket: Max reconnect attempts reached, real-time updates unavailable");
      }
      this.emit("error", {
        message: "Failed to reconnect after maximum attempts",
        code: "MAX_RECONNECT_ATTEMPTS",
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    // Only log first reconnection attempt
    if (this.reconnectAttempts === 1) {
      console.log(`WebSocket: Attempting to reconnect...`);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Emit event to registered handlers
   */
  private emit<T extends WebSocketEventType>(event: T, data: unknown): void {
    const handlers = this.handlers[event] as EventHandler<unknown>[];
    handlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in ${event} handler:`, error);
      }
    });
  }

  /**
   * Send message to server
   */
  send(data: unknown): boolean {
    if (!this.isConnected()) {
      console.warn("Cannot send message: WebSocket not connected");
      return false;
    }

    try {
      this.ws!.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
      return false;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let wsManager: WebSocketManager | null = null;

/**
 * Get or create WebSocket manager singleton
 */
export function getWebSocketManager(url?: string): WebSocketManager {
  if (!wsManager) {
    console.log("[WS Client] Creating new WebSocketManager singleton");
    wsManager = new WebSocketManager(url);
  } else {
    console.log("[WS Client] Reusing existing WebSocketManager singleton");
  }
  return wsManager;
}

/**
 * Reset WebSocket manager (useful for testing)
 */
export function resetWebSocketManager(): void {
  if (wsManager) {
    wsManager.disconnect();
    wsManager = null;
  }
}
