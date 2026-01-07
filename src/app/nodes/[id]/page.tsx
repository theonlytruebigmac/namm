"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useNodes } from "@/hooks/useNodes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { apiGet, apiPost } from "@/lib/api/http";
import { formatTimestamp, cn } from "@/lib/utils";
import { NODE_ROLE_LABELS, HARDWARE_MODEL_LABELS, type Node } from "@/types";
import Link from "next/link";
import {
  Radio,
  ArrowLeft,
  Battery,
  Signal,
  MapPin,
  Clock,
  Activity,
  MessageSquare,
  Route,
  Star,
  StarOff,
  Thermometer,
  Wifi,
  Navigation,
  History,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Send,
  Pencil,
} from "lucide-react";
import { useState } from "react";
import dynamic from "next/dynamic";
import { RenameNodeDialog } from "@/components/nodes/RenameNodeDialog";
import { useNodeAliases } from "@/hooks/useNodeAliases";

// Dynamically import MapView to avoid SSR issues
const MapView = dynamic(
  () => import("@/components/map/MapView").then((mod) => ({ default: mod.MapView })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] flex items-center justify-center bg-muted rounded-lg">
        Loading map...
      </div>
    ),
  }
);

interface TimelineEvent {
  id: string;
  type: "telemetry" | "position" | "message" | "traceroute";
  timestamp: number;
  data: Record<string, unknown>;
}

interface HistoryResponse {
  events: TimelineEvent[];
  nodeId: string;
  count: number;
}

function useNodeHistory(nodeId: string, type: string = "all", limit: number = 50) {
  return useQuery({
    queryKey: ["node-history", nodeId, type, limit],
    queryFn: async (): Promise<TimelineEvent[]> => {
      const response = await apiGet<HistoryResponse>(
        `/api/nodes/${nodeId}/history?type=${type}&limit=${limit}`
      );
      return response.events || [];
    },
    enabled: !!nodeId,
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

function toggleFavorite(nodeId: string, isFavorite: boolean) {
  return apiPost(`/api/nodes/${nodeId}/favorite`, { favorite: !isFavorite });
}

const eventTypeConfig = {
  telemetry: {
    icon: Activity,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    label: "Telemetry",
  },
  position: {
    icon: MapPin,
    color: "text-green-500",
    bg: "bg-green-500/10",
    label: "Position",
  },
  message: {
    icon: MessageSquare,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    label: "Message",
  },
  traceroute: {
    icon: Route,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    label: "Traceroute",
  },
};

function TimelineEventCard({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false);
  const config = eventTypeConfig[event.type];
  const Icon = config.icon;

  const renderEventContent = () => {
    switch (event.type) {
      case "telemetry":
        return (
          <div className="grid grid-cols-2 gap-2 text-sm">
            {event.data.batteryLevel != null && (
              <div className="flex items-center gap-1">
                <Battery className="h-3 w-3 text-muted-foreground" />
                <span>{event.data.batteryLevel as number}%</span>
              </div>
            )}
            {event.data.voltage != null && (
              <div className="flex items-center gap-1">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <span>{(event.data.voltage as number).toFixed(2)}V</span>
              </div>
            )}
            {event.data.snr != null && (
              <div className="flex items-center gap-1">
                <Signal className="h-3 w-3 text-muted-foreground" />
                <span>SNR: {(event.data.snr as number).toFixed(1)} dB</span>
              </div>
            )}
            {event.data.channelUtilization != null && (
              <div className="flex items-center gap-1">
                <Wifi className="h-3 w-3 text-muted-foreground" />
                <span>Ch: {(event.data.channelUtilization as number).toFixed(1)}%</span>
              </div>
            )}
            {event.data.temperature != null && (
              <div className="flex items-center gap-1">
                <Thermometer className="h-3 w-3 text-muted-foreground" />
                <span>{(event.data.temperature as number).toFixed(1)}°C</span>
              </div>
            )}
          </div>
        );
      case "position":
        return (
          <div className="text-sm space-y-1">
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span>
                {(event.data.latitude as number)?.toFixed(6)},{" "}
                {(event.data.longitude as number)?.toFixed(6)}
              </span>
            </div>
            {event.data.altitude != null && (
              <div className="text-muted-foreground">
                Altitude: {event.data.altitude as number}m
              </div>
            )}
          </div>
        );
      case "message":
        return (
          <div className="text-sm space-y-1">
            <div className="text-foreground">{event.data.text as string}</div>
            <div className="text-muted-foreground text-xs">
              Channel: {event.data.channel as number}
              {event.data.hopsAway != null && ` • ${event.data.hopsAway} hops`}
            </div>
          </div>
        );
      case "traceroute":
        return (
          <div className="text-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">To:</span>
              <span className="font-mono">{event.data.toId as string}</span>
            </div>
            <div className="text-muted-foreground">
              {event.data.hops as number} hops •{" "}
              {(event.data.success as boolean) ? (
                <span className="text-green-500">Success</span>
              ) : (
                <span className="text-red-500">Failed</span>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={cn("p-2 rounded-full", config.bg)}>
          <Icon className={cn("h-4 w-4", config.color)} />
        </div>
        <div className="w-px flex-1 bg-border" />
      </div>
      <div className="flex-1 pb-4">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{config.label}</span>
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(event.timestamp)}
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        {expanded && <div className="mt-2">{renderEventContent()}</div>}
      </div>
    </div>
  );
}

export default function NodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const nodeId = params.id as string;

  const { data: nodes = [], isLoading: nodesLoading } = useNodes();
  const { data: events = [], isLoading: historyLoading, refetch } = useNodeHistory(nodeId);

  const [filterType, setFilterType] = useState<string>("all");
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const { getDisplayName, getAlias } = useNodeAliases();

  const node = nodes.find((n) => n.id === nodeId);
  const nodeAlias = node ? getAlias(node.id) : undefined;

  const handleToggleFavorite = async () => {
    if (!node) return;
    setIsFavoriting(true);
    try {
      await toggleFavorite(nodeId, node.isFavorite || false);
      // Refetch nodes to get updated favorite status
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    } finally {
      setIsFavoriting(false);
    }
  };

  if (nodesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <EmptyState
          icon={Radio}
          title="Node Not Found"
          description={`Could not find node with ID: ${nodeId}`}
          action={{
            label: "View All Nodes",
            onClick: () => router.push("/nodes"),
          }}
        />
      </div>
    );
  }

  const isOnline = Date.now() - node.lastHeard < 30 * 60 * 1000; // 30 minutes
  const filteredEvents =
    filterType === "all" ? events : events.filter((e) => e.type === filterType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">
                {nodeAlias || node.shortName || node.longName || "Unknown"}
              </h1>
              {nodeAlias && (
                <span className="text-sm text-muted-foreground font-mono">
                  ({node.shortName})
                </span>
              )}
              <Badge variant={isOnline ? "default" : "secondary"}>
                {isOnline ? "Online" : "Offline"}
              </Badge>
              {node.isFavorite && <Star className="h-5 w-5 text-yellow-500 fill-current" />}
            </div>
            <p className="text-[hsl(var(--muted-foreground))]">
              {node.longName} • {node.id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRenameDialogOpen(true)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            {nodeAlias ? "Edit Alias" : "Rename"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleFavorite}
            disabled={isFavoriting}
          >
            {node.isFavorite ? (
              <>
                <StarOff className="h-4 w-4 mr-2" />
                Unfavorite
              </>
            ) : (
              <>
                <Star className="h-4 w-4 mr-2" />
                Favorite
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/messages?node=${nodeId}`} className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              <span>Message</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Battery"
          value={node.batteryLevel != null ? `${node.batteryLevel}%` : "N/A"}
          description={node.voltage ? `${node.voltage.toFixed(2)}V` : "No data"}
          icon={Battery}
          color={
            node.batteryLevel == null
              ? "blue"
              : node.batteryLevel > 50
              ? "green"
              : node.batteryLevel > 20
              ? "yellow"
              : "red"
          }
        />
        <StatCard
          title="Signal"
          value={node.snr != null ? `${node.snr.toFixed(1)} dB` : "N/A"}
          description={node.rssi != null ? `RSSI: ${node.rssi} dBm` : "No signal data"}
          icon={Signal}
          color="blue"
        />
        <StatCard
          title="Last Heard"
          value={formatTimestamp(node.lastHeard)}
          description={
            node.hopsAway != null ? `${node.hopsAway} hop${node.hopsAway !== 1 ? "s" : ""} away` : "Direct"
          }
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title="Role"
          value={NODE_ROLE_LABELS[node.role] || node.role}
          description={HARDWARE_MODEL_LABELS[node.hwModel] || node.hwModel}
          icon={Radio}
          color="green"
        />
      </div>

      {/* Node Details & Map */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              Node Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Node Number</span>
                <p className="font-mono">{node.nodeNum}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Node ID</span>
                <p className="font-mono">{node.id}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Hardware</span>
                <p>{HARDWARE_MODEL_LABELS[node.hwModel] || node.hwModel}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Role</span>
                <p>{NODE_ROLE_LABELS[node.role] || node.role}</p>
              </div>
              {node.channelUtilization != null && (
                <div>
                  <span className="text-muted-foreground">Channel Util</span>
                  <p>{node.channelUtilization.toFixed(1)}%</p>
                </div>
              )}
              {node.airUtilTx != null && (
                <div>
                  <span className="text-muted-foreground">Air Util TX</span>
                  <p>{node.airUtilTx.toFixed(1)}%</p>
                </div>
              )}
              {node.uptime != null && (
                <div>
                  <span className="text-muted-foreground">Uptime</span>
                  <p>
                    {node.uptime > 3600
                      ? `${Math.floor(node.uptime / 3600)}h ${Math.floor((node.uptime % 3600) / 60)}m`
                      : `${Math.floor(node.uptime / 60)}m`}
                  </p>
                </div>
              )}
              {node.neighborCount != null && (
                <div>
                  <span className="text-muted-foreground">Neighbors</span>
                  <p>{node.neighborCount}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Position Map */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location
            </CardTitle>
            <CardDescription>
              {node.position
                ? `${node.position.latitude.toFixed(6)}, ${node.position.longitude.toFixed(6)}`
                : "No position data available"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {node.position ? (
              <div className="h-[300px] rounded-lg overflow-hidden">
                <MapView
                  nodes={[node]}
                  showRangeCircles={false}
                  showSignalLines={false}
                  autoCenter={true}
                />
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center bg-muted rounded-lg">
                <div className="text-center text-muted-foreground">
                  <Navigation className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No GPS coordinates</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Activity Timeline
              </CardTitle>
              <CardDescription>Recent activity for this node</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {["all", "telemetry", "position", "message", "traceroute"].map((type) => (
                  <Button
                    key={type}
                    variant={filterType === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterType(type)}
                  >
                    {type === "all" ? "All" : eventTypeConfig[type as keyof typeof eventTypeConfig]?.label}
                  </Button>
                ))}
              </div>
              <Button variant="ghost" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <EmptyState
              icon={History}
              title="No Activity"
              description="No recent activity recorded for this node"
            />
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              {filteredEvents
                .sort((a, b) => b.timestamp - a.timestamp)
                .map((event) => (
                  <TimelineEventCard key={event.id} event={event} />
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rename Dialog */}
      <RenameNodeDialog
        node={node}
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
      />
    </div>
  );
}
