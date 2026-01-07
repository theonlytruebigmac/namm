"use client";

import { useNodes } from "@/hooks/useNodes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { TelemetryCharts } from "@/components/telemetry/TelemetryCharts";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTimestamp } from "@/lib/utils";
import {
  Activity,
  Battery,
  Cpu,
  HardDrive,
  Radio,
  Signal,
  Thermometer,
  Zap,
} from "lucide-react";

export default function TelemetryPage() {
  const { data: nodes, isLoading } = useNodes();

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
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Empty state when no nodes have been discovered
  if (!nodes || nodes.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">
            Telemetry
          </h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            Real-time node health metrics and environmental data
          </p>
        </div>
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={Activity}
              title="No Telemetry Data"
              description="No nodes have been discovered yet. Connect to your mesh network via MQTT or USB serial to start receiving telemetry."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const nodesWithTelemetry = nodes || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">
          Telemetry
        </h1>
        <p className="text-[hsl(var(--muted-foreground))]">
          Real-time node health metrics and environmental data
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Avg Battery"
          value={`${nodes && nodes.length > 0 ? Math.round(nodes.reduce((acc, n) => acc + (n.batteryLevel || 0), 0) / nodes.length) : 0}%`}
          description="Across all nodes"
          icon={Battery}
          color="green"
        />

        <StatCard
          title="Avg SNR"
          value={`${nodes && nodes.length > 0 ? (nodes.reduce((acc, n) => acc + (n.snr || 0), 0) / nodes.length).toFixed(1) : "0.0"} dB`}
          description="Signal quality"
          icon={Signal}
          color="blue"
        />

        <StatCard
          title="Active Nodes"
          value={nodes?.filter(n => Date.now() - n.lastHeard < 3600000).length || 0}
          description="Online in last hour"
          icon={Radio}
          color="green"
        />

        <StatCard
          title="Channel Usage"
          value={`${nodes && nodes.length > 0 ? Math.round(nodes.reduce((acc, n) => acc + (n.channelUtilization || 0), 0) / nodes.length) : 0}%`}
          description="Network utilization"
          icon={Activity}
          color="yellow"
        />
      </div>

      {/* Telemetry Charts */}
      <TelemetryCharts nodes={nodes || []} />

      {/* Node Telemetry Cards */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">Node Details</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {nodesWithTelemetry.map((node) => {
            const isActive = Date.now() - node.lastHeard < 3600000;
            const batteryLevel = node.batteryLevel || 0;
            const batteryVariant = batteryLevel > 50 ? "success" : batteryLevel > 20 ? "secondary" : "destructive";

            return (
              <Card key={node.id} className="hover:border-[hsl(var(--mauve))] transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg font-mono text-[hsl(var(--mauve))]">
                        {node.shortName}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {node.longName}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          isActive ? "bg-[hsl(var(--green))] animate-pulse" : "bg-[hsl(var(--muted))]"
                        }`}
                      />
                      <Badge variant="secondary">
                        {node.role.toLowerCase().replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Battery */}
                  {node.batteryLevel !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-2">
                          <Battery className="h-4 w-4" />
                          Battery Level
                        </span>
                        <Badge variant={batteryVariant}>
                          {batteryLevel}%
                        </Badge>
                      </div>
                      <div className="h-2 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            batteryLevel > 50
                              ? "bg-[hsl(var(--green))]"
                              : batteryLevel > 20
                              ? "bg-[hsl(var(--yellow))]"
                              : "bg-[hsl(var(--red))]"
                          }`}
                          style={{ width: `${batteryLevel}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Signal Quality */}
                  {node.snr !== undefined && (
                    <div className="flex items-center justify-between p-3 bg-[hsl(var(--muted))] rounded-lg">
                      <span className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-2">
                        <Signal className="h-4 w-4" />
                        SNR
                      </span>
                      <span className="text-lg font-bold text-[hsl(var(--blue))]">
                        {node.snr.toFixed(1)} dB
                      </span>
                    </div>
                  )}

                  {/* Network Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[hsl(var(--muted))] rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] mb-1">
                        <Radio className="h-3 w-3" />
                        Hops
                      </div>
                      <div className="text-xl font-bold text-[hsl(var(--primary))]">
                        {node.hopsAway || 0}
                      </div>
                    </div>
                    <div className="p-3 bg-[hsl(var(--muted))] rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] mb-1">
                        <Activity className="h-3 w-3" />
                        Neighbors
                      </div>
                      <div className="text-xl font-bold text-[hsl(var(--green))]">
                        {node.neighborCount || 0}
                      </div>
                    </div>
                  </div>

                  {/* Environmental (Mock Data) */}
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[hsl(var(--border))]">
                    <div className="text-center p-2 bg-[hsl(var(--muted))] rounded">
                      <Thermometer className="h-4 w-4 mx-auto mb-1 text-[hsl(var(--muted-foreground))]" />
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">Temp</div>
                      <div className="text-sm font-bold">
                        {(20 + Math.random() * 10).toFixed(1)}°C
                      </div>
                    </div>
                    <div className="text-center p-2 bg-[hsl(var(--muted))] rounded">
                      <HardDrive className="h-4 w-4 mx-auto mb-1 text-[hsl(var(--muted-foreground))]" />
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">Storage</div>
                      <div className="text-sm font-bold">
                        {Math.round(50 + Math.random() * 40)}%
                      </div>
                    </div>
                    <div className="text-center p-2 bg-[hsl(var(--muted))] rounded">
                      <Cpu className="h-4 w-4 mx-auto mb-1 text-[hsl(var(--muted-foreground))]" />
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">CPU</div>
                      <div className="text-sm font-bold">
                        {Math.round(10 + Math.random() * 30)}%
                      </div>
                    </div>
                  </div>

                  {/* Last Update */}
                  <div className="text-xs text-[hsl(var(--muted-foreground))] text-center pt-2 border-t border-[hsl(var(--border))]">
                    Last update: {formatTimestamp(node.lastHeard)}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
