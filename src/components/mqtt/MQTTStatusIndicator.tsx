"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { useMQTTServer } from "@/hooks/useMQTTServer";
import { Activity, Radio, MessageSquare, MapPin } from "lucide-react";

export function MQTTStatusIndicator() {
  const { isConnected, error, messageCount } = useMQTTServer();
  const [lastActivity, setLastActivity] = useState<Date | null>(null);

  useEffect(() => {
    if (messageCount > 0) {
      setLastActivity(new Date());
    }
  }, [messageCount]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">MQTT Status</span>
        <Badge variant={isConnected ? "default" : "secondary"} className="gap-1">
          <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-gray-500"}`} />
          {isConnected ? "Connected" : "Disconnected"}
        </Badge>
      </div>

      {error && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 p-2 rounded">
          {error}
        </div>
      )}

      {isConnected && (
        <div className="bg-muted p-2 rounded-lg">
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
            <MessageSquare className="h-3 w-3" />
            <span>Messages Received</span>
          </div>
          <div className="text-lg font-bold text-center">{messageCount}</div>
        </div>
      )}

      {lastActivity && isConnected && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="h-3 w-3" />
          <span>Last activity: {formatRelativeTime(lastActivity)}</span>
        </div>
      )}

      {isConnected && !lastActivity && (
        <div className="text-xs text-muted-foreground text-center py-2">
          Waiting for MQTT data...
        </div>
      )}

      <div className="text-xs text-muted-foreground pt-2 border-t">
        ℹ️ Server-side MQTT connection (supports mqtt:// protocol)
      </div>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
