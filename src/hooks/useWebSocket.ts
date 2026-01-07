/**
 * WebSocket Hooks
 *
 * React hooks for WebSocket integration
 */

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getWebSocketManager,
  type EventHandler,
  type WebSocketEventType,
} from "@/lib/api/websocket";
import type { Node, Message } from "@/types";

/**
 * Hook to manage WebSocket connection lifecycle
 */
export function useWebSocket(autoConnect = true) {
  const wsManager = useRef<ReturnType<typeof getWebSocketManager> | null>(null);

  // Initialize manager client-side only
  useEffect(() => {
    if (!wsManager.current) {
      wsManager.current = getWebSocketManager();
    }
  }, []);

  useEffect(() => {
    if (!wsManager.current) return;

    // Only connect if autoConnect is true
    // Do NOT disconnect on cleanup - this is a singleton shared across components
    if (autoConnect) {
      wsManager.current.connect();
    }

    // No cleanup - singleton connection stays alive
  }, [autoConnect]);

  const connect = useCallback(() => {
    wsManager.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    wsManager.current?.disconnect();
  }, []);

  const isConnected = useCallback(() => {
    return wsManager.current?.isConnected() ?? false;
  }, []);

  return {
    connect,
    disconnect,
    isConnected,
  };
}

/**
 * Hook to subscribe to WebSocket events
 */
export function useWebSocketEvent<T = unknown>(
  event: WebSocketEventType,
  handler: EventHandler<T>
) {
  const wsManager = useRef<ReturnType<typeof getWebSocketManager> | null>(null);
  const handlerRef = useRef(handler);

  // Initialize manager client-side only
  useEffect(() => {
    if (!wsManager.current) {
      wsManager.current = getWebSocketManager();
    }
  }, []);

  // Keep handler ref up to date
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!wsManager.current) return;

    const wrappedHandler = (data: unknown) => {
      handlerRef.current(data as T);
    };

    const unsubscribe = wsManager.current.on(event, wrappedHandler as EventHandler<unknown>);

    return () => {
      unsubscribe();
    };
  }, [event]);
}

/**
 * Hook for real-time node updates
 */
export function useNodeUpdates() {
  const queryClient = useQueryClient();

  useWebSocketEvent<Node>("node.update", (node) => {
    // Update the nodes cache
    queryClient.setQueryData(["nodes"], (oldData: Node[] | undefined) => {
      if (!oldData) return [node];

      const index = oldData.findIndex((n) => n.id === node.id);
      if (index >= 0) {
        const newData = [...oldData];
        newData[index] = { ...newData[index], ...node };
        return newData;
      }

      return [...oldData, node];
    });

    // Invalidate related queries
    queryClient.invalidateQueries({ queryKey: ["node", node.id] });
  });

  useWebSocketEvent<Node>("node.new", (node) => {
    // Add new node to cache
    queryClient.setQueryData(["nodes"], (oldData: Node[] | undefined) => {
      if (!oldData) return [node];

      // Check if node already exists
      const exists = oldData.some((n) => n.id === node.id);
      if (exists) return oldData;

      return [...oldData, node];
    });
  });
}

/**
 * Hook for real-time message updates
 */
export function useMessageUpdates() {
  const queryClient = useQueryClient();

  useWebSocketEvent<Message>("message.new", (message) => {
    // Add new message to cache
    queryClient.setQueryData(
      ["messages"],
      (oldData: Message[] | undefined) => {
        if (!oldData) return [message];

        // Check if message already exists
        const exists = oldData.some((m) => m.id === message.id);
        if (exists) return oldData;

        return [...oldData, message];
      }
    );

    // Invalidate channel messages
    queryClient.invalidateQueries({
      queryKey: ["messages", "channel", message.channel],
    });

    // Invalidate DM conversations if it's a direct message
    if (message.toNode !== "broadcast") {
      queryClient.invalidateQueries({
        queryKey: ["messages", "dm"],
      });
    }
  });
}

/**
 * Hook for device stats updates
 */
export function useDeviceStatsUpdates() {
  const queryClient = useQueryClient();

  useWebSocketEvent<{
    messagesReceived: number;
    messagesSent: number;
    nodesInMesh: number;
    channelUtilization: number;
    airUtilTx: number;
  }>("device.stats", (stats) => {
    queryClient.setQueryData(["device", "stats"], stats);
  });
}

/**
 * Hook for connection status updates
 */
export function useConnectionStatus(
  onConnect?: () => void,
  onDisconnect?: (reason?: string) => void
) {
  useWebSocketEvent<{ connected: boolean; reason?: string }>(
    "device.connection",
    (data) => {
      if (data.connected && onConnect) {
        onConnect();
      } else if (!data.connected && onDisconnect) {
        onDisconnect(data.reason);
      }
    }
  );
}

/**
 * Hook for WebSocket errors
 */
export function useWebSocketErrors(
  onError?: (error: { message: string; code?: string }) => void
) {
  useWebSocketEvent<{ message: string; code?: string }>("error", (error) => {
    console.error("WebSocket error:", error);
    if (onError) {
      onError(error);
    }
  });
}

/**
 * Combined hook for all real-time updates
 */
export function useRealtimeUpdates() {
  useWebSocket(true);
  useNodeUpdates();
  useMessageUpdates();
  useDeviceStatsUpdates();
}
