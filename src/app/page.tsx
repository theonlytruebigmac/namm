"use client";

import { useNodes } from "@/hooks/useNodes";
import { useChannelMessages } from "@/hooks/useMessages";
import { useChannels } from "@/hooks/useChannels";
import { useDashboardWidgets } from "@/hooks/useDashboardWidgets";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { NodeStatusList } from "@/components/dashboard/node-status-list";
import { LiveActivityFeed } from "@/components/dashboard/LiveActivityFeed";
import { MessageActivityTimeline } from "@/components/dashboard/ActivityTimeline";
import { DeviceStatsCard } from "@/components/dashboard/DeviceStatsCard";
import { NetworkHealthCard } from "@/components/dashboard/NetworkHealthCard";
import { AlertsSummaryCard } from "@/components/dashboard/AlertsSummaryCard";
import { QuickActionsCard } from "@/components/dashboard/QuickActionsCard";
import { WidgetCustomizer, CustomizeButton } from "@/components/dashboard/WidgetCustomizer";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimestamp, formatDistance } from "@/lib/utils";
import { useState } from "react";
import {
  Activity,
  Radio,
  MessageSquare,
  Battery,
  Users,
  TrendingUp,
  Signal,
  MapPin,
} from "lucide-react";

export default function Home() {
  const { data: nodes, isLoading: nodesLoading } = useNodes();
  const { data: channels, isLoading: channelsLoading } = useChannels();
  const { enabledWidgets, isWidgetEnabled } = useDashboardWidgets();
  const [customizerOpen, setCustomizerOpen] = useState(false);

  // Get messages from primary channel for activity feed
  const primaryChannel = channels?.[0];
  const { data: messages } = useChannelMessages(primaryChannel?.index || 0);

  // Calculate statistics
  const activeNodes = nodes?.filter(n => Date.now() - n.lastHeard < 3600000) || [];
  const avgBattery = nodes?.length
    ? nodes.reduce((acc, n) => acc + (n.batteryLevel || 0), 0) / nodes.length
    : 0;
  const routerNodes = nodes?.filter(n => n.role === "ROUTER" || n.role === "ROUTER_CLIENT") || [];
  const recentMessages = messages?.slice(-5).reverse() || [];

  if (nodesLoading || channelsLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Widget Customizer Panel */}
      <WidgetCustomizer
        open={customizerOpen}
        onOpenChange={setCustomizerOpen}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">
            Dashboard
          </h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            Monitor your Meshtastic mesh network in real-time
          </p>
        </div>
        <CustomizeButton onClick={() => setCustomizerOpen(true)} />
      </div>

      {/* Stats Grid */}
      {isWidgetEnabled("stats") && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Nodes"
            value={nodes?.length || 0}
            description={`${activeNodes.length} active in last hour`}
            icon={Radio}
            color="default"
          />

          <StatCard
            title="Messages"
            value={messages?.length || 0}
            description={`${channels?.length || 0} channels active`}
            icon={MessageSquare}
            color="green"
          />

          <StatCard
            title="Avg Battery"
            value={`${Math.round(avgBattery)}%`}
            description="Network power status"
            icon={Battery}
            color="blue"
          />

          <StatCard
            title="Routers"
            value={routerNodes.length}
            description="Mesh backbone nodes"
            icon={Signal}
            color="yellow"
          />
        </div>
      )}

      {/* Message Activity Timeline */}
      {isWidgetEnabled("stats") && messages && messages.length > 0 && (
        <MessageActivityTimeline
          messages={messages}
          title="Message Activity (Last 24h)"
        />
      )}

      {/* Main Content Grid */}
      {(isWidgetEnabled("recentMessages") || isWidgetEnabled("nodeStatus")) && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          {/* Recent Messages */}
          {isWidgetEnabled("recentMessages") && (
            <Card className={isWidgetEnabled("nodeStatus") ? "col-span-4" : "col-span-7"}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Recent Messages
                </CardTitle>
                <CardDescription>Latest activity from the mesh network</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentMessages.length === 0 ? (
                    <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
                      No recent messages
                    </div>
                  ) : (
                    recentMessages.map((message) => {
                      const sender = nodes?.find(n => n.id === message.fromNode);
                      return (
                        <div
                          key={message.id}
                          className="flex items-start gap-4 p-3 rounded-lg bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent))] transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-[hsl(var(--foreground))]">
                                {sender?.shortName || "Unknown"}
                              </span>
                              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                {formatTimestamp(message.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] truncate">
                              {message.text}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Nodes */}
          {isWidgetEnabled("nodeStatus") && (
            <Card className={isWidgetEnabled("recentMessages") ? "col-span-3" : "col-span-7"}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Active Nodes
                </CardTitle>
                <CardDescription>Online in the last hour</CardDescription>
              </CardHeader>
              <CardContent>
                <NodeStatusList nodes={activeNodes} maxNodes={8} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Device Stats, Live Activity, Network Health, and Alerts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isWidgetEnabled("deviceStats") && <DeviceStatsCard />}
        {isWidgetEnabled("activityFeed") && <LiveActivityFeed />}
        {isWidgetEnabled("networkHealth") && <NetworkHealthCard />}
        {isWidgetEnabled("alertsSummary") && <AlertsSummaryCard />}
      </div>

      {/* Quick Actions */}
      {isWidgetEnabled("quickActions") && (
        <QuickActionsCard />
      )}

      {/* Network Overview */}
      {isWidgetEnabled("networkOverview") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Network Overview
            </CardTitle>
            <CardDescription>All nodes in the mesh</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {nodes?.map((node) => {
                const isActive = Date.now() - node.lastHeard < 3600000;
                return (
                  <div
                    key={node.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent))] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          isActive ? "bg-[hsl(var(--green))]" : "bg-[hsl(var(--muted-foreground))] opacity-50"
                        }`}
                      />
                      <div>
                        <div className="font-mono font-semibold text-[hsl(var(--primary))]">
                          {node.shortName}
                        </div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">
                          {node.position?.latitude && node.position?.longitude
                            ? `${node.position.latitude.toFixed(4)}, ${node.position.longitude.toFixed(4)}`
                            : "No position"}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {formatTimestamp(node.lastHeard)}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
