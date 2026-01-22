/**
 * Connection Store
 *
 * Manages storage and retrieval of multiple connection configurations.
 * Uses server-side SQLite database as the source of truth.
 * Falls back to localStorage only during initial load before server sync.
 */

import type {
  ConnectionConfig,
  MQTTConnectionConfig,
  SerialConnectionConfig,
  HTTPConnectionConfig,
  BLEConnectionConfig,
  ConnectionType,
  DEFAULT_MQTT_CONFIG,
  DEFAULT_HTTP_CONFIG,
  DEFAULT_SERIAL_CONFIG,
  DEFAULT_BLE_CONFIG,
} from "./types";

const CONNECTIONS_KEY = "namm-connections";

// In-memory cache of connections (source of truth after server sync)
let connectionsCache: ConnectionConfig[] | null = null;
let isSyncing = false;

// ============================================================================
// Server Sync Functions
// ============================================================================

/**
 * Fetch connections from server API
 * This is the source of truth for connections
 */
export async function fetchConnectionsFromServer(): Promise<ConnectionConfig[]> {
  try {
    const response = await fetch("/api/connections");
    if (response.ok) {
      const data = await response.json();
      const loaded: ConnectionConfig[] = data.connections || [];
      connectionsCache = loaded;
      console.log(`[Store] Loaded ${loaded.length} connections from server`);

      // Dispatch event to notify components
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("connections-changed", { detail: loaded })
        );
      }

      return loaded;
    }
  } catch (error) {
    console.error("[Store] Failed to fetch connections from server:", error);
  }

  // Fallback to empty array (server is unavailable)
  return [];
}

/**
 * Sync connections to server API
 */
async function syncConnectionsToServer(connections: ConnectionConfig[]): Promise<boolean> {
  if (isSyncing) return false;
  isSyncing = true;

  try {
    const response = await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connections }),
    });

    if (response.ok) {
      console.log(`[Store] Synced ${connections.length} connections to server`);
      return true;
    } else {
      console.error("[Store] Server sync failed:", await response.text());
      return false;
    }
  } catch (error) {
    console.error("[Store] Failed to sync connections to server:", error);
    return false;
  } finally {
    isSyncing = false;
  }
}

// ============================================================================
// Storage Functions
// ============================================================================

/**
 * Get all stored connections
 * Returns cached connections if available, otherwise empty array
 * Call fetchConnectionsFromServer() first to populate the cache
 */
export function getConnections(): ConnectionConfig[] {
  // Return cache if available
  if (connectionsCache !== null) {
    return connectionsCache;
  }

  // Cache not populated yet - return empty array
  // The useConnections hook will call fetchConnectionsFromServer() on mount
  return [];
}

/**
 * Get connections by type
 */
export function getConnectionsByType<T extends ConnectionConfig>(
  type: ConnectionType
): T[] {
  return getConnections().filter((c) => c.type === type) as T[];
}

/**
 * Get a single connection by ID
 */
export function getConnection(id: string): ConnectionConfig | undefined {
  return getConnections().find((c) => c.id === id);
}

/**
 * Save all connections (syncs to server)
 */
export function saveConnections(connections: ConnectionConfig[]): void {
  // Update cache immediately
  connectionsCache = connections;

  // Dispatch event for components to update
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("connections-changed", { detail: connections })
    );
  }

  // Sync to server (fire and forget, but log errors)
  syncConnectionsToServer(connections);
}

/**
 * Add a new connection
 */
export function addConnection(connection: ConnectionConfig): void {
  const connections = getConnections();

  // Check for BLE limit (only one allowed)
  if (connection.type === "ble") {
    const existingBLE = connections.find((c) => c.type === "ble");
    if (existingBLE) {
      throw new Error("Only one BLE connection is allowed. Remove the existing one first.");
    }
  }

  connections.push(connection);
  saveConnections(connections);
}

/**
 * Update an existing connection
 */
export function updateConnection(
  id: string,
  updates: Partial<ConnectionConfig>
): void {
  const connections = getConnections();
  const index = connections.findIndex((c) => c.id === id);

  if (index === -1) {
    throw new Error(`Connection ${id} not found`);
  }

  connections[index] = {
    ...connections[index],
    ...updates,
    updatedAt: Date.now(),
  } as ConnectionConfig;

  saveConnections(connections);
}

/**
 * Remove a connection
 */
export function removeConnection(id: string): void {
  const connections = getConnections().filter((c) => c.id !== id);
  saveConnections(connections);
}

/**
 * Toggle connection enabled state
 */
export function toggleConnection(id: string): void {
  const connections = getConnections();
  const connection = connections.find((c) => c.id === id);

  if (connection) {
    connection.enabled = !connection.enabled;
    connection.updatedAt = Date.now();
    saveConnections(connections);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Generate a unique connection ID
 */
export function generateConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a new MQTT connection config
 */
export function createMQTTConnection(
  name: string,
  brokerUrl: string,
  options?: Partial<MQTTConnectionConfig>
): MQTTConnectionConfig {
  const now = Date.now();
  return {
    id: generateConnectionId(),
    name,
    type: "mqtt",
    enabled: true,
    autoConnect: true,
    createdAt: now,
    updatedAt: now,
    brokerUrl,
    useTLS: brokerUrl.startsWith("mqtts://") || brokerUrl.startsWith("wss://"),
    subscriptions: [],
    ...options,
  };
}

/**
 * Create a new HTTP connection config
 */
export function createHTTPConnection(
  name: string,
  baseUrl: string,
  options?: Partial<HTTPConnectionConfig>
): HTTPConnectionConfig {
  const now = Date.now();
  return {
    id: generateConnectionId(),
    name,
    type: "http",
    enabled: true,
    autoConnect: true,
    createdAt: now,
    updatedAt: now,
    baseUrl,
    pollingInterval: 0,
    ...options,
  };
}

/**
 * Create a new Serial connection config
 */
export function createSerialConnection(
  name: string,
  options?: Partial<SerialConnectionConfig>
): SerialConnectionConfig {
  const now = Date.now();
  return {
    id: generateConnectionId(),
    name,
    type: "serial",
    enabled: true,
    autoConnect: false,
    createdAt: now,
    updatedAt: now,
    baudRate: 115200,
    ...options,
  };
}

/**
 * Create a new BLE connection config
 */
export function createBLEConnection(
  name: string,
  options?: Partial<BLEConnectionConfig>
): BLEConnectionConfig {
  const now = Date.now();
  return {
    id: generateConnectionId(),
    name,
    type: "ble",
    enabled: true,
    autoConnect: false,
    createdAt: now,
    updatedAt: now,
    ...options,
  };
}

// ============================================================================
// MQTT Subscription Management
// ============================================================================

/**
 * Add a subscription to an MQTT connection
 */
export function addMQTTSubscription(
  connectionId: string,
  topic: string,
  description?: string
): void {
  const connections = getConnections();
  const connection = connections.find((c) => c.id === connectionId);

  if (!connection || connection.type !== "mqtt") {
    throw new Error("MQTT connection not found");
  }

  const mqttConn = connection as MQTTConnectionConfig;
  mqttConn.subscriptions.push({
    id: `sub_${Date.now()}`,
    topic,
    description,
    enabled: true,
  });
  mqttConn.updatedAt = Date.now();

  saveConnections(connections);
}

/**
 * Remove a subscription from an MQTT connection
 */
export function removeMQTTSubscription(
  connectionId: string,
  subscriptionId: string
): void {
  const connections = getConnections();
  const connection = connections.find((c) => c.id === connectionId);

  if (!connection || connection.type !== "mqtt") {
    throw new Error("MQTT connection not found");
  }

  const mqttConn = connection as MQTTConnectionConfig;
  mqttConn.subscriptions = mqttConn.subscriptions.filter(
    (s) => s.id !== subscriptionId
  );
  mqttConn.updatedAt = Date.now();

  saveConnections(connections);
}

/**
 * Toggle a subscription enabled state
 */
export function toggleMQTTSubscription(
  connectionId: string,
  subscriptionId: string
): void {
  const connections = getConnections();
  const connection = connections.find((c) => c.id === connectionId);

  if (!connection || connection.type !== "mqtt") {
    throw new Error("MQTT connection not found");
  }

  const mqttConn = connection as MQTTConnectionConfig;
  const subscription = mqttConn.subscriptions.find(
    (s) => s.id === subscriptionId
  );

  if (subscription) {
    subscription.enabled = !subscription.enabled;
    mqttConn.updatedAt = Date.now();
    saveConnections(connections);
  }
}

// ============================================================================
// Migration
// ============================================================================

/**
 * Migrate legacy single-connection settings to multi-connection format
 */
export function migrateFromLegacySettings(): boolean {
  if (typeof window === "undefined") return false;

  const LEGACY_KEY = "namm-settings";
  const MIGRATED_KEY = "namm-connections-migrated";

  // Check if already migrated
  if (localStorage.getItem(MIGRATED_KEY)) {
    return false;
  }

  try {
    const legacySettings = localStorage.getItem(LEGACY_KEY);
    if (!legacySettings) {
      localStorage.setItem(MIGRATED_KEY, "true");
      return false;
    }

    const settings = JSON.parse(legacySettings);
    const connections: ConnectionConfig[] = [];

    // Migrate MQTT settings
    if (settings.mqttBroker) {
      connections.push(
        createMQTTConnection("Primary MQTT", settings.mqttBroker, {
          username: settings.mqttUsername,
          password: settings.mqttPassword,
          useTLS: settings.mqttUseTLS || false,
          subscriptions: settings.mqttTopic
            ? [
              {
                id: "sub_migrated",
                topic: settings.mqttTopic,
                description: "Migrated from legacy settings",
                enabled: true,
              },
            ]
            : [],
        })
      );
    }

    // Migrate HTTP settings
    if (settings.apiEndpoint) {
      connections.push(
        createHTTPConnection("Primary HTTP", settings.apiEndpoint)
      );
    }

    if (connections.length > 0) {
      saveConnections(connections);
    }

    localStorage.setItem(MIGRATED_KEY, "true");
    console.log(`✅ Migrated ${connections.length} connections from legacy settings`);
    return true;
  } catch (error) {
    console.error("Failed to migrate legacy settings:", error);
    return false;
  }
}
