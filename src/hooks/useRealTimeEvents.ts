"use client";

import { useEffect, useState, useCallback } from "react";
import { notifyNewMessage, notifyNodeStatus, notifyLowBattery } from "@/lib/notifications";
import { useWebSocketEvent } from "./useWebSocket";
import { getWebSocketManager } from "@/lib/api/websocket";

interface RealtimeEvent {
  type: string;
  timestamp: number;
  data?: any;
}

/**
 * Hook to manage real-time events from WebSocket
 * Replaces the old SSE-based implementation
 */
export function useRealTimeEvents() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [eventHistory, setEventHistory] = useState<RealtimeEvent[]>([]);

  // Track connection status
  useEffect(() => {
    if (typeof window === "undefined") return;

    const wsManager = getWebSocketManager();
    const checkConnection = () => {
      setIsConnected(wsManager.isConnected());
    };

    // Check immediately
    checkConnection();

    // Check periodically
    const interval = setInterval(checkConnection, 1000);

    return () => clearInterval(interval);
  }, []);

  // Generic event handler
  const handleEvent = useCallback((type: string, data: any) => {
    const realtimeEvent: RealtimeEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    setLastEvent(realtimeEvent);
    setEventHistory((prev) => [...prev.slice(-19), realtimeEvent]);

    // Trigger notifications based on event type
    if (type === "message.new" && data) {
      const message = data as any;
      notifyNewMessage(
        message.from || message.fromUser || "Unknown",
        message.text || message.message || ""
      );
    } else if (type === "node.update" && data) {
      const node = data as any;
      if (node.status === "online" || node.status === "offline") {
        notifyNodeStatus(
          node.longName || node.shortName || "Unknown Node",
          node.status
        );
      }
      if (node.batteryLevel !== undefined && node.batteryLevel < 20) {
        notifyLowBattery(
          node.longName || node.shortName || "Unknown Node",
          node.batteryLevel
        );
      }
    }
  }, []);

  // Subscribe to all event types
  useWebSocketEvent("node.update", (data) => handleEvent("node.update", data));
  useWebSocketEvent("node.new", (data) => handleEvent("node.new", data));
  useWebSocketEvent("message.new", (data) => handleEvent("message.new", data));
  useWebSocketEvent("device.stats", (data) => handleEvent("device.stats", data));
  useWebSocketEvent("device.connection", (data) => handleEvent("device.connection", data));
  useWebSocketEvent("error", (data) => handleEvent("error", data));

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
