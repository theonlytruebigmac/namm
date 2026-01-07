"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTimestamp } from "@/lib/utils";
import { useAlertThresholds, useAlertEvents } from "@/hooks/useAlerts";
import type { AlertSeverity, AlertType } from "@/lib/alerts";
import {
  Bell,
  BellOff,
  AlertTriangle,
  AlertCircle,
  Info,
  Battery,
  Signal,
  WifiOff,
  Route,
  MessageSquare,
  Check,
  CheckCheck,
  Trash2,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Icon and color mappings
const severityConfig: Record<AlertSeverity, { icon: typeof AlertCircle; color: string; bg: string }> = {
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10" },
  warning: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  critical: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
};

const typeIcons: Record<AlertType, typeof Battery> = {
  battery_low: Battery,
  battery_critical: Battery,
  signal_weak: Signal,
  node_offline: WifiOff,
  hops_exceeded: Route,
  message_rate_high: MessageSquare,
  custom: Bell,
};

function formatCooldown(ms: number): string {
  const minutes = ms / 60000;
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours}h`;
  return `${hours / 24}d`;
}

export default function AlertsPage() {
  const { thresholds, loading: thresholdsLoading, update, toggleEnabled, reset } = useAlertThresholds();
  const { events, unacknowledgedCount, loading: eventsLoading, acknowledge, acknowledgeAll, clearAll } = useAlertEvents();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (thresholdsLoading || eventsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const unacknowledgedEvents = events.filter((e) => !e.acknowledged);
  const acknowledgedEvents = events.filter((e) => e.acknowledged);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">
            Alerts
          </h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            Configure threshold-based alerts and view alert history
          </p>
        </div>
        {unacknowledgedCount > 0 && (
          <Badge variant="destructive" className="text-lg px-3 py-1">
            {unacknowledgedCount} new
          </Badge>
        )}
      </div>

      {/* Active Alerts */}
      {unacknowledgedEvents.length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-yellow-500" />
                Active Alerts
              </CardTitle>
              <Button variant="outline" size="sm" onClick={acknowledgeAll}>
                <CheckCheck className="h-4 w-4 mr-2" />
                Acknowledge All
              </Button>
            </div>
            <CardDescription>
              {unacknowledgedEvents.length} unacknowledged alert{unacknowledgedEvents.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unacknowledgedEvents.map((event) => {
                const config = severityConfig[event.severity];
                const Icon = config.icon;
                return (
                  <div
                    key={event.id}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg",
                      config.bg
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <Icon className={cn("h-6 w-6", config.color)} />
                      <div>
                        <div className="font-medium text-[hsl(var(--foreground))]">
                          {event.message}
                        </div>
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">
                          {event.thresholdName} • {formatTimestamp(event.timestamp)}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => acknowledge(event.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Threshold Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Alert Thresholds
            </CardTitle>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Defaults
            </Button>
          </div>
          <CardDescription>
            Configure when alerts are triggered
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {thresholds.map((threshold) => {
              const TypeIcon = typeIcons[threshold.type];
              const config = severityConfig[threshold.severity];

              return (
                <div
                  key={threshold.id}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border",
                    threshold.enabled
                      ? "border-[hsl(var(--border))] bg-[hsl(var(--card))]"
                      : "border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))] opacity-60"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2 rounded-lg", config.bg)}>
                      <TypeIcon className={cn("h-5 w-5", config.color)} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[hsl(var(--foreground))]">
                          {threshold.name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {threshold.severity}
                        </Badge>
                        {threshold.triggerCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {threshold.triggerCount}x triggered
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-[hsl(var(--muted-foreground))]">
                        {threshold.description}
                      </div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                        Threshold: {threshold.threshold}
                        {threshold.type === "signal_weak" && " dBm"}
                        {threshold.type === "node_offline" && ` (${formatCooldown(threshold.threshold)})`}
                        {(threshold.type === "battery_low" || threshold.type === "battery_critical") && "%"}
                        {threshold.type === "message_rate_high" && " msg/min"}
                        {" "}• Cooldown: {formatCooldown(threshold.cooldownMs)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Dialog open={editingId === threshold.id} onOpenChange={(open: boolean) => setEditingId(open ? threshold.id : null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Threshold: {threshold.name}</DialogTitle>
                          <DialogDescription>
                            Adjust the threshold value and cooldown period
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="threshold">Threshold Value</Label>
                            <Input
                              id="threshold"
                              type="number"
                              defaultValue={threshold.threshold}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                if (!isNaN(value)) {
                                  update(threshold.id, { threshold: value });
                                }
                              }}
                            />
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                              {threshold.type === "battery_low" && "Battery percentage (0-100)"}
                              {threshold.type === "battery_critical" && "Battery percentage (0-100)"}
                              {threshold.type === "signal_weak" && "RSSI in dBm (e.g., -120)"}
                              {threshold.type === "node_offline" && "Time in milliseconds (e.g., 3600000 = 1 hour)"}
                              {threshold.type === "hops_exceeded" && "Maximum hop count"}
                              {threshold.type === "message_rate_high" && "Messages per minute"}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cooldown">Cooldown (minutes)</Label>
                            <Input
                              id="cooldown"
                              type="number"
                              defaultValue={threshold.cooldownMs / 60000}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                if (!isNaN(value) && value > 0) {
                                  update(threshold.id, { cooldownMs: value * 60000 });
                                }
                              }}
                            />
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                              Minimum time between alert triggers
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Severity</Label>
                            <div className="flex gap-2">
                              {(["info", "warning", "critical"] as const).map((sev) => (
                                <Button
                                  key={sev}
                                  variant={threshold.severity === sev ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => update(threshold.id, { severity: sev })}
                                >
                                  {sev}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Switch
                      checked={threshold.enabled}
                      onCheckedChange={() => toggleEnabled(threshold.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Alert History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BellOff className="h-5 w-5" />
              Alert History
            </CardTitle>
            {events.length > 0 && (
              <Button variant="destructive" size="sm" onClick={clearAll}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            )}
          </div>
          <CardDescription>
            {acknowledgedEvents.length} past alert{acknowledgedEvents.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {acknowledgedEvents.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No alert history"
              description="Past alerts will appear here after being acknowledged."
            />
          ) : (
            <div className="space-y-2">
              {acknowledgedEvents.slice().reverse().map((event) => {
                const config = severityConfig[event.severity];
                const Icon = config.icon;
                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-[hsl(var(--muted))] opacity-70"
                  >
                    <Icon className={cn("h-4 w-4", config.color)} />
                    <div className="flex-1">
                      <div className="text-sm text-[hsl(var(--foreground))]">
                        {event.message}
                      </div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        {formatTimestamp(event.timestamp)}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      <Check className="h-3 w-3 mr-1" />
                      Acknowledged
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
