"use client";

import { useAlertEvents } from "@/hooks/useAlerts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, AlertTriangle, AlertCircle, Info, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { AlertSeverity } from "@/lib/alerts";

const severityConfig: Record<AlertSeverity, { icon: typeof AlertCircle; color: string }> = {
  info: { icon: Info, color: "text-blue-500" },
  warning: { icon: AlertTriangle, color: "text-yellow-500" },
  critical: { icon: AlertCircle, color: "text-red-500" },
};

export function AlertsSummaryCard() {
  const { events, unacknowledgedCount, loading } = useAlertEvents();

  const recentAlerts = events
    .filter((e) => !e.acknowledged)
    .slice(-3)
    .reverse();

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-[hsl(var(--muted))] rounded w-3/4" />
            <div className="h-4 bg-[hsl(var(--muted))] rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {unacknowledgedCount > 0 ? (
              <Bell className="h-4 w-4 text-yellow-500" />
            ) : (
              <BellOff className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            )}
            Alerts
          </CardTitle>
          {unacknowledgedCount > 0 && (
            <Badge variant="destructive">{unacknowledgedCount}</Badge>
          )}
        </div>
        <CardDescription>
          {unacknowledgedCount > 0
            ? `${unacknowledgedCount} unacknowledged alert${unacknowledgedCount !== 1 ? "s" : ""}`
            : "No active alerts"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recentAlerts.length === 0 ? (
          <div className="text-center py-4 text-sm text-[hsl(var(--muted-foreground))]">
            <BellOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
            All clear! No alerts.
          </div>
        ) : (
          <div className="space-y-2">
            {recentAlerts.map((alert) => {
              const config = severityConfig[alert.severity];
              const Icon = config.icon;
              return (
                <div
                  key={alert.id}
                  className="flex items-start gap-2 p-2 rounded-lg bg-[hsl(var(--muted))]"
                >
                  <Icon className={`h-4 w-4 mt-0.5 ${config.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[hsl(var(--foreground))] truncate">
                      {alert.message}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Link href="/alerts">
          <Button variant="ghost" className="w-full mt-3" size="sm">
            View All Alerts
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
