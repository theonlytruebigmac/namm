/**
 * MQTT Manager
 *
 * Connects to MQTT brokers to receive Meshtastic mesh data
 * Supports standard Meshtastic MQTT topics including encrypted messages
 */

import mqtt, { type MqttClient, type IClientOptions } from "mqtt";
import { transformNode, transformMessage, type APINode, type APIMessage } from "./transformers";
import { processMQTTMessage } from "@/lib/mqtt-processor";
import type { Node, Message } from "@/types";

// ============================================================================
// MQTT Configuration Types
// ============================================================================

export interface MQTTConfig {
  brokerUrl: string;
  username?: string;
  password?: string;
  clientId?: string;
  rootTopic?: string; // Default: "msh"
  region?: string; // e.g., "US", "EU", etc.
  useTLS?: boolean;
  reconnectPeriod?: number;
}

// ============================================================================
// Meshtastic MQTT Topic Structure
// ============================================================================

/**
 * Meshtastic MQTT topics follow this pattern:
 * msh/{region}/{gatewayId}/{channel}/{messageType}
 *
 * Examples:
 * - msh/US/2/c/LongFast (encrypted channel messages)
 * - msh/US/2/e/MyNode (encrypted private messages)
 * - msh/US/2/stat/!12345678 (node statistics)
 * - msh/US/2/map/!12345678 (position updates)
 */

export type MeshtasticTopicType =
  | "c" // Channel messages (encrypted)
  | "e" // Direct messages (encrypted)
  | "stat" // Node statistics
  | "map" // Position/map data
  | "2/json" // JSON messages (some configurations);

// ============================================================================
// MQTT Event Types
// ============================================================================

export type MQTTEventType =
  | "mqtt.connected"
  | "mqtt.disconnected"
  | "mqtt.message"
  | "mqtt.node.update"
  | "mqtt.node.position"
  | "mqtt.node.telemetry"
  | "mqtt.error";

export interface MQTTEvent {
  type: MQTTEventType;
  data: unknown;
  timestamp: number;
  topic?: string;
}

export interface MQTTMessageEvent extends MQTTEvent {
  type: "mqtt.message";
  data: Message;
  topic: string;
}

export interface MQTTNodeUpdateEvent extends MQTTEvent {
  type: "mqtt.node.update";
  data: Node;
  topic: string;
}

export interface MQTTNodePositionEvent extends MQTTEvent {
  type: "mqtt.node.position";
  data: {
    nodeId: string;
    latitude: number;
    longitude: number;
    altitude?: number;
    timestamp: number;
  };
  topic: string;
}

export interface MQTTNodeTelemetryEvent extends MQTTEvent {
  type: "mqtt.node.telemetry";
  data: {
    nodeId: string;
    batteryLevel?: number;
    voltage?: number;
    channelUtilization?: number;
    airUtilTx?: number;
    timestamp: number;
  };
  topic: string;
}

export interface MQTTErrorEvent extends MQTTEvent {
  type: "mqtt.error";
  data: {
    message: string;
    code?: string;
  };
}

// ============================================================================
// Event Handlers
// ============================================================================

export type MQTTEventHandler<T = unknown> = (data: T, topic?: string) => void;

interface MQTTEventHandlers {
  "mqtt.connected": MQTTEventHandler<void>[];
  "mqtt.disconnected": MQTTEventHandler<{ reason?: string }>[];
  "mqtt.message": MQTTEventHandler<Message>[];
  "mqtt.node.update": MQTTEventHandler<Node>[];
  "mqtt.node.position": MQTTEventHandler<MQTTNodePositionEvent["data"]>[];
  "mqtt.node.telemetry": MQTTEventHandler<MQTTNodeTelemetryEvent["data"]>[];
  "mqtt.error": MQTTEventHandler<MQTTErrorEvent["data"]>[];
}

// ============================================================================
// MQTT Manager Class
// ============================================================================

export class MQTTManager {
  private client: MqttClient | null = null;
  private config: MQTTConfig;
  private handlers: MQTTEventHandlers = {
    "mqtt.connected": [],
    "mqtt.disconnected": [],
    "mqtt.message": [],
    "mqtt.node.update": [],
    "mqtt.node.position": [],
    "mqtt.node.telemetry": [],
    "mqtt.error": [],
  };
  private isIntentionallyClosed = false;
  private subscribedTopics: Set<string> = new Set();

  constructor(config: MQTTConfig) {
    this.config = {
      rootTopic: "msh",
      region: "US",
      reconnectPeriod: 5000,
      useTLS: false,
      ...config,
    };
  }

  /**
   * Connect to MQTT broker
   */
  connect(): void {
    if (this.client && this.client.connected) {
      console.log("MQTT already connected");
      this.emit("mqtt.connected", undefined);
      return;
    }

    this.isIntentionallyClosed = false;

    const options: IClientOptions = {
      clientId: this.config.clientId || `meshtastic_${Math.random().toString(16).slice(2, 10)}`,
      username: this.config.username,
      password: this.config.password,
      reconnectPeriod: this.config.reconnectPeriod,
      clean: true,
      keepalive: 60,
    };

    console.log(`Connecting to MQTT broker: ${this.config.brokerUrl}`, options);
    this.client = mqtt.connect(this.config.brokerUrl, options);

    this.client.on("connect", () => {
      console.log("✅ MQTT connected successfully");
      this.emit("mqtt.connected", undefined);
      this.subscribeToDefaultTopics();
    });

    this.client.on("message", (topic, payload) => {
      console.log(`📨 MQTT message received on topic: ${topic}`);
      this.handleMessage(topic, payload);
    });

    this.client.on("error", (error) => {
      console.error("❌ MQTT error:", error);
      this.emit("mqtt.error", {
        message: error.message,
        code: error.name,
      });
    });

    this.client.on("close", () => {
      console.log("MQTT connection closed");
      if (!this.isIntentionallyClosed) {
        this.emit("mqtt.disconnected", { reason: "Connection lost" });
      }
    });

    this.client.on("offline", () => {
      console.log("MQTT client offline");
      this.emit("mqtt.disconnected", { reason: "Client offline" });
    });
  }

  /**
   * Disconnect from MQTT broker
   */
  disconnect(): void {
    if (!this.client) return;

    this.isIntentionallyClosed = true;
    this.client.end(true);
    this.client = null;
    this.subscribedTopics.clear();
    this.emit("mqtt.disconnected", { reason: "User disconnected" });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client?.connected || false;
  }

  /**
   * Subscribe to default Meshtastic topics
   */
  private subscribeToDefaultTopics(): void {
    const { rootTopic, region } = this.config;

    // Subscribe to all messages in the region
    const topics = [
      `${rootTopic}/${region}/+/c/#`, // All channel messages
      `${rootTopic}/${region}/+/e/#`, // All encrypted messages (protobuf ServiceEnvelope)
      `${rootTopic}/${region}/+/stat/#`, // All node statistics
      `${rootTopic}/${region}/+/map/#`, // All position updates
      `${rootTopic}/${region}/+/2/json/#`, // JSON messages
    ];

    topics.forEach((topic) => this.subscribe(topic));
  }

  /**
   * Subscribe to a specific topic
   */
  subscribe(topic: string): void {
    if (!this.client || !this.client.connected) {
      console.warn("Cannot subscribe: MQTT not connected");
      return;
    }

    this.client.subscribe(topic, (err) => {
      if (err) {
        console.error(`Failed to subscribe to ${topic}:`, err);
        this.emit("mqtt.error", {
          message: `Failed to subscribe to ${topic}`,
          code: err.name,
        });
      } else {
        console.log(`Subscribed to MQTT topic: ${topic}`);
        this.subscribedTopics.add(topic);
      }
    });
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(topic: string): void {
    if (!this.client) return;

    this.client.unsubscribe(topic, (err) => {
      if (err) {
        console.error(`Failed to unsubscribe from ${topic}:`, err);
      } else {
        console.log(`Unsubscribed from MQTT topic: ${topic}`);
        this.subscribedTopics.delete(topic);
      }
    });
  }

  /**
   * Handle incoming MQTT message
   */
  private handleMessage(topic: string, payload: Buffer): void {
    try {
      // Check if this is an encrypted message (binary protobuf)
      if (topic.includes("/e/")) {
        // Encrypted message - pass binary payload directly to processor
        this.handleEncryptedMessage(topic, payload);
        return;
      }

      // For non-encrypted topics, convert to string
      const message = payload.toString();

      // Determine message type from topic
      if (topic.includes("/c/")) {
        // Channel message
        this.handleChannelMessage(topic, message);
      } else if (topic.includes("/stat/")) {
        // Node statistics
        this.handleNodeStats(topic, message);
      } else if (topic.includes("/map/")) {
        // Position update
        this.handlePositionUpdate(topic, message);
      } else if (topic.includes("/json/")) {
        // JSON message
        this.handleJSONMessage(topic, message);
      }
    } catch (error) {
      console.error("Error handling MQTT message:", error);
      this.emit("mqtt.error", {
        message: "Failed to parse MQTT message",
        code: "PARSE_ERROR",
      });
    }
  }

  /**
   * Handle encrypted message (protobuf ServiceEnvelope)
   */
  private handleEncryptedMessage(topic: string, payload: Buffer): void {
    try {
      const result = processMQTTMessage(topic, payload);

      if (!result || !('data' in result) || !result.data) {
        // Decryption failed or unsupported message type
        if (result?.type?.includes('error') || result?.type?.includes('failed')) {
          console.log(`[MQTT] Encrypted message processing: ${result.type}`);
        }
        return;
      }

      // Emit appropriate event based on decrypted message type
      switch (result.type) {
        case 'nodeinfo':
          this.emit("mqtt.node.update", result.data, topic);
          break;
        case 'position':
          this.emit("mqtt.node.position", result.data, topic);
          break;
        case 'telemetry':
          this.emit("mqtt.node.telemetry", result.data, topic);
          break;
        case 'text':
          this.emit("mqtt.message", result.data, topic);
          break;
        default:
          // Other decrypted message types - log for debugging
          console.log(`[MQTT] Decrypted ${result.type} message from ${topic}`);
      }
    } catch (error) {
      console.error("[MQTT] Error processing encrypted message:", error);
    }
  }

  /**
   * Handle channel message
   */
  private handleChannelMessage(topic: string, message: string): void {
    try {
      // Try to parse as JSON first
      const data = JSON.parse(message);

      if (data.type === "text" || data.text) {
        const transformedMessage = transformMessage(data as APIMessage);
        this.emit("mqtt.message", transformedMessage, topic);
      }
    } catch (error) {
      // If not JSON, treat as encrypted/binary - skip for now
      console.log("Received encrypted/binary message on", topic);
    }
  }

  /**
   * Handle node statistics
   */
  private handleNodeStats(topic: string, message: string): void {
    try {
      const data = JSON.parse(message);

      // Extract node ID from topic: msh/US/2/stat/!12345678
      const nodeId = topic.split("/").pop();

      this.emit("mqtt.node.telemetry", {
        nodeId: nodeId || "unknown",
        batteryLevel: data.batteryLevel,
        voltage: data.voltage,
        channelUtilization: data.channelUtilization,
        airUtilTx: data.airUtilTx,
        timestamp: Date.now(),
      }, topic);
    } catch (error) {
      console.error("Error parsing node stats:", error);
    }
  }

  /**
   * Handle position update
   */
  private handlePositionUpdate(topic: string, message: string): void {
    try {
      const data = JSON.parse(message);

      // Extract node ID from topic
      const nodeId = topic.split("/").pop();

      if (data.latitude && data.longitude) {
        this.emit("mqtt.node.position", {
          nodeId: nodeId || "unknown",
          latitude: data.latitude,
          longitude: data.longitude,
          altitude: data.altitude,
          timestamp: Date.now(),
        }, topic);
      }
    } catch (error) {
      console.error("Error parsing position update:", error);
    }
  }

  /**
   * Handle JSON message (newer format)
   */
  private handleJSONMessage(topic: string, message: string): void {
    try {
      const data = JSON.parse(message);

      // Handle based on payload type
      if (data.type === "nodeinfo") {
        const node = transformNode(data as APINode);
        this.emit("mqtt.node.update", node, topic);
      } else if (data.type === "position") {
        this.handlePositionUpdate(topic, message);
      } else if (data.type === "text") {
        const msg = transformMessage(data as APIMessage);
        this.emit("mqtt.message", msg, topic);
      }
    } catch (error) {
      console.error("Error parsing JSON message:", error);
    }
  }

  /**
   * Register event handler
   */
  on<T extends MQTTEventType>(
    event: T,
    handler: MQTTEventHandler
  ): () => void {
    this.handlers[event].push(handler as any);

    // Return unsubscribe function
    return () => {
      this.handlers[event] = this.handlers[event].filter((h) => h !== handler) as any;
    };
  }

  /**
   * Emit event to all registered handlers
   */
  private emit<T extends MQTTEventType>(
    event: T,
    data: any,
    topic?: string
  ): void {
    this.handlers[event].forEach((handler) => {
      try {
        handler(data, topic);
      } catch (error) {
        console.error(`Error in MQTT event handler for ${event}:`, error);
      }
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): MQTTConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (requires reconnect)
   */
  updateConfig(config: Partial<MQTTConfig>): void {
    const wasConnected = this.isConnected();

    if (wasConnected) {
      this.disconnect();
    }

    this.config = { ...this.config, ...config };

    if (wasConnected) {
      this.connect();
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let mqttManagerInstance: MQTTManager | null = null;

/**
 * Get or create MQTT manager singleton
 */
export function getMQTTManager(config?: MQTTConfig): MQTTManager {
  if (typeof window === "undefined") {
    // Server-side: return a mock manager
    return {
      connect: () => {},
      disconnect: () => {},
      isConnected: () => false,
      subscribe: () => {},
      unsubscribe: () => {},
      on: () => () => {},
      getConfig: () => ({}),
      updateConfig: () => {},
    } as any;
  }

  if (!mqttManagerInstance && config) {
    mqttManagerInstance = new MQTTManager(config);
  }

  if (!mqttManagerInstance) {
    throw new Error("MQTT Manager not initialized. Provide config on first call.");
  }

  return mqttManagerInstance;
}

/**
 * Reset MQTT manager (useful for testing)
 */
export function resetMQTTManager(): void {
  if (mqttManagerInstance) {
    mqttManagerInstance.disconnect();
    mqttManagerInstance = null;
  }
}
