"use client";

import { useRealTimeEvents } from "@/hooks/useRealTimeEvents";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Radio, MessageSquare, MapPin, Wifi, WifiOff } from "lucide-react";
import { formatTimestamp } from "@/lib/utils";

export function LiveActivityFeed() {
  const { connected, eventHistory } = useRealTimeEvents();

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "nodeUpdate":
        return <Radio className="h-4 w-4 text-blue-500" />;
      case "newMessage":
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case "positionUpdate":
        return <MapPin className="h-4 w-4 text-amber-500" />;
      case "connected":
        return <Wifi className="h-4 w-4 text-green-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEventDescription = (event: any) => {
    switch (event.type) {
      case "connected":
        return "Connected to real-time updates";
      case "nodeUpdate":
        return `Node ${event.data?.nodeId} updated - Battery: ${event.data?.batteryLevel}%`;
      case "newMessage":
        return `New message from ${event.data?.fromNode}`;
      case "positionUpdate":
        return `Position updated for ${event.data?.nodeId}`;
      case "heartbeat":
        return "Connection heartbeat";
      default:
        return "System event";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Live Activity
            </CardTitle>
            <CardDescription>Real-time network events</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {connected ? (
              <>
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Live
                </Badge>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-gray-400" />
                <Badge variant="outline" className="text-gray-600 border-gray-600">
                  Mock
                </Badge>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] overflow-y-auto pr-4">
          <div className="space-y-3">
            {eventHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Waiting for events...
              </div>
            ) : (
              eventHistory
                .slice()
                .reverse()
                .map((event, idx) => (
                  <div
                    key={`${event.timestamp}-${idx}`}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted hover:bg-accent transition-colors"
                  >
                    <div className="mt-0.5">{getEventIcon(event.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        {getEventDescription(event)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimestamp(event.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
