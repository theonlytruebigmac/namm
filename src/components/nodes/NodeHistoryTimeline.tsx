"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimestamp } from "@/lib/utils";
import { apiGet } from "@/lib/api/http";
import {
  Activity,
  MapPin,
  MessageSquare,
  Route,
  Battery,
  Signal,
  Clock,
  Filter,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

interface TimelineEvent {
  id: string;
  type: "telemetry" | "position" | "message" | "traceroute";
  timestamp: number;
  data: Record<string, unknown>;
}

interface NodeHistoryResponse {
  success: boolean;
  nodeId: string;
  events: TimelineEvent[];
  summary: {
    totalEvents: number;
    telemetryCount: number;
    positionCount: number;
    messageCount: number;
    tracerouteCount: number;
    since: number;
  };
}

interface NodeHistoryTimelineProps {
  nodeId: string;
  nodeName?: string;
  onClose?: () => void;
}

const EVENT_ICONS = {
  telemetry: Activity,
  position: MapPin,
  message: MessageSquare,
  traceroute: Route,
} as const;

const EVENT_COLORS = {
  telemetry: "text-[hsl(var(--blue))]",
  position: "text-[hsl(var(--green))]",
  message: "text-[hsl(var(--mauve))]",
  traceroute: "text-[hsl(var(--yellow))]",
} as const;

const EVENT_LABELS = {
  telemetry: "Telemetry",
  position: "Position",
  message: "Message",
  traceroute: "Traceroute",
} as const;

function useNodeHistory(nodeId: string, type?: string) {
  return useQuery({
    queryKey: ["nodeHistory", nodeId, type],
    queryFn: async (): Promise<NodeHistoryResponse> => {
      const params = type && type !== "all" ? `?type=${type}` : "";
      return apiGet<NodeHistoryResponse>(`/api/nodes/${nodeId}/history${params}`);
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });
}

function TelemetryEventCard({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      {data.batteryLevel !== undefined && data.batteryLevel !== null && (
        <div className="flex items-center gap-1">
          <Battery className="h-3 w-3" />
          <span>{String(data.batteryLevel)}%</span>
        </div>
      )}
      {data.voltage !== undefined && data.voltage !== null && (
        <div className="flex items-center gap-1">
          <span className="text-[hsl(var(--muted-foreground))]">Voltage:</span>
          <span>{Number(data.voltage).toFixed(2)}V</span>
        </div>
      )}
      {data.snr !== undefined && data.snr !== null && (
        <div className="flex items-center gap-1">
          <Signal className="h-3 w-3" />
          <span>{Number(data.snr).toFixed(1)}dB</span>
        </div>
      )}
      {data.uptime !== undefined && data.uptime !== null && (
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{formatUptime(Number(data.uptime))}</span>
        </div>
      )}
    </div>
  );
}

function PositionEventCard({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-1 text-sm">
      <div className="font-mono text-xs">
        {Number(data.latitude).toFixed(6)}°, {Number(data.longitude).toFixed(6)}°
      </div>
      {data.altitude !== undefined && data.altitude !== null && (
        <div className="text-[hsl(var(--muted-foreground))]">
          Altitude: {String(data.altitude)}m
        </div>
      )}
    </div>
  );
}

function MessageEventCard({ data }: { data: Record<string, unknown> }) {
  const text = data.text ? String(data.text) : null;
  return (
    <div className="space-y-1 text-sm">
      <div className="text-[hsl(var(--muted-foreground))]">
        To: {data.toId === "^all" ? "Broadcast" : String(data.toId)}
      </div>
      {text && (
        <div className="truncate text-[hsl(var(--foreground))]">
          &ldquo;{text}&rdquo;
        </div>
      )}
    </div>
  );
}

function TracerouteEventCard({ data }: { data: Record<string, unknown> }) {
  const hops = Number(data.hops);
  return (
    <div className="space-y-1 text-sm">
      <div className="flex items-center gap-2">
        <Badge variant={data.success ? "default" : "destructive"} className="text-xs">
          {data.success ? "Success" : "Failed"}
        </Badge>
        <span className="text-[hsl(var(--muted-foreground))]">
          {hops} hop{hops !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="text-[hsl(var(--muted-foreground))]">
        {data.direction === "outgoing" ? "To:" : "From:"}{" "}
        {data.direction === "outgoing" ? String(data.toId) : String(data.fromId)}
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

export function NodeHistoryTimeline({ nodeId, nodeName, onClose }: NodeHistoryTimelineProps) {
  const [filterType, setFilterType] = useState<string>("all");
  const { data, isLoading, error } = useNodeHistory(nodeId, filterType);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Activity Timeline
            </CardTitle>
            <CardDescription>
              {nodeName || nodeId}
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-1 pt-2">
          {["all", "telemetry", "position", "message", "traceroute"].map((type) => (
            <Button
              key={type}
              variant={filterType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType(type)}
              className="text-xs"
            >
              {type === "all" ? "All" : EVENT_LABELS[type as keyof typeof EVENT_LABELS]}
              {data?.summary && type !== "all" && (
                <span className="ml-1 text-[hsl(var(--muted-foreground))]">
                  ({data.summary[`${type}Count` as keyof typeof data.summary]})
                </span>
              )}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-center text-[hsl(var(--muted-foreground))]">
            Failed to load history
          </div>
        ) : data?.events.length === 0 ? (
          <div className="p-8 text-center text-[hsl(var(--muted-foreground))]">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No activity recorded for this node</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-[hsl(var(--border))]" />

            {/* Events */}
            <div className="space-y-4">
              {data?.events.map((event) => {
                const Icon = EVENT_ICONS[event.type];
                const colorClass = EVENT_COLORS[event.type];

                return (
                  <div key={event.id} className="relative flex gap-3 pl-0">
                    {/* Icon */}
                    <div
                      className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] ${colorClass}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs">
                          {EVENT_LABELS[event.type]}
                        </Badge>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                          {formatTimestamp(event.timestamp)}
                        </span>
                      </div>
                      <div className="p-2 bg-[hsl(var(--muted))] rounded-lg">
                        {event.type === "telemetry" && <TelemetryEventCard data={event.data} />}
                        {event.type === "position" && <PositionEventCard data={event.data} />}
                        {event.type === "message" && <MessageEventCard data={event.data} />}
                        {event.type === "traceroute" && <TracerouteEventCard data={event.data} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            {data?.summary && data.summary.totalEvents > data.events.length && (
              <div className="pt-4 text-center">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Showing {data.events.length} of {data.summary.totalEvents} events
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
