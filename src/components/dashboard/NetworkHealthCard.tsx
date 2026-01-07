"use client";

import { useNodes } from "@/hooks/useNodes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface HealthMetric {
  label: string;
  value: number;
  max: number;
  status: "good" | "warning" | "critical";
}

export function NetworkHealthCard() {
  const { data: nodes } = useNodes();

  // Calculate health metrics
  const totalNodes = nodes?.length || 0;
  const activeNodes = nodes?.filter((n) => Date.now() - n.lastHeard < 3600000).length || 0;
  const batteryOk = nodes?.filter((n) => (n.batteryLevel || 100) > 20).length || 0;
  const routerNodes = nodes?.filter((n) => n.role === "ROUTER" || n.role === "ROUTER_CLIENT").length || 0;

  const activePercent = totalNodes > 0 ? (activeNodes / totalNodes) * 100 : 0;
  const batteryPercent = totalNodes > 0 ? (batteryOk / totalNodes) * 100 : 0;
  const routerPercent = totalNodes > 0 ? (routerNodes / totalNodes) * 100 : 0;

  const metrics: HealthMetric[] = [
    {
      label: "Node Availability",
      value: activePercent,
      max: 100,
      status: activePercent > 70 ? "good" : activePercent > 40 ? "warning" : "critical",
    },
    {
      label: "Battery Health",
      value: batteryPercent,
      max: 100,
      status: batteryPercent > 80 ? "good" : batteryPercent > 50 ? "warning" : "critical",
    },
    {
      label: "Router Coverage",
      value: routerPercent,
      max: 100,
      status: routerPercent > 20 ? "good" : routerPercent > 10 ? "warning" : "critical",
    },
  ];

  const overallStatus = metrics.every((m) => m.status === "good")
    ? "good"
    : metrics.some((m) => m.status === "critical")
    ? "critical"
    : "warning";

  const StatusIcon = overallStatus === "good" ? CheckCircle : overallStatus === "warning" ? AlertTriangle : XCircle;
  const statusColor =
    overallStatus === "good"
      ? "text-[hsl(var(--green))]"
      : overallStatus === "warning"
      ? "text-yellow-500"
      : "text-destructive";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Network Health
          </CardTitle>
          <div className="flex items-center gap-1">
            <StatusIcon className={`h-5 w-5 ${statusColor}`} />
            <Badge
              variant={overallStatus === "good" ? "default" : overallStatus === "warning" ? "secondary" : "destructive"}
            >
              {overallStatus === "good" ? "Healthy" : overallStatus === "warning" ? "Warning" : "Critical"}
            </Badge>
          </div>
        </div>
        <CardDescription>Overall mesh network status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[hsl(var(--muted-foreground))]">{metric.label}</span>
              <span className="font-medium">{Math.round(metric.value)}%</span>
            </div>
            <Progress
              value={metric.value}
              className={`h-2 ${
                metric.status === "good"
                  ? "[&>div]:bg-[hsl(var(--green))]"
                  : metric.status === "warning"
                  ? "[&>div]:bg-yellow-500"
                  : "[&>div]:bg-destructive"
              }`}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
