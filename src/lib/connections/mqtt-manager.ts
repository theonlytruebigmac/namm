/**
 * Multi-Connection MQTT Manager
 *
 * Manages multiple MQTT connections simultaneously.
 * Each connection has its own client, subscriptions, and event handlers.
 */

import mqtt, { type MqttClient, type IClientOptions } from "mqtt";
import type {
  MQTTConnectionConfig,
  ConnectionState,
  ConnectionStatus
} from "./types";
import { processMQTTMessage } from "@/lib/mqtt-processor";
import type { Node, Message } from "@/types";

// ============================================================================
// Event Types
// ============================================================================

export type MultiMQTTEventType =
  | "mqtt.connected"
  | "mqtt.disconnected"
  | "mqtt.message"
  | "mqtt.node.update"
  | "mqtt.node.position"
  | "mqtt.node.telemetry"
  | "mqtt.traceroute"
  | "mqtt.error";

export type MultiMQTTEventHandler<T = unknown> = (
  connectionId: string,
  data: T,
  topic?: string
) => void;

interface EventHandlers {
  "mqtt.connected": MultiMQTTEventHandler<void>[];
  "mqtt.disconnected": MultiMQTTEventHandler<{ reason?: string }>[];
  "mqtt.message": MultiMQTTEventHandler<Message>[];
  "mqtt.node.update": MultiMQTTEventHandler<Node>[];
  "mqtt.node.position": MultiMQTTEventHandler<any>[];
  "mqtt.node.telemetry": MultiMQTTEventHandler<any>[];
  "mqtt.traceroute": MultiMQTTEventHandler<any>[];
  "mqtt.error": MultiMQTTEventHandler<{ message: string; code?: string }>[];
}

// ============================================================================
// Connection Instance
// ============================================================================

interface MQTTConnectionInstance {
  config: MQTTConnectionConfig;
  client: MqttClient | null;
  state: ConnectionState;
  subscribedTopics: Set<string>;
}

// Common WebSocket ports for MQTT brokers
const MQTT_WS_PORT_MAPPINGS: Record<number, number> = {
  1883: 8083,   // Standard MQTT -> WebSocket
  8883: 8084,   // MQTT TLS -> WebSocket TLS (varies by broker)
};

// ============================================================================
// Multi MQTT Manager Class
// ============================================================================

export class MultiMQTTManager {
  private connections: Map<string, MQTTConnectionInstance> = new Map();
  private handlers: EventHandlers = {
    "mqtt.connected": [],
    "mqtt.disconnected": [],
    "mqtt.message": [],
    "mqtt.node.update": [],
    "mqtt.node.position": [],
    "mqtt.node.telemetry": [],
    "mqtt.traceroute": [],
    "mqtt.error": [],
  };

  constructor() {
    console.log("🔌 MultiMQTTManager initialized");
  }

  /**
   * Convert MQTT URL to WebSocket URL for browser compatibility
   * Browsers can only connect via WebSocket, not native MQTT protocol.
   *
   * Common broker WebSocket ports:
   * - Mosquitto: 9001 (ws) or 9002 (wss)
   * - EMQX: 8083 (ws) or 8084 (wss)
   * - HiveMQ: 8000 (ws) or 8884 (wss)
   *
   * Note: If connection fails, the broker may use a different WS port.
   * Check your broker's configuration for the WebSocket port.
   */
  private convertToWebSocketUrl(url: string): string {
    // Already a WebSocket URL - use as-is
    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      return url;
    }

    try {
      // Parse the URL
      let parsedUrl: URL;

      if (url.startsWith('mqtt://')) {
        // Replace mqtt:// with ws:// for parsing
        parsedUrl = new URL(url.replace('mqtt://', 'ws://'));
      } else if (url.startsWith('mqtts://')) {
        // Replace mqtts:// with wss:// for parsing
        parsedUrl = new URL(url.replace('mqtts://', 'wss://'));
      } else {
        // Assume ws:// if no protocol
        parsedUrl = new URL(`ws://${url}`);
      }

      const originalPort = parseInt(parsedUrl.port) || 1883;

      // Map common MQTT ports to WebSocket ports
      const wsPort = MQTT_WS_PORT_MAPPINGS[originalPort] || originalPort;

      if (wsPort !== originalPort) {
        console.log(`⚠️ Converting MQTT port ${originalPort} to WebSocket port ${wsPort}`);
        console.log(`   If connection fails, check your broker's WebSocket port configuration.`);
        parsedUrl.port = wsPort.toString();
      }

      return parsedUrl.toString();
    } catch (error) {
      console.error('Failed to parse broker URL:', url, error);
      // Return original URL and let mqtt.js handle it
      return url;
    }
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  /**
   * Add a new MQTT connection configuration
   */
  addConnection(config: MQTTConnectionConfig): void {
    if (this.connections.has(config.id)) {
      console.warn(`Connection ${config.id} already exists`);
      return;
    }

    const instance: MQTTConnectionInstance = {
      config,
      client: null,
      state: {
        id: config.id,
        status: "disconnected",
        messagesReceived: 0,
        messagesSent: 0,
        bytesReceived: 0,
        bytesSent: 0,
      },
      subscribedTopics: new Set(),
    };

    this.connections.set(config.id, instance);
    console.log(`➕ Added MQTT connection: ${config.name} (${config.id})`);

    // Auto-connect if enabled
    if (config.enabled && config.autoConnect) {
      this.connect(config.id);
    }
  }

  /**
   * Remove an MQTT connection
   */
  removeConnection(connectionId: string): void {
    const instance = this.connections.get(connectionId);
    if (!instance) return;

    // Disconnect first
    this.disconnect(connectionId);
    this.connections.delete(connectionId);
    console.log(`➖ Removed MQTT connection: ${connectionId}`);
  }

  /**
   * Update connection configuration
   */
  updateConnection(connectionId: string, updates: Partial<MQTTConnectionConfig>): void {
    const instance = this.connections.get(connectionId);
    if (!instance) return;

    const wasConnected = instance.state.status === "connected";

    // Disconnect if connected
    if (wasConnected) {
      this.disconnect(connectionId);
    }

    // Update config
    instance.config = { ...instance.config, ...updates } as MQTTConnectionConfig;

    // Reconnect if was connected
    if (wasConnected && instance.config.enabled) {
      this.connect(connectionId);
    }
  }

  /**
   * Connect to a specific MQTT server
   */
  connect(connectionId: string): void {
    const instance = this.connections.get(connectionId);
    if (!instance) {
      console.error(`Connection ${connectionId} not found`);
      return;
    }

    if (instance.client?.connected) {
      console.log(`${instance.config.name} already connected`);
      return;
    }

    this.updateStatus(connectionId, "connecting");

    const { config } = instance;

    // Convert broker URL for browser WebSocket compatibility
    const brokerUrl = this.convertToWebSocketUrl(config.brokerUrl);

    const options: IClientOptions = {
      clientId: config.clientId || `namm_${connectionId.slice(-8)}_${Math.random().toString(16).slice(2, 6)}`,
      username: config.username,
      password: config.password,
      reconnectPeriod: 5000,
      clean: true,
      keepalive: 60,
    };

    console.log(`🔌 Connecting to ${config.name}: ${brokerUrl}`);
    instance.client = mqtt.connect(brokerUrl, options);

    // Connection events
    instance.client.on("connect", () => {
      console.log(`✅ ${config.name} connected`);
      this.updateStatus(connectionId, "connected");
      instance.state.connectedAt = Date.now();
      this.emit("mqtt.connected", connectionId, undefined);

      // Subscribe to configured topics
      this.subscribeToUserTopics(connectionId);
    });

    instance.client.on("message", (topic, payload) => {
      instance.state.messagesReceived++;
      instance.state.bytesReceived += payload.length;
      instance.state.lastActivity = Date.now();
      this.handleMessage(connectionId, topic, payload);
    });

    instance.client.on("error", (error) => {
      console.error(`❌ ${config.name} error:`, error);
      this.updateStatus(connectionId, "error", error.message);
      this.emit("mqtt.error", connectionId, {
        message: error.message,
        code: error.name,
      });
    });

    instance.client.on("close", () => {
      console.log(`${config.name} connection closed`);
      if (instance.state.status !== "disconnected") {
        this.updateStatus(connectionId, "reconnecting");
        this.emit("mqtt.disconnected", connectionId, { reason: "Connection lost" });
      }
    });

    instance.client.on("reconnect", () => {
      console.log(`${config.name} reconnecting...`);
      this.updateStatus(connectionId, "reconnecting");
    });
  }

  /**
   * Disconnect from a specific MQTT server
   */
  disconnect(connectionId: string): void {
    const instance = this.connections.get(connectionId);
    if (!instance?.client) return;

    instance.client.end(true);
    instance.client = null;
    instance.subscribedTopics.clear();
    this.updateStatus(connectionId, "disconnected");
    this.emit("mqtt.disconnected", connectionId, { reason: "User disconnected" });
    console.log(`🔌 ${instance.config.name} disconnected`);
  }

  /**
   * Connect all enabled connections
   */
  connectAll(): void {
    for (const [id, instance] of this.connections) {
      if (instance.config.enabled) {
        this.connect(id);
      }
    }
  }

  /**
   * Disconnect all connections
   */
  disconnectAll(): void {
    for (const id of this.connections.keys()) {
      this.disconnect(id);
    }
  }

  // ==========================================================================
  // Topic Subscriptions
  // ==========================================================================

  /**
   * Subscribe to user-defined topics for a connection
   */
  private subscribeToUserTopics(connectionId: string): void {
    const instance = this.connections.get(connectionId);
    if (!instance?.client?.connected) return;

    // Subscribe to all user-defined topics
    for (const sub of instance.config.subscriptions) {
      if (sub.enabled) {
        this.subscribe(connectionId, sub.topic);
      }
    }

    if (instance.config.subscriptions.length === 0) {
      console.warn(`⚠️ ${instance.config.name}: No topics configured - add topic subscriptions to receive data`);
    }
  }

  /**
   * Subscribe to a topic on a specific connection
   */
  subscribe(connectionId: string, topic: string): void {
    const instance = this.connections.get(connectionId);
    if (!instance?.client?.connected) {
      console.warn(`Cannot subscribe: ${connectionId} not connected`);
      return;
    }

    instance.client.subscribe(topic, (err) => {
      if (err) {
        console.error(`Failed to subscribe to ${topic} on ${instance.config.name}:`, err);
        this.emit("mqtt.error", connectionId, {
          message: `Failed to subscribe to ${topic}`,
          code: err.name,
        });
      } else {
        console.log(`📥 ${instance.config.name} subscribed: ${topic}`);
        instance.subscribedTopics.add(topic);
      }
    });
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(connectionId: string, topic: string): void {
    const instance = this.connections.get(connectionId);
    if (!instance?.client) return;

    instance.client.unsubscribe(topic, (err) => {
      if (!err) {
        instance.subscribedTopics.delete(topic);
        console.log(`📤 ${instance.config.name} unsubscribed: ${topic}`);
      }
    });
  }

  // ==========================================================================
  // Message Handling
  // ==========================================================================

  /**
   * Handle incoming message
   */
  private handleMessage(connectionId: string, topic: string, payload: Buffer): void {
    const instance = this.connections.get(connectionId);
    if (!instance) return;

    try {
      // Use the existing MQTT processor
      const result = processMQTTMessage(topic, payload);

      if (result && 'data' in result && result.data) {
        // The processor returns { type: string, data: ProcessedXxx }
        switch (result.type) {
          case "text":
            // Text message
            this.emit("mqtt.message", connectionId, result.data, topic);
            break;
          case "nodeinfo":
            // Node info update
            this.emit("mqtt.node.update", connectionId, result.data, topic);
            break;
          case "position":
            // Position update
            this.emit("mqtt.node.position", connectionId, result.data, topic);
            break;
          case "telemetry":
            // Telemetry data
            this.emit("mqtt.node.telemetry", connectionId, result.data, topic);
            break;
          case "traceroute":
            // Traceroute data
            this.emit("mqtt.traceroute", connectionId, result.data, topic);
            break;
        }
      }
    } catch (error) {
      console.error(`Error processing message from ${instance.config.name}:`, error);
    }
  }

  // ==========================================================================
  // Event System
  // ==========================================================================

  /**
   * Register event handler
   */
  on<T = unknown>(
    event: MultiMQTTEventType,
    handler: MultiMQTTEventHandler<T>
  ): () => void {
    const handlers = this.handlers[event] as MultiMQTTEventHandler<T>[];
    handlers.push(handler);
    return () => {
      const index = handlers.indexOf(handler);
      if (index > -1) handlers.splice(index, 1);
    };
  }

  /**
   * Emit event to all handlers
   */
  private emit<T>(
    event: MultiMQTTEventType,
    connectionId: string,
    data: T,
    topic?: string
  ): void {
    const handlers = this.handlers[event] as MultiMQTTEventHandler<T>[];
    handlers.forEach((handler) => {
      try {
        handler(connectionId, data, topic);
      } catch (error) {
        console.error(`Error in ${event} handler:`, error);
      }
    });
  }

  // ==========================================================================
  // Status & Info
  // ==========================================================================

  /**
   * Update connection status
   */
  private updateStatus(connectionId: string, status: ConnectionStatus, error?: string): void {
    const instance = this.connections.get(connectionId);
    if (!instance) return;

    instance.state.status = status;
    instance.state.error = error;
  }

  /**
   * Get connection state
   */
  getConnectionState(connectionId: string): ConnectionState | undefined {
    return this.connections.get(connectionId)?.state;
  }

  /**
   * Get all connection states
   */
  getAllConnectionStates(): ConnectionState[] {
    return Array.from(this.connections.values()).map((i) => i.state);
  }

  /**
   * Get subscribed topics for a connection
   */
  getSubscribedTopics(connectionId: string): string[] {
    return Array.from(this.connections.get(connectionId)?.subscribedTopics || []);
  }

  /**
   * Check if any connection is connected
   */
  hasActiveConnection(): boolean {
    for (const instance of this.connections.values()) {
      if (instance.state.status === "connected") {
        return true;
      }
    }
    return false;
  }

  /**
   * Get count of active connections
   */
  getActiveConnectionCount(): number {
    let count = 0;
    for (const instance of this.connections.values()) {
      if (instance.state.status === "connected") {
        count++;
      }
    }
    return count;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let multiMQTTManagerInstance: MultiMQTTManager | null = null;

/**
 * Get or create MultiMQTTManager singleton
 */
export function getMultiMQTTManager(): MultiMQTTManager {
  if (typeof window === "undefined") {
    // Return mock for SSR
    return new MultiMQTTManager();
  }

  if (!multiMQTTManagerInstance) {
    multiMQTTManagerInstance = new MultiMQTTManager();
  }

  return multiMQTTManagerInstance;
}

/**
 * Reset the manager (for testing)
 */
export function resetMultiMQTTManager(): void {
  if (multiMQTTManagerInstance) {
    multiMQTTManagerInstance.disconnectAll();
    multiMQTTManagerInstance = null;
  }
}
