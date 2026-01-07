/**
 * Multi-Connection Types
 *
 * Supports multiple MQTT servers, Serial connections, and HTTP endpoints
 */

// ============================================================================
// Connection Types
// ============================================================================

export type ConnectionType = "mqtt" | "serial" | "http" | "ble";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"
  | "reconnecting";

// ============================================================================
// Base Connection Config
// ============================================================================

export interface BaseConnectionConfig {
  id: string;
  name: string;
  type: ConnectionType;
  enabled: boolean;
  autoConnect: boolean;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// MQTT Connection Config
// ============================================================================

export interface MQTTConnectionConfig extends BaseConnectionConfig {
  type: "mqtt";
  brokerUrl: string;
  username?: string;
  password?: string;
  clientId?: string;
  useTLS: boolean;

  // Topic subscriptions - user defines full topics
  subscriptions: MQTTSubscription[];
}

export interface MQTTSubscription {
  id: string;
  topic: string;
  description?: string;
  enabled: boolean;
}

// ============================================================================
// Serial Connection Config
// ============================================================================

export interface SerialConnectionConfig extends BaseConnectionConfig {
  type: "serial";
  baudRate: number;

  // Port identification (for reconnection)
  vendorId?: number;
  productId?: number;
  serialNumber?: string;

  // Display info
  portName?: string;
}

// ============================================================================
// HTTP Connection Config
// ============================================================================

export interface HTTPConnectionConfig extends BaseConnectionConfig {
  type: "http";
  baseUrl: string;

  // Authentication
  apiKey?: string;
  bearerToken?: string;

  // Optional custom headers
  headers?: Record<string, string>;

  // Polling configuration
  pollingInterval: number; // ms, 0 = disabled
}

// ============================================================================
// BLE Connection Config (single connection only)
// ============================================================================

export interface BLEConnectionConfig extends BaseConnectionConfig {
  type: "ble";
  deviceName?: string;
  deviceId?: string;
}

// ============================================================================
// Union Type
// ============================================================================

export type ConnectionConfig =
  | MQTTConnectionConfig
  | SerialConnectionConfig
  | HTTPConnectionConfig
  | BLEConnectionConfig;

// ============================================================================
// Connection State (runtime)
// ============================================================================

export interface ConnectionState {
  id: string;
  status: ConnectionStatus;
  error?: string;
  connectedAt?: number;
  lastActivity?: number;

  // Stats
  messagesReceived: number;
  messagesSent: number;
  bytesReceived: number;
  bytesSent: number;
}

// ============================================================================
// Connection Events
// ============================================================================

export type ConnectionEventType =
  | "connection.added"
  | "connection.removed"
  | "connection.updated"
  | "connection.status"
  | "connection.message"
  | "connection.error";

export interface ConnectionEvent {
  type: ConnectionEventType;
  connectionId: string;
  data?: unknown;
  timestamp: number;
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_MQTT_CONFIG: Omit<MQTTConnectionConfig, "id" | "name" | "createdAt" | "updatedAt"> = {
  type: "mqtt",
  enabled: false,
  autoConnect: false,
  brokerUrl: "",
  username: "",
  password: "",
  useTLS: false,
  subscriptions: [],
};

export const DEFAULT_HTTP_CONFIG: Omit<HTTPConnectionConfig, "id" | "name" | "createdAt" | "updatedAt"> = {
  type: "http",
  enabled: false,
  autoConnect: false,
  baseUrl: "",
  pollingInterval: 0,
};

export const DEFAULT_SERIAL_CONFIG: Omit<SerialConnectionConfig, "id" | "name" | "createdAt" | "updatedAt"> = {
  type: "serial",
  enabled: true,
  autoConnect: false,
  baudRate: 115200,
};

export const DEFAULT_BLE_CONFIG: Omit<BLEConnectionConfig, "id" | "name" | "createdAt" | "updatedAt"> = {
  type: "ble",
  enabled: true,
  autoConnect: false,
};
