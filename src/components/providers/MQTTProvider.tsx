"use client";

/**
 * MQTT Provider Component
 *
 * Connects to server-side MQTT handler via SSE
 */

import { useEffect } from "react";
import { useMQTTServer } from "@/hooks/useMQTTServer";

interface MQTTProviderProps {
  children: React.ReactNode;
}

export function MQTTProvider({ children }: MQTTProviderProps) {
  const { isConnected, error, messageCount } = useMQTTServer();

  useEffect(() => {
    if (isConnected) {
      console.log("✅ MQTT Provider: Connected to server-side MQTT");
    }
  }, [isConnected]);

  useEffect(() => {
    if (error) {
      console.error("❌ MQTT Provider: Error:", error);
    }
  }, [error]);

  useEffect(() => {
    if (messageCount > 0) {
      console.log(`📊 MQTT Provider: ${messageCount} messages received`);
    }
  }, [messageCount]);

  return <>{children}</>;
}
