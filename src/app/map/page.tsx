"use client";

import { useNodes } from "@/hooks/useNodes";
import { useSettings } from "@/hooks/useSettings";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Map as MapIcon, MapPin, Navigation, Layers, Globe, Route, Flame, GitBranch, Radio } from "lucide-react";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { apiGet } from "@/lib/api/http";
import type { TracerouteOverlay, HeatmapOptions, TrajectoryOptions } from "@/components/map/MapView";
import type { HeatmapDataType } from "@/components/map/HeatmapLayer";
import { useTrajectories } from "@/hooks/useTrajectories";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Dynamically import MapView to avoid SSR issues with Leaflet
const MapView = dynamic(() => import("@/components/map/MapView").then(mod => ({ default: mod.MapView })), {
  ssr: false,
  loading: () => <div className="h-[600px] flex items-center justify-center bg-muted">Loading map...</div>
});

interface TracerouteResponse {
  id: number;
  fromId: string;
  toId: string;
  timestamp: number;
  route: number[];
  hops: number;
  success: boolean;
}

function useRecentTraceroutes() {
  return useQuery({
    queryKey: ["traceroutes", "recent", 20],
    queryFn: async (): Promise<TracerouteOverlay[]> => {
      const response = await apiGet<{ traceroutes: TracerouteResponse[] }>("/api/traceroutes?limit=20");
      return (response.traceroutes || []).map(t => ({
        id: t.id,
        route: t.route,
        hops: t.hops,
        success: t.success,
        timestamp: t.timestamp
      }));
    },
    refetchInterval: 30000,
    staleTime: 15000
  });
}

export default function MapPage() {
  const { data: nodes = [], isLoading } = useNodes();
  const { data: traceroutes = [] } = useRecentTraceroutes();
  const settings = useSettings();
  const trajectoryState = useTrajectories();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [mapLayer, setMapLayer] = useState<"street" | "satellite" | "terrain">(settings.defaultMapLayer);
  const [showRangeCircles, setShowRangeCircles] = useState(false);
  const [showTraceroutes, setShowTraceroutes] = useState(false);
  const [showSignalPropagation, setShowSignalPropagation] = useState(false);
  const [heatmap, setHeatmap] = useState<HeatmapOptions>({
    enabled: false,
    dataType: "node-density",
    radius: 30,
    blur: 20,
    opacity: 0.6,
  });

  const toggleHeatmap = () => {
    setHeatmap((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  const setHeatmapType = (type: string) => {
    setHeatmap((prev) => ({
      ...prev,
      dataType: type as HeatmapDataType,
      enabled: true,
    }));
  };

  // Update map layer when settings change
  useEffect(() => {
    setMapLayer(settings.defaultMapLayer);
  }, [settings.defaultMapLayer]);

  // Track node movements for trajectories
  useEffect(() => {
    if (trajectoryState.enabled && nodes.length > 0) {
      trajectoryState.trackNodes(nodes);
    }
  }, [nodes, trajectoryState.enabled]);

  // Prepare trajectory options for MapView
  const trajectoryOptions: TrajectoryOptions = {
    enabled: trajectoryState.enabled,
    trajectories: trajectoryState.trajectories,
    config: trajectoryState.config,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="aspect-video rounded-lg" />
      </div>
    );
  }

  const nodesWithPosition = nodes?.filter(n => n.position) || [];
  const selected = nodes?.find(n => n.id === selectedNode);

  // Calculate center point
  const centerLat = nodesWithPosition.reduce((acc, n) => acc + (n.position?.latitude || 0), 0) / (nodesWithPosition.length || 1);
  const centerLon = nodesWithPosition.reduce((acc, n) => acc + (n.position?.longitude || 0), 0) / (nodesWithPosition.length || 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">
            Map View
          </h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            {nodesWithPosition.length} nodes with GPS coordinates
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showRangeCircles ? "default" : "outline"}
            size="sm"
            onClick={() => setShowRangeCircles(!showRangeCircles)}
          >
            <Globe className="h-4 w-4 mr-2" />
            Range
          </Button>
          <Button
            variant={showTraceroutes ? "default" : "outline"}
            size="sm"
            onClick={() => setShowTraceroutes(!showTraceroutes)}
          >
            <Route className="h-4 w-4 mr-2" />
            Routes
          </Button>
          <Button
            variant={showSignalPropagation ? "default" : "outline"}
            size="sm"
            onClick={() => setShowSignalPropagation(!showSignalPropagation)}
            title="Show signal propagation ranges"
          >
            <Radio className="h-4 w-4 mr-2" />
            Propagation
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={heatmap.enabled ? "default" : "outline"}
                size="sm"
              >
                <Flame className="h-4 w-4 mr-2" />
                Heatmap
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Heatmap Data</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={heatmap.enabled ? heatmap.dataType : ""}
                onValueChange={setHeatmapType}
              >
                <DropdownMenuRadioItem value="node-density">
                  Node Density
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="signal-strength">
                  Signal Strength
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="channel-utilization">
                  Channel Utilization
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="battery-levels">
                  Battery Levels
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="activity">
                  Activity
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              {heatmap.enabled && (
                <>
                  <DropdownMenuSeparator />
                  <div className="p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={toggleHeatmap}
                    >
                      Hide Heatmap
                    </Button>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={trajectoryState.enabled ? "default" : "outline"}
                size="sm"
              >
                <GitBranch className="h-4 w-4 mr-2" />
                Paths
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Node Trajectories</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="p-2 space-y-2">
                <Button
                  variant={trajectoryState.enabled ? "default" : "outline"}
                  size="sm"
                  className="w-full"
                  onClick={trajectoryState.toggle}
                >
                  {trajectoryState.enabled ? "Stop Tracking" : "Start Tracking"}
                </Button>
                {trajectoryState.trajectories.length > 0 && (
                  <>
                    <div className="text-xs text-muted-foreground py-1">
                      Tracking {trajectoryState.trajectories.length} nodes
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-destructive"
                      onClick={trajectoryState.clearAll}
                    >
                      Clear All Paths
                    </Button>
                  </>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Map Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Nodes on Map"
          value={nodesWithPosition.length}
          description={`of ${nodes?.length || 0} total nodes`}
          icon={MapPin}
          color="green"
        />

        <StatCard
          title="Center Point"
          value={`${centerLat.toFixed(4)}°`}
          description={`${centerLon.toFixed(4)}° longitude`}
          icon={Navigation}
          color="blue"
        />

        <StatCard
          title="Coverage Area"
          value="Phase 2"
          description="Geographic spread"
          icon={Globe}
          color="yellow"
        />

        <StatCard
          title="Active Nodes"
          value={nodesWithPosition.filter(n => Date.now() - n.lastHeard < 3600000).length}
          description="Online with GPS"
          icon={MapIcon}
          color="default"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Interactive Leaflet Map */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Interactive Map</CardTitle>
                <CardDescription>
                  Real-time node positions with GPS tracking
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={mapLayer === "street" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMapLayer("street")}
                >
                  Street
                </Button>
                <Button
                  variant={mapLayer === "satellite" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMapLayer("satellite")}
                >
                  Satellite
                </Button>
                <Button
                  variant={mapLayer === "terrain" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMapLayer("terrain")}
                >
                  Terrain
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[500px] relative overflow-hidden rounded-b-lg">
              <MapView
                nodes={nodes}
                mapLayer={mapLayer}
                showRangeCircles={showRangeCircles}
                showSignalLines={false}
                showNodeLabels={settings.showNodeLabels}
                clusterMarkers={settings.clusterMarkers}
                autoCenter={settings.autoCenter}
                traceroutes={traceroutes}
                showTraceroutes={showTraceroutes}
                heatmap={heatmap}
                trajectory={trajectoryOptions}
                showSignalPropagation={showSignalPropagation}
                selectedNodeForSignal={selectedNode}
              />
            </div>
          </CardContent>
        </Card>

        {/* Nodes List */}
        <Card>
          <CardHeader>
            <CardTitle>Nodes</CardTitle>
            <CardDescription>
              Click to view location details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {nodesWithPosition.map((node) => {
                const isActive = Date.now() - node.lastHeard < 3600000;
                const isSelected = selectedNode === node.id;

                return (
                  <button
                    key={node.id}
                    onClick={() => setSelectedNode(node.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      isSelected
                        ? "bg-[hsl(var(--accent))] border border-[hsl(var(--primary))]"
                        : "bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent))]"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            isActive ? "bg-[hsl(var(--green))] animate-pulse" : "bg-[hsl(var(--muted))]"
                          }`}
                        />
                        <div className="font-mono font-semibold text-[hsl(var(--primary))]">
                          {node.shortName}
                        </div>
                      </div>
                      {node.batteryLevel !== undefined && (
                        <Badge variant={node.batteryLevel > 50 ? "success" : "destructive"}>
                          {node.batteryLevel}%
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))] space-y-1">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span>
                          {node.position?.latitude.toFixed(4)}°,{" "}
                          {node.position?.longitude.toFixed(4)}°
                        </span>
                      </div>
                      {node.position?.altitude && (
                        <div>Altitude: {node.position.altitude}m</div>
                      )}
                      {node.role && (
                        <div className="mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {node.role.toLowerCase().replace("_", " ")}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
