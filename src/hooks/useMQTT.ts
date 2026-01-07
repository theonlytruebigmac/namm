"use client";

/**
 * MQTT React Hooks
 *
 * React hooks for MQTT broker integration with Meshtastic
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getMQTTManager,
  type MQTTConfig,
  type MQTTEventType,
  type MQTTEventHandler,
} from "@/lib/api/mqtt";
import type { Node, Message } from "@/types";

/**
 * Hook to manage MQTT connection lifecycle
 */
export function useMQTT(config?: MQTTConfig, autoConnect = true) {
  const mqttManager = useRef<ReturnType<typeof getMQTTManager> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize manager client-side only
  useEffect(() => {
    if (typeof window === "undefined" || !config) return;

    if (!mqttManager.current) {
      mqttManager.current = getMQTTManager(config);
    }
  }, [config]);

  useEffect(() => {
    if (!mqttManager.current || !autoConnect) return;

    console.log("🔌 Setting up MQTT connection tracking...");

    // Set up connection status tracking
    const unsubConnected = mqttManager.current.on("mqtt.connected", () => {
      console.log("✅ useMQTT: Connection status changed to CONNECTED");
      setIsConnected(true);
      setError(null);
    });

    const unsubDisconnected = mqttManager.current.on("mqtt.disconnected", (data: any) => {
      console.log("❌ useMQTT: Connection status changed to DISCONNECTED", data);
      setIsConnected(false);
      if (data?.reason) {
        setError(data.reason);
      }
    });

    const unsubError = mqttManager.current.on("mqtt.error", (data: any) => {
      console.error("⚠️ useMQTT: MQTT error received:", data);
      setError(data?.message || "MQTT error occurred");
    });

    // Connect if not already connected
    if (!mqttManager.current.isConnected()) {
      console.log("🚀 Initiating MQTT connection...");
      mqttManager.current.connect();
    } else {
      console.log("✅ MQTT already connected");
      setIsConnected(true);
    }

    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubError();
    };
  }, [autoConnect]);

  const connect = useCallback(() => {
    mqttManager.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    mqttManager.current?.disconnect();
  }, []);

  const subscribe = useCallback((topic: string) => {
    mqttManager.current?.subscribe(topic);
  }, []);

  const unsubscribe = useCallback((topic: string) => {
    mqttManager.current?.unsubscribe(topic);
  }, []);

  return {
    isConnected,
    error,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };
}

/**
 * Hook to listen to specific MQTT events
 */
export function useMQTTEvent<T = unknown>(
  event: MQTTEventType,
  handler: MQTTEventHandler<T>
): void {
  const mqttManager = useRef<ReturnType<typeof getMQTTManager> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      mqttManager.current = getMQTTManager();
    } catch (error) {
      // Manager not initialized yet
      return;
    }

    if (!mqttManager.current) return;

    const unsubscribe = mqttManager.current.on(event, handler as any);
    return unsubscribe;
  }, [event, handler]);
}

/**
 * Hook for MQTT node updates with React Query integration
 */
export function useMQTTNodeUpdates() {
  const queryClient = useQueryClient();

  useMQTTEvent<Node>("mqtt.node.update", (node) => {
    // Update the nodes cache with new node data
    queryClient.setQueryData<Node[]>(["nodes"], (oldNodes) => {
      if (!oldNodes) return [node];

      const index = oldNodes.findIndex((n) => n.id === node.id);
      if (index >= 0) {
        // Update existing node
        const newNodes = [...oldNodes];
        newNodes[index] = { ...newNodes[index], ...node };
        return newNodes;
      } else {
        // Add new node
        return [...oldNodes, node];
      }
    });

    // Invalidate to trigger refetch
    queryClient.invalidateQueries({ queryKey: ["nodes"] });
  });
}

/**
 * Hook for MQTT message updates with React Query integration
 */
export function useMQTTMessageUpdates() {
  const queryClient = useQueryClient();

  useMQTTEvent<Message>("mqtt.message", (message, topic) => {
    console.log("MQTT message received:", message, "on topic:", topic);

    // Add message to appropriate cache based on channel
    const channelIndex = message.channel || 0;

    queryClient.setQueryData<Message[]>(
      ["messages", "channel", channelIndex],
      (oldMessages) => {
        if (!oldMessages) return [message];
        return [...oldMessages, message];
      }
    );

    // Invalidate queries to trigger UI updates
    queryClient.invalidateQueries({
      queryKey: ["messages", "channel", channelIndex],
    });
  });
}

/**
 * Hook for MQTT node position updates
 */
export function useMQTTPositionUpdates() {
  const queryClient = useQueryClient();

  useMQTTEvent<{
    nodeId: string;
    latitude: number;
    longitude: number;
    altitude?: number;
  }>("mqtt.node.position", (position) => {
    // Update node position in cache
    queryClient.setQueryData<Node[]>(["nodes"], (oldNodes) => {
      if (!oldNodes) return oldNodes;

      return oldNodes.map((node) => {
        if (node.id === position.nodeId) {
          return {
            ...node,
            position: {
              latitude: position.latitude,
              longitude: position.longitude,
              altitude: position.altitude || 0,
            },
            lastHeard: Date.now(),
          };
        }
        return node;
      });
    });

    queryClient.invalidateQueries({ queryKey: ["nodes"] });
  });
}

/**
 * Hook for MQTT node telemetry updates
 */
export function useMQTTTelemetryUpdates() {
  const queryClient = useQueryClient();

  useMQTTEvent<{
    nodeId: string;
    batteryLevel?: number;
    voltage?: number;
    channelUtilization?: number;
    airUtilTx?: number;
  }>("mqtt.node.telemetry", (telemetry) => {
    // Update node telemetry in cache
    queryClient.setQueryData<Node[]>(["nodes"], (oldNodes) => {
      if (!oldNodes) return oldNodes;

      return oldNodes.map((node) => {
        if (node.id === telemetry.nodeId) {
          return {
            ...node,
            batteryLevel: telemetry.batteryLevel ?? node.batteryLevel,
            voltage: telemetry.voltage ?? node.voltage,
            lastHeard: Date.now(),
          };
        }
        return node;
      });
    });

    queryClient.invalidateQueries({ queryKey: ["nodes"] });
  });
}

/**
 * Hook to get connection status
 */
export function useMQTTConnectionStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useMQTTEvent("mqtt.connected", () => {
    setIsConnected(true);
    setError(null);
  });

  useMQTTEvent<{ reason?: string }>("mqtt.disconnected", (data) => {
    setIsConnected(false);
    if (data?.reason) {
      setError(data.reason);
    }
  });

  useMQTTEvent<{ message: string }>("mqtt.error", (data) => {
    setError(data?.message || "Unknown error");
  });

  return { isConnected, error };
}

/**
 * Hook for comprehensive MQTT real-time updates
 * Combines all MQTT event handlers for complete data sync
 */
export function useMQTTRealtimeUpdates() {
  useMQTTNodeUpdates();
  useMQTTMessageUpdates();
  useMQTTPositionUpdates();
  useMQTTTelemetryUpdates();
}
