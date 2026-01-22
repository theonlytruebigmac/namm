/**
 * Multi-Connection React Hooks
 *
 * Hooks for managing multiple MQTT, Serial, and HTTP connections.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  ConnectionConfig,
  MQTTConnectionConfig,
  SerialConnectionConfig,
  HTTPConnectionConfig,
  ConnectionState,
  ConnectionType,
} from "@/lib/connections/types";
import {
  getConnections,
  saveConnections,
  addConnection,
  updateConnection,
  removeConnection,
  toggleConnection,
  getConnectionsByType,
  createMQTTConnection,
  createHTTPConnection,
  createSerialConnection,
  addMQTTSubscription,
  removeMQTTSubscription,
  migrateFromLegacySettings,
  fetchConnectionsFromServer,
} from "@/lib/connections/store";
import {
  getMultiMQTTManager,
  type MultiMQTTEventType,
  type MultiMQTTEventHandler,
} from "@/lib/connections/mqtt-manager";
import type { Node, Message } from "@/types";

// ============================================================================
// useConnections - Manage all connections
// ============================================================================

export function useConnections() {
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load connections from server on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Migrate legacy settings first (one-time operation)
    migrateFromLegacySettings();

    // Fetch connections from server (source of truth)
    fetchConnectionsFromServer().then((serverConnections) => {
      setConnections(serverConnections);
      setIsLoaded(true);
    });

    // Listen for changes
    const handleChange = (e: CustomEvent<ConnectionConfig[]>) => {
      setConnections(e.detail);
    };

    window.addEventListener("connections-changed", handleChange as EventListener);
    return () => {
      window.removeEventListener("connections-changed", handleChange as EventListener);
    };
  }, []);

  const add = useCallback((connection: ConnectionConfig) => {
    addConnection(connection);
  }, []);

  const update = useCallback((id: string, updates: Partial<ConnectionConfig>) => {
    updateConnection(id, updates);
  }, []);

  const remove = useCallback((id: string) => {
    removeConnection(id);
  }, []);

  const toggle = useCallback((id: string) => {
    toggleConnection(id);
  }, []);

  // Filtered getters
  const mqttConnections = connections.filter(
    (c) => c.type === "mqtt"
  ) as MQTTConnectionConfig[];

  const httpConnections = connections.filter(
    (c) => c.type === "http"
  ) as HTTPConnectionConfig[];

  const serialConnections = connections.filter(
    (c) => c.type === "serial"
  ) as SerialConnectionConfig[];

  const bleConnection = connections.find((c) => c.type === "ble");

  return {
    connections,
    mqttConnections,
    httpConnections,
    serialConnections,
    bleConnection,
    isLoaded,
    add,
    update,
    remove,
    toggle,
  };
}

// ============================================================================
// useMultiMQTT - Manage multiple MQTT connections
// ============================================================================

export function useMultiMQTT() {
  const queryClient = useQueryClient();
  const managerRef = useRef<ReturnType<typeof getMultiMQTTManager> | null>(null);
  const serverConnectionsRef = useRef<Set<string>>(new Set());
  const connectingRef = useRef<Set<string>>(new Set()); // Track in-flight connection attempts
  const [connectionStates, setConnectionStates] = useState<Map<string, ConnectionState>>(
    new Map()
  );
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize manager and load connections
  useEffect(() => {
    if (typeof window === "undefined") return;

    const manager = getMultiMQTTManager();
    managerRef.current = manager;

    // Load MQTT connections from store
    const mqttConnections = getConnectionsByType<MQTTConnectionConfig>("mqtt");

    for (const config of mqttConnections) {
      // Only add WebSocket connections to browser manager
      const isWebSocket = config.brokerUrl.startsWith("ws://") || config.brokerUrl.startsWith("wss://");
      if (isWebSocket) {
        manager.addConnection(config);
      }
    }

    // Update states periodically (including server-side connections)
    const updateStates = async () => {
      const states = new Map<string, ConnectionState>();

      // Get browser-side connection states
      for (const state of manager.getAllConnectionStates()) {
        states.set(state.id, state);
      }

      // Fetch server-side connection states
      try {
        const response = await fetch("/api/mqtt/connections");
        if (response.ok) {
          const data = await response.json();
          for (const conn of data.connections || []) {
            serverConnectionsRef.current.add(conn.id);
            states.set(conn.id, {
              id: conn.id,
              status: conn.status,
              error: conn.error,
              messagesReceived: conn.messagesReceived,
              messagesSent: 0,
              bytesReceived: 0,
              bytesSent: 0,
              connectedAt: conn.connectedAt,
            });
          }
        }
      } catch {
        // Server may not be running
      }

      setConnectionStates(states);
    };

    updateStates();
    const interval = setInterval(updateStates, 2000);

    // Set up event handlers for data updates
    const unsubMessage = manager.on<Message>("mqtt.message", (connId, message) => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    });

    const unsubNode = manager.on<Node>("mqtt.node.update", (connId, node) => {
      queryClient.invalidateQueries({ queryKey: ["nodes"] });
    });

    const unsubPosition = manager.on("mqtt.node.position", (connId, position) => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
    });

    const unsubTelemetry = manager.on("mqtt.node.telemetry", (connId, telemetry) => {
      queryClient.invalidateQueries({ queryKey: ["telemetry"] });
    });

    setIsInitialized(true);

    return () => {
      clearInterval(interval);
      unsubMessage();
      unsubNode();
      unsubPosition();
      unsubTelemetry();
    };
  }, [queryClient]);

  // Listen for connection config changes and auto-connect enabled MQTT connections
  useEffect(() => {
    if (!managerRef.current) return;

    const handleConnectionsChanged = async (e: CustomEvent<ConnectionConfig[]>) => {
      const manager = managerRef.current!;
      const mqttConfigs = e.detail.filter(
        (c) => c.type === "mqtt"
      ) as MQTTConnectionConfig[];

      // Get current connection IDs
      const currentIds = new Set(manager.getAllConnectionStates().map((s) => s.id));
      const newIds = new Set(mqttConfigs.map((c) => c.id));

      // Remove deleted connections
      for (const id of currentIds) {
        if (!newIds.has(id)) {
          manager.removeConnection(id);
        }
      }

      // FIRST: Fetch current server-side MQTT connections to update our tracking
      // This prevents 409 errors by knowing what's already connected on the server
      try {
        const serverResponse = await fetch("/api/mqtt/connections");
        if (serverResponse.ok) {
          const data = await serverResponse.json();
          for (const conn of data.connections || []) {
            serverConnectionsRef.current.add(conn.id);
          }
        }
      } catch {
        // Server may not be available, continue anyway
      }

      // Add or update connections, and auto-connect enabled ones
      for (const config of mqttConfigs) {
        const isWebSocket = config.brokerUrl.startsWith("ws://") || config.brokerUrl.startsWith("wss://");
        const isNativeMQTT = config.brokerUrl.startsWith("mqtt://") || config.brokerUrl.startsWith("mqtts://");

        if (currentIds.has(config.id)) {
          manager.updateConnection(config.id, config);
        } else {
          // Add new connection (WebSocket ones go to browser manager)
          if (isWebSocket) {
            manager.addConnection(config);
          }
        }

        // Auto-connect enabled connections (only if not already connected)
        if (config.enabled && config.autoConnect) {
          if (isNativeMQTT) {
            // Native MQTT needs server-side connection
            // Skip if already connected on server or currently connecting
            if (serverConnectionsRef.current.has(config.id) || connectingRef.current.has(config.id)) {
              continue;
            }
            // Mark as connecting to prevent duplicate requests
            connectingRef.current.add(config.id);
            try {
              const response = await fetch("/api/mqtt/connections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  id: config.id,
                  name: config.name,
                  broker: config.brokerUrl,
                  username: config.username,
                  password: config.password,
                  topics: config.subscriptions.filter(s => s.enabled).map(s => s.topic),
                }),
              });
              if (response.ok) {
                serverConnectionsRef.current.add(config.id);
                console.log(`[MQTT] Auto-connected ${config.name} via server`);
              } else if (response.status === 409) {
                // Connection already exists on server, just track it
                serverConnectionsRef.current.add(config.id);
              }
            } catch (error) {
              console.error(`[MQTT] Failed to auto-connect ${config.name}:`, error);
            } finally {
              connectingRef.current.delete(config.id);
            }
          } else if (isWebSocket) {
            // WebSocket connections handled by browser manager
            const state = manager.getConnectionState(config.id);
            if (state?.status !== "connected" && state?.status !== "connecting") {
              manager.connect(config.id);
              console.log(`[MQTT] Auto-connecting ${config.name} via WebSocket`);
            }
          }
        }
      }
    };

    // Wrapper to handle async event handler (EventListener doesn't support Promise)
    const eventHandler = (e: Event) => {
      handleConnectionsChanged(e as CustomEvent<ConnectionConfig[]>);
    };

    window.addEventListener("connections-changed", eventHandler);
    return () => {
      window.removeEventListener("connections-changed", eventHandler);
    };
  }, []);

  const connect = useCallback(async (connectionId: string) => {
    // Get the connection config to check protocol
    const mqttConfigs = getConnectionsByType<MQTTConnectionConfig>("mqtt");
    const config = mqttConfigs.find(c => c.id === connectionId);

    if (config) {
      // Check if this needs server-side connection (native MQTT)
      const isNativeMQTT = config.brokerUrl.startsWith("mqtt://") || config.brokerUrl.startsWith("mqtts://");

      if (isNativeMQTT) {
        // Use server-side MQTT connection
        console.log(`[MQTT] Using server-side connection for ${config.name} (native MQTT)`);
        try {
          const response = await fetch("/api/mqtt/connections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: config.id,
              name: config.name,
              broker: config.brokerUrl,
              username: config.username,
              password: config.password,
              topics: config.subscriptions.filter(s => s.enabled).map(s => s.topic),
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            console.error(`[MQTT] Server connection failed:`, error);
          } else {
            serverConnectionsRef.current.add(connectionId);
            console.log(`[MQTT] Server connection initiated for ${config.name}`);
          }
        } catch (error) {
          console.error(`[MQTT] Failed to create server connection:`, error);
        }
        return;
      }
    }

    // Use browser-side WebSocket connection
    managerRef.current?.connect(connectionId);
  }, []);

  const disconnect = useCallback(async (connectionId: string) => {
    // Check if this is a server-side connection
    if (serverConnectionsRef.current.has(connectionId)) {
      try {
        await fetch(`/api/mqtt/connections?id=${connectionId}`, {
          method: "DELETE",
        });
        serverConnectionsRef.current.delete(connectionId);
        console.log(`[MQTT] Server connection closed`);
      } catch (error) {
        console.error(`[MQTT] Failed to close server connection:`, error);
      }
      return;
    }

    managerRef.current?.disconnect(connectionId);
  }, []);

  const connectAll = useCallback(() => {
    managerRef.current?.connectAll();
  }, []);

  const disconnectAll = useCallback(() => {
    managerRef.current?.disconnectAll();
  }, []);

  const subscribe = useCallback((connectionId: string, topic: string) => {
    managerRef.current?.subscribe(connectionId, topic);
  }, []);

  const unsubscribe = useCallback((connectionId: string, topic: string) => {
    managerRef.current?.unsubscribe(connectionId, topic);
  }, []);

  const getState = useCallback(
    (connectionId: string): ConnectionState | undefined => {
      return connectionStates.get(connectionId);
    },
    [connectionStates]
  );

  const hasActiveConnection = useCallback((): boolean => {
    return managerRef.current?.hasActiveConnection() || false;
  }, []);

  const activeCount = managerRef.current?.getActiveConnectionCount() || 0;

  return {
    connectionStates,
    isInitialized,
    activeCount,
    connect,
    disconnect,
    connectAll,
    disconnectAll,
    subscribe,
    unsubscribe,
    getState,
    hasActiveConnection,
  };
}

// ============================================================================
// useMultiMQTTEvent - Listen to events from all MQTT connections
// ============================================================================

export function useMultiMQTTEvent<T = unknown>(
  event: MultiMQTTEventType,
  handler: MultiMQTTEventHandler<T>
): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const manager = getMultiMQTTManager();
    const unsub = manager.on(event, handler);

    return unsub;
  }, [event, handler]);
}

// ============================================================================
// useConnectionStats - Get combined stats from all connections
// ============================================================================

export function useConnectionStats() {
  const { connectionStates } = useMultiMQTT();

  const stats = {
    totalConnections: connectionStates.size,
    activeConnections: 0,
    totalMessagesReceived: 0,
    totalMessagesSent: 0,
    totalBytesReceived: 0,
    totalBytesSent: 0,
  };

  for (const state of connectionStates.values()) {
    if (state.status === "connected") {
      stats.activeConnections++;
    }
    stats.totalMessagesReceived += state.messagesReceived;
    stats.totalMessagesSent += state.messagesSent;
    stats.totalBytesReceived += state.bytesReceived;
    stats.totalBytesSent += state.bytesSent;
  }

  return stats;
}

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * Create a new MQTT connection
 */
export function useCreateMQTTConnection() {
  return useCallback(
    (name: string, brokerUrl: string, options?: Partial<MQTTConnectionConfig>) => {
      const config = createMQTTConnection(name, brokerUrl, options);
      addConnection(config);
      return config;
    },
    []
  );
}

/**
 * Create a new HTTP connection
 */
export function useCreateHTTPConnection() {
  return useCallback(
    (name: string, baseUrl: string, options?: Partial<HTTPConnectionConfig>) => {
      const config = createHTTPConnection(name, baseUrl, options);
      addConnection(config);
      return config;
    },
    []
  );
}

/**
 * Create a new Serial connection
 */
export function useCreateSerialConnection() {
  return useCallback(
    (name: string, options?: Partial<SerialConnectionConfig>) => {
      const config = createSerialConnection(name, options);
      addConnection(config);
      return config;
    },
    []
  );
}

/**
 * Manage subscriptions for an MQTT connection
 */
export function useMQTTSubscriptions(connectionId: string) {
  const { connections } = useConnections();

  const connection = connections.find(
    (c) => c.id === connectionId && c.type === "mqtt"
  ) as MQTTConnectionConfig | undefined;

  const subscriptions = connection?.subscriptions || [];

  const addSubscription = useCallback(
    (topic: string, description?: string) => {
      addMQTTSubscription(connectionId, topic, description);
    },
    [connectionId]
  );

  const removeSubscription = useCallback(
    (subscriptionId: string) => {
      removeMQTTSubscription(connectionId, subscriptionId);
    },
    [connectionId]
  );

  return {
    subscriptions,
    addSubscription,
    removeSubscription,
  };
}
