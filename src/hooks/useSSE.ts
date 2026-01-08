/**
 * SSE Hooks
 *
 * React hooks for Server-Sent Events integration
 * Drop-in replacement for WebSocket hooks
 */

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getSSEManager,
  type EventHandler,
  type SSEEventType,
} from "@/lib/api/sse";
import type { Node, Message } from "@/types";

/**
 * Hook to manage SSE connection lifecycle
 */
export function useSSE(autoConnect = true) {
  const sseManager = useRef<ReturnType<typeof getSSEManager> | null>(null);

  // Initialize manager client-side only
  useEffect(() => {
    if (!sseManager.current) {
      sseManager.current = getSSEManager();
    }
  }, []);

  useEffect(() => {
    if (!sseManager.current) return;

    if (autoConnect) {
      sseManager.current.connect();
    }

    // No cleanup - singleton connection stays alive
  }, [autoConnect]);

  const connect = useCallback(() => {
    sseManager.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    sseManager.current?.disconnect();
  }, []);

  const isConnected = useCallback(() => {
    return sseManager.current?.isConnected() ?? false;
  }, []);

  return {
    connect,
    disconnect,
    isConnected,
  };
}

/**
 * Hook to subscribe to SSE events
 */
export function useSSEEvent<T = unknown>(
  event: SSEEventType,
  handler: EventHandler<T>
) {
  const sseManager = useRef<ReturnType<typeof getSSEManager> | null>(null);
  const handlerRef = useRef(handler);

  // Initialize manager client-side only
  useEffect(() => {
    if (!sseManager.current) {
      sseManager.current = getSSEManager();
    }
  }, []);

  // Keep handler ref up to date
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!sseManager.current) return;

    const wrappedHandler = (data: unknown) => {
      handlerRef.current(data as T);
    };

    const unsubscribe = sseManager.current.on(event, wrappedHandler as EventHandler<unknown>);

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

  useSSEEvent<Node>("node.update", (node) => {
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

  useSSEEvent<Node>("node.new", (node) => {
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

  useSSEEvent<Message>("message.new", (message) => {
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

  useSSEEvent<{
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
  useSSEEvent<{ connected: boolean; reason?: string }>(
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
 * Combined hook for all real-time updates
 */
export function useRealtimeUpdates() {
  useNodeUpdates();
  useMessageUpdates();
  useDeviceStatsUpdates();
}

// Re-export types
export type { SSEEventType, EventHandler };
