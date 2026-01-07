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

  // Load connections on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Migrate legacy settings on first load
    migrateFromLegacySettings();

    setConnections(getConnections());
    setIsLoaded(true);

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
      manager.addConnection(config);
    }

    // Update states periodically
    const updateStates = () => {
      const states = new Map<string, ConnectionState>();
      for (const state of manager.getAllConnectionStates()) {
        states.set(state.id, state);
      }
      setConnectionStates(states);
    };

    updateStates();
    const interval = setInterval(updateStates, 1000);

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

  // Listen for connection config changes
  useEffect(() => {
    if (!managerRef.current) return;

    const handleConnectionsChanged = (e: CustomEvent<ConnectionConfig[]>) => {
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

      // Add or update connections
      for (const config of mqttConfigs) {
        if (currentIds.has(config.id)) {
          manager.updateConnection(config.id, config);
        } else {
          manager.addConnection(config);
        }
      }
    };

    window.addEventListener(
      "connections-changed",
      handleConnectionsChanged as EventListener
    );
    return () => {
      window.removeEventListener(
        "connections-changed",
        handleConnectionsChanged as EventListener
      );
    };
  }, []);

  const connect = useCallback((connectionId: string) => {
    managerRef.current?.connect(connectionId);
  }, []);

  const disconnect = useCallback((connectionId: string) => {
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
