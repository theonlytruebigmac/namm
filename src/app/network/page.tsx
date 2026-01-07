"use client";

import { useNodes } from "@/hooks/useNodes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { NetworkHealth } from "@/components/network/network-health";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Network as NetworkIcon, Zap, Radio, Filter, Box, Square } from "lucide-react";
import { useState } from "react";
import dynamic from "next/dynamic";

// Dynamically import NetworkGraph to avoid SSR issues
const NetworkGraph = dynamic(() => import("@/components/network/NetworkGraph").then(mod => ({ default: mod.NetworkGraph })), {
  ssr: false,
  loading: () => <div className="h-[600px] flex items-center justify-center bg-muted">Loading network graph...</div>
});

const NetworkGraph3D = dynamic(() => import("@/components/network/NetworkGraph3D").then(mod => ({ default: mod.NetworkGraph3D })), {
  ssr: false,
  loading: () => <div className="h-[600px] flex items-center justify-center bg-muted">Loading 3D network graph...</div>
});

export default function NetworkPage() {
  const { data: nodes, isLoading } = useNodes();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");

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
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Empty state when no nodes have been discovered
  if (!nodes || nodes.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">
            Network Graph
          </h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            Visualize mesh network topology and connections
          </p>
        </div>
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={NetworkIcon}
              title="No Network Data"
              description="No nodes have been discovered yet. Connect to your mesh network via MQTT or USB serial to visualize the network topology."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeNodes = nodes?.filter(n => Date.now() - n.lastHeard < 3600000) || [];
  const selected = nodes?.find(n => n.id === selectedNode);

  // Calculate network statistics
  const avgHops = (nodes && nodes.length > 0)
    ? nodes.reduce((acc, n) => acc + (n.hopsAway || 0), 0) / nodes.length
    : 0;
  const totalNeighbors = nodes?.reduce((acc, n) => acc + (n.neighborCount || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">
          Network Graph
        </h1>
        <p className="text-[hsl(var(--muted-foreground))]">
          Visualize mesh network topology and connections
        </p>
      </div>

      {/* Network Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Nodes"
          value={nodes?.length || 0}
          description={`${activeNodes.length} currently active`}
          icon={Radio}
          color="default"
        />

        <StatCard
          title="Avg Hops"
          value={avgHops.toFixed(1)}
          description="Network depth"
          icon={Zap}
          color="blue"
        />

        <StatCard
          title="Connections"
          value={totalNeighbors}
          description="Total neighbor links"
          icon={NetworkIcon}
          color="green"
        />

        <StatCard
          title="Uptime"
          value={`${((activeNodes.length / (nodes?.length || 1)) * 100).toFixed(0)}%`}
          description="Node availability"
          icon={Filter}
          color="yellow"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Interactive Network Graph */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Network Topology</CardTitle>
                <CardDescription>
                  Interactive {viewMode === "3d" ? "3D" : "2D"} force-directed graph showing mesh connections
                </CardDescription>
              </div>
              <div className="flex gap-1 bg-muted p-1 rounded-lg">
                <Button
                  variant={viewMode === "2d" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("2d")}
                  className="gap-1"
                >
                  <Square className="h-4 w-4" />
                  2D
                </Button>
                <Button
                  variant={viewMode === "3d" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("3d")}
                  className="gap-1"
                >
                  <Box className="h-4 w-4" />
                  3D
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[500px] relative overflow-hidden rounded-b-lg">
              {viewMode === "3d" ? (
                <NetworkGraph3D
                  nodes={nodes || []}
                  onNodeClick={setSelectedNode}
                  highlightNode={selectedNode}
                />
              ) : (
                <NetworkGraph nodes={nodes || []} />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar with Network Health and Node List */}
        <div className="space-y-4">
          <NetworkHealth nodes={nodes || []} />

          {/* Node Details */}
          <Card>
          <CardHeader>
            <CardTitle>Node Details</CardTitle>
            <CardDescription>
              {selectedNode ? "Selected node information" : "Click a node to view details"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selected ? (
              <div className="space-y-4">
                <div className="text-center pb-4 border-b border-[hsl(var(--border))]">
                  <div className="text-2xl font-mono font-bold text-[hsl(var(--primary))]">
                    {selected.shortName}
                  </div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                    {selected.longName}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Role</div>
                    <Badge variant="secondary">
                      {selected.role.toLowerCase().replace("_", " ")}
                    </Badge>
                  </div>

                  {selected.batteryLevel !== undefined && (
                    <div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Battery</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[hsl(var(--green))]"
                            style={{ width: `${selected.batteryLevel}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{selected.batteryLevel}%</span>
                      </div>
                    </div>
                  )}

                  {selected.snr !== undefined && (
                    <div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">SNR</div>
                      <div className="text-lg font-bold">{selected.snr.toFixed(1)} dB</div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Hops Away</div>
                    <div className="text-lg font-bold">{selected.hopsAway || 0}</div>
                  </div>

                  <div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Neighbors</div>
                    <div className="text-lg font-bold">{selected.neighborCount || 0}</div>
                  </div>
                </div>

                <Button variant="outline" className="w-full" onClick={() => setSelectedNode(null)}>
                  Clear Selection
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {nodes?.slice(0, 8).map((node) => (
                  <button
                    key={node.id}
                    onClick={() => setSelectedNode(node.id)}
                    className="w-full text-left p-3 rounded-lg bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent))] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-mono font-semibold text-[hsl(var(--primary))]">
                        {node.shortName}
                      </div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        {node.hopsAway || 0} hops
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
