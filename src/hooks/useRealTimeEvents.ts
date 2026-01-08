"use client";

import { useEffect, useState, useCallback } from "react";
import { notifyNewMessage, notifyNodeStatus, notifyLowBattery } from "@/lib/notifications";
import { useSSEEvent } from "./useSSE";
import { getSSEManager } from "@/lib/api/sse";
import {
  evaluateBatteryThreshold,
  evaluateSignalThreshold,
  evaluateHopsThreshold,
} from "@/lib/alerts";

interface RealtimeEvent {
  type: string;
  timestamp: number;
  data?: unknown;
}

/**
 * Hook to manage real-time events via SSE
 */
export function useRealTimeEvents() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [eventHistory, setEventHistory] = useState<RealtimeEvent[]>([]);

  // Track connection status
  useEffect(() => {
    if (typeof window === "undefined") return;

    const sseManager = getSSEManager();
    const checkConnection = () => {
      setIsConnected(sseManager.isConnected());
    };

    // Check immediately
    checkConnection();

    // Check periodically
    const interval = setInterval(checkConnection, 1000);

    return () => clearInterval(interval);
  }, []);

  // Generic event handler
  const handleEvent = useCallback((type: string, data: unknown) => {
    const realtimeEvent: RealtimeEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    setLastEvent(realtimeEvent);
    setEventHistory((prev) => [...prev.slice(-19), realtimeEvent]);

    // Trigger notifications based on event type
    if (type === "message.new" && data) {
      const message = data as Record<string, unknown>;
      notifyNewMessage(
        (message.from as string) || (message.fromUser as string) || "Unknown",
        (message.text as string) || (message.message as string) || ""
      );

      // Check hop count threshold
      const hopStart = message.hopStart as number | undefined;
      const hopLimit = message.hopLimit as number | undefined;
      if (hopStart !== undefined && hopLimit !== undefined) {
        const hops = hopStart - hopLimit; // Calculate actual hops taken
        if (hops > 0) {
          const fromId = (message.fromId as string) || (message.from as string) || "unknown";
          const fromName = (message.fromUser as string) || undefined;
          evaluateHopsThreshold(hops, fromId, fromName);
        }
      }
    } else if (type === "node.update" && data) {
      const node = data as Record<string, unknown>;
      const nodeId = (node.id as string) || (node.nodeId as string) || "unknown";
      const nodeName = (node.longName as string) || (node.shortName as string) || undefined;

      // Check for status change notifications
      if (node.status === "online" || node.status === "offline") {
        notifyNodeStatus(
          nodeName || "Unknown Node",
          node.status as "online" | "offline"
        );
      }

      // Legacy battery notification (kept for compatibility)
      if (node.batteryLevel !== undefined && (node.batteryLevel as number) < 20) {
        notifyLowBattery(
          nodeName || "Unknown Node",
          node.batteryLevel as number
        );
      }

      // Evaluate configurable alert thresholds
      if (node.batteryLevel !== undefined) {
        evaluateBatteryThreshold(node.batteryLevel as number, nodeId, nodeName);
      }
      if (node.snr !== undefined || node.rssi !== undefined) {
        // Use SNR if available, fall back to RSSI
        const signalValue = (node.rssi as number) ?? (node.snr as number);
        if (signalValue !== undefined) {
          evaluateSignalThreshold(signalValue, nodeId, nodeName);
        }
      }
    }
  }, []);

  // Subscribe to all event types via SSE
  useSSEEvent("node.update", (data) => handleEvent("node.update", data));
  useSSEEvent("node.new", (data) => handleEvent("node.new", data));
  useSSEEvent("message.new", (data) => handleEvent("message.new", data));
  useSSEEvent("device.stats", (data) => handleEvent("device.stats", data));
  useSSEEvent("device.connection", (data) => handleEvent("device.connection", data));
  useSSEEvent("error", (data) => handleEvent("error", data));

  const clearHistory = useCallback(() => {
    setEventHistory([]);
  }, []);

  return {
    connected: isConnected,
    lastEvent,
    eventHistory,
    clearHistory,
  };
}
