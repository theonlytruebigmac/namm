"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeviceStats } from "@/hooks/useDeviceStats";
import { Activity, Radio, MessageSquare, TrendingUp } from "lucide-react";

export function DeviceStatsCard() {
  const { data: stats, isLoading, isError } = useDeviceStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Device Statistics
          </CardTitle>
          <CardDescription>Real-time device performance metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Device Statistics
          </CardTitle>
          <CardDescription>Real-time device performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Unable to load device statistics
          </div>
        </CardContent>
      </Card>
    );
  }

  const utilizationColor =
    stats.channelUtilization > 80
      ? "text-red-600 dark:text-red-400"
      : stats.channelUtilization > 50
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-green-600 dark:text-green-400";

  const airUtilColor =
    stats.airUtilTx > 80
      ? "text-red-600 dark:text-red-400"
      : stats.airUtilTx > 50
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-green-600 dark:text-green-400";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Device Statistics
        </CardTitle>
        <CardDescription>Real-time device performance metrics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Messages Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span>Messages Received</span>
            </div>
            <div className="text-2xl font-bold">{stats.messagesReceived.toLocaleString()}</div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span>Messages Sent</span>
            </div>
            <div className="text-2xl font-bold">{stats.messagesSent.toLocaleString()}</div>
          </div>
        </div>

        {/* Mesh Stats */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Radio className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Nodes in Mesh</span>
            </div>
            <Badge variant="outline">{stats.nodesInMesh}</Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Channel Utilization</span>
            </div>
            <Badge variant="outline" className={utilizationColor}>
              {stats.channelUtilization.toFixed(1)}%
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Air Utilization TX</span>
            </div>
            <Badge variant="outline" className={airUtilColor}>
              {stats.airUtilTx.toFixed(1)}%
            </Badge>
          </div>
        </div>

        {/* Uptime */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Monitoring Uptime</span>
            <span className="text-sm font-medium">{formatUptime(stats.uptimeSeconds)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}
