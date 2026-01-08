"use client";

import { useRealtimeUpdates, useSSE } from "@/hooks/useSSE";
import { useEffect, useState } from "react";

/**
 * Inner component that manages SSE connection
 */
function SSEManager() {
  useSSE(true); // Auto-connect
  useRealtimeUpdates();
  return null;
}

/**
 * Realtime Provider (SSE-based)
 *
 * Initializes SSE connection and enables real-time updates for:
 * - Node updates (new nodes, position changes)
 * - Message updates (new messages)
 * - Device statistics
 * - Connection status
 *
 * @deprecated - exported as WebSocketProvider for backwards compatibility
 */
export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <>
      {isClient && <SSEManager />}
      {children}
    </>
  );
}

// Also export as SSEProvider for new code
export { WebSocketProvider as SSEProvider };
