"use client";

/**
 * Client-side hook to connect to server-side MQTT stream
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSettings } from "./useSettings";
import { processMQTTMessage } from "@/lib/mqtt-processor";
import type { NodeRole } from "@/types";

// Role mapping for MQTT data (numeric role to string)
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

function getRoleString(role?: number): NodeRole {
  if (role === undefined) return "CLIENT";
  return ROLE_MAP[role] || "CLIENT";
}

interface MQTTMessage {
  type: string;
  topic: string;
  payload: string;
  timestamp: number;
}

export function useMQTTServer() {
  const settings = useSettings();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const queryClient = useQueryClient();

  const shouldConnect = settings.connectionType === "mqtt";

  useEffect(() => {
    if (!shouldConnect) {
      // Clean up existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    // Build URL with MQTT config
    // Only connect if broker is configured
    if (!settings.mqttBroker) {
      console.log("⚠️ No MQTT broker configured, skipping connection");
      return;
    }

    const params = new URLSearchParams({
      broker: settings.mqttBroker,
      topic: settings.mqttTopic || "",
    });

    if (settings.mqttUsername) params.append("username", settings.mqttUsername);
    if (settings.mqttPassword) params.append("password", settings.mqttPassword);

    const url = `/api/mqtt?${params.toString()}`;

    console.log("🔌 Connecting to MQTT server stream...");
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log("✅ Connected to MQTT server stream");
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: MQTTMessage = JSON.parse(event.data);

        if (data.type === "connected") {
          console.log("✅ MQTT broker connected via server");
          return;
        }

        if (data.type === "mqtt.message") {
          setMessageCount((c) => c + 1);

          // Process the MQTT message using the processor
          const processed = processMQTTMessage(data.topic, data.payload);
          const hasData = processed && 'data' in processed && processed.data;

          console.log(`📨 MQTT ${processed.type}:`, hasData ? "✅" : "⚠️");

          // Update React Query cache directly with MQTT data
          switch (processed.type) {
            case "nodeinfo":
              if (hasData) {
                const nodeData = processed.data as any; // Type assertion for union type
                // Transform role from number to string
                const transformedNode = {
                  ...nodeData,
                  role: getRoleString(nodeData.role),
                };
                queryClient.setQueryData(["nodes"], (oldNodes: any[] = []) => {
                  const existingIndex = oldNodes.findIndex((n) => n.id === transformedNode.id);
                  if (existingIndex >= 0) {
                    // Update existing node
                    const updated = [...oldNodes];
                    updated[existingIndex] = { ...updated[existingIndex], ...transformedNode };
                    return updated;
                  } else {
                    // Add new node
                    return [...oldNodes, transformedNode];
                  }
                });
              }
              break;

            case "position":
              if (hasData) {
                const posData = (processed as { data: unknown }).data as any; // Type assertion for union type
                queryClient.setQueryData(["nodes"], (oldNodes: any[] = []) => {
                  const existingIndex = oldNodes.findIndex((n) => n.id === posData.nodeId);
                  if (existingIndex >= 0) {
                    const updated = [...oldNodes];
                    updated[existingIndex] = {
                      ...updated[existingIndex],
                      position: posData.position,
                      snr: posData.snr,
                      rssi: posData.rssi,
                      lastHeard: posData.timestamp,
                    };
                    return updated;
                  }
                  return oldNodes;
                });
              }
              break;

            case "telemetry":
              if (hasData) {
                const telData = (processed as { data: unknown }).data as any; // Type assertion for union type
                queryClient.setQueryData(["nodes"], (oldNodes: any[] = []) => {
                  const existingIndex = oldNodes.findIndex((n) => n.id === telData.nodeId);
                  if (existingIndex >= 0) {
                    const updated = [...oldNodes];
                    updated[existingIndex] = {
                      ...updated[existingIndex],
                      batteryLevel: telData.batteryLevel,
                      voltage: telData.voltage,
                      channelUtilization: telData.channelUtilization,
                      airUtilTx: telData.airUtilTx,
                      uptime: telData.uptime,
                      snr: telData.snr,
                      rssi: telData.rssi,
                      lastHeard: telData.timestamp,
                    };
                    return updated;
                  }
                  return oldNodes;
                });
              }
              break;

            case "text":
              if (hasData) {
                queryClient.invalidateQueries({ queryKey: ["messages"] });
                queryClient.invalidateQueries({ queryKey: ["channels"] });
              }
              break;
          }
        }
      } catch (error) {
        console.error("Error parsing MQTT message:", error);
      }
    };

    eventSource.onerror = (err) => {
      console.error("❌ MQTT server stream error:", err);
      setIsConnected(false);
      setError("Connection to MQTT server failed");
      eventSource.close();
    };

    return () => {
      console.log("🔌 Closing MQTT server stream");
      eventSource.close();
    };
  }, [shouldConnect, settings.mqttBroker, settings.mqttUsername, settings.mqttPassword, settings.mqttTopic, queryClient]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  return {
    isConnected,
    error,
    messageCount,
    disconnect,
  };
}
