"use client";

import { useRealtimeUpdates } from "@/hooks/useWebSocket";
import { useEffect, useState } from "react";

/**
 * Inner component that uses WebSocket hooks
 */
function WebSocketManager() {
  useRealtimeUpdates();
  return null;
}

/**
 * WebSocket Provider
 * 
 * Initializes WebSocket connection and enables real-time updates for:
 * - Node updates (new nodes, position changes)
 * - Message updates (new messages)
 * - Device statistics
 * - Connection status
 */
export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <>
      {isClient && <WebSocketManager />}
      {children}
    </>
  );
}
