"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Node } from "@/types";
import { Activity, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface NetworkHealthProps {
  nodes: Node[];
}

export function NetworkHealth({ nodes }: NetworkHealthProps) {
  const activeNodes = nodes.filter(n => Date.now() - n.lastHeard < 3600000);
  const lowBatteryNodes = nodes.filter(n => (n.batteryLevel || 100) < 20);
  const weakSignalNodes = nodes.filter(n => (n.snr || 0) < -5);

  const healthScore = Math.round(
    ((activeNodes.length / nodes.length) * 50) +
    ((nodes.length - lowBatteryNodes.length) / nodes.length * 30) +
    ((nodes.length - weakSignalNodes.length) / nodes.length * 20)
  );

  const getHealthStatus = (score: number) => {
    if (score >= 80) return { label: "Excellent", color: "success", icon: CheckCircle };
    if (score >= 60) return { label: "Good", color: "default", icon: Activity };
    if (score >= 40) return { label: "Fair", color: "secondary", icon: AlertTriangle };
    return { label: "Poor", color: "destructive", icon: XCircle };
  };

  const status = getHealthStatus(healthScore);
  const StatusIcon = status.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Network Health
          </span>
          <Badge variant={status.color as any}>
            {status.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[hsl(var(--muted-foreground))]">Overall Score</span>
            <span className="font-bold text-lg">{healthScore}%</span>
          </div>
          <div className="h-3 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                healthScore >= 80
                  ? "bg-[hsl(var(--green))]"
                  : healthScore >= 60
                  ? "bg-[hsl(var(--blue))]"
                  : healthScore >= 40
                  ? "bg-[hsl(var(--yellow))]"
                  : "bg-[hsl(var(--red))]"
              }`}
              style={{ width: `${healthScore}%` }}
            />
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-3 pt-3 border-t border-[hsl(var(--border))]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[hsl(var(--green))]" />
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Active Nodes</span>
            </div>
            <span className="font-semibold">{activeNodes.length} / {nodes.length}</span>
          </div>

          {lowBatteryNodes.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[hsl(var(--red))]" />
                <span className="text-sm text-[hsl(var(--muted-foreground))]">Low Battery</span>
              </div>
              <span className="font-semibold text-[hsl(var(--red))]">{lowBatteryNodes.length}</span>
            </div>
          )}

          {weakSignalNodes.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[hsl(var(--yellow))]" />
                <span className="text-sm text-[hsl(var(--muted-foreground))]">Weak Signal</span>
              </div>
              <span className="font-semibold text-[hsl(var(--yellow))]">{weakSignalNodes.length}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
