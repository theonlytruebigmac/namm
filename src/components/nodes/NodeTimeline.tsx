"use client";

import { useState } from "react";
import {
  Battery,
  MapPin,
  MessageSquare,
  Route,
  Clock,
  Thermometer,
  Signal,
  ChevronDown,
  ChevronUp,
  Filter
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNodeHistory, type TimelineEvent, type TimelineEventType } from "@/hooks/useNodeHistory";

interface NodeTimelineProps {
  nodeId: string;
  shortName?: string;
  className?: string;
}

const EVENT_ICONS: Record<TimelineEventType, React.ReactNode> = {
  telemetry: <Battery className="h-4 w-4" />,
  position: <MapPin className="h-4 w-4" />,
  message: <MessageSquare className="h-4 w-4" />,
  traceroute: <Route className="h-4 w-4" />,
};

const EVENT_COLORS: Record<TimelineEventType, string> = {
  telemetry: "bg-blue-500",
  position: "bg-green-500",
  message: "bg-purple-500",
  traceroute: "bg-orange-500",
};

const EVENT_LABELS: Record<TimelineEventType, string> = {
  telemetry: "Telemetry",
  position: "Position",
  message: "Message",
  traceroute: "Traceroute",
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function TelemetryEventDetails({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {data.batteryLevel !== undefined && (
        <div className="flex items-center gap-1">
          <Battery className="h-3 w-3 text-green-500" />
          <span>{data.batteryLevel as number}%</span>
        </div>
      )}
      {data.voltage !== undefined && (
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Voltage:</span>
          <span>{(data.voltage as number).toFixed(2)}V</span>
        </div>
      )}
      {data.temperature !== undefined && (
        <div className="flex items-center gap-1">
          <Thermometer className="h-3 w-3 text-orange-500" />
          <span>{data.temperature as number}°C</span>
        </div>
      )}
      {data.snr !== undefined && (
        <div className="flex items-center gap-1">
          <Signal className="h-3 w-3 text-blue-500" />
          <span>SNR: {(data.snr as number).toFixed(1)} dB</span>
        </div>
      )}
      {data.channelUtilization !== undefined && (
        <div className="col-span-2 flex items-center gap-1">
          <span className="text-muted-foreground">Channel:</span>
          <span>{(data.channelUtilization as number).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

function PositionEventDetails({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="text-xs space-y-1">
      <div className="font-mono">
        {(data.latitude as number).toFixed(5)}°, {(data.longitude as number).toFixed(5)}°
      </div>
      {data.altitude !== undefined && (
        <div className="text-muted-foreground">
          Altitude: {data.altitude as number}m
        </div>
      )}
    </div>
  );
}

function MessageEventDetails({ data }: { data: Record<string, unknown> }) {
  const text = data.text as string | undefined;
  return (
    <div className="text-xs space-y-1">
      <div className="text-muted-foreground">
        Channel {data.channel as number}
      </div>
      {text && (
        <div className="bg-muted p-2 rounded text-sm">
          &ldquo;{text}&rdquo;
        </div>
      )}
    </div>
  );
}

function TracerouteEventDetails({ data }: { data: Record<string, unknown> }) {
  const isOutgoing = data.direction === "outgoing";
  return (
    <div className="text-xs space-y-1">
      <Badge variant={data.success ? "success" : "destructive"}>
        {data.success ? "Success" : "Failed"}
      </Badge>
      <div className="text-muted-foreground">
        {isOutgoing ? "To" : "From"}: {(data.toId || data.fromId) as string}
      </div>
      <div className="text-muted-foreground">{data.hops as number} hops</div>
    </div>
  );
}

function TimelineEventItem({ event, isExpanded, onToggle }: {
  event: TimelineEvent;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const renderDetails = () => {
    switch (event.type) {
      case "telemetry":
        return <TelemetryEventDetails data={event.data} />;
      case "position":
        return <PositionEventDetails data={event.data} />;
      case "message":
        return <MessageEventDetails data={event.data} />;
      case "traceroute":
        return <TracerouteEventDetails data={event.data} />;
      default:
        return <pre className="text-xs">{JSON.stringify(event.data, null, 2)}</pre>;
    }
  };

  return (
    <div className="flex gap-3">
      {/* Timeline line and dot */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full ${EVENT_COLORS[event.type]} flex items-center justify-center text-white`}>
          {EVENT_ICONS[event.type]}
        </div>
        <div className="w-0.5 flex-1 bg-border" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <button
          onClick={onToggle}
          className="w-full text-left hover:bg-accent rounded-lg p-2 -ml-2 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {EVENT_LABELS[event.type]}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatTimeAgo(event.timestamp)}
              </span>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          {isExpanded && (
            <div className="mt-2 text-muted-foreground">
              <div className="flex items-center gap-1 text-xs mb-2">
                <Clock className="h-3 w-3" />
                {formatTimestamp(event.timestamp)}
              </div>
              {renderDetails()}
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

export function NodeTimeline({ nodeId, shortName, className = "" }: NodeTimelineProps) {
  const [filter, setFilter] = useState<TimelineEventType | "all">("all");
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useNodeHistory({
    nodeId,
    type: filter,
    limit: 100,
  });

  const toggleEvent = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>Loading history...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.success) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>Failed to load history</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Unable to fetch node history. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  const events = data.events;
  const summary = data.summary;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Activity Timeline
            </CardTitle>
            <CardDescription>
              {shortName ? `History for ${shortName}` : "Node activity history"}
            </CardDescription>
          </div>
          <Badge variant="secondary">
            {summary.totalEvents} events
          </Badge>
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-1 mt-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            <Filter className="h-3 w-3 mr-1" />
            All
          </Button>
          {(["telemetry", "position", "message", "traceroute"] as TimelineEventType[]).map((type) => (
            <Button
              key={type}
              variant={filter === type ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(type)}
              className="gap-1"
            >
              {EVENT_ICONS[type]}
              {EVENT_LABELS[type]}
              <Badge variant="secondary" className="ml-1 text-xs">
                {type === "telemetry" ? summary.telemetryCount :
                 type === "position" ? summary.positionCount :
                 type === "message" ? summary.messageCount :
                 summary.tracerouteCount}
              </Badge>
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No activity recorded</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-0">
              {events.map((event) => (
                <TimelineEventItem
                  key={event.id}
                  event={event}
                  isExpanded={expandedEvents.has(event.id)}
                  onToggle={() => toggleEvent(event.id)}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default NodeTimeline;
