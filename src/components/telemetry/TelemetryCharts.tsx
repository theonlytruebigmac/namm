"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Node } from "@/types";

interface TelemetryChartsProps {
  nodes: Node[];
}

export function TelemetryCharts({ nodes }: TelemetryChartsProps) {
  // Generate mock historical data (in real app, would come from API)
  const batteryData = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const hour = i;
      const avgBattery = nodes.reduce((acc, n) => acc + (n.batteryLevel || 0), 0) / (nodes.length || 1);
      return {
        hour: `${hour}:00`,
        battery: Math.max(0, avgBattery - Math.random() * 5),
      };
    });
  }, [nodes]);

  const signalData = useMemo(() => {
    return nodes
      .filter(n => n.snr !== undefined || n.rssi !== undefined)
      .slice(0, 10)
      .map(n => ({
        name: n.shortName || n.id,
        snr: n.snr || 0,
        rssi: Math.abs(n.rssi || 0),
      }));
  }, [nodes]);

  const channelData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const hour = i * 2;
      return {
        hour: `${hour}:00`,
        utilization: Math.random() * 100,
        airtime: Math.random() * 80,
      };
    });
  }, []);

  const nodeStatusData = useMemo(() => {
    const online = nodes.filter(n => Date.now() - n.lastHeard < 3600000).length;
    const offline = nodes.length - online;
    return [
      { name: "Online", value: online, fill: "#22c55e" },
      { name: "Offline", value: offline, fill: "#6b7280" },
    ];
  }, [nodes]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Battery Level Over Time */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Battery Levels (24h)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={batteryData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="hour"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
            />
            <Area
              type="monotone"
              dataKey="battery"
              stroke="#22c55e"
              fill="#22c55e"
              fillOpacity={0.2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Signal Quality by Node */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Signal Quality (SNR & RSSI)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={signalData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
            />
            <Legend />
            <Bar dataKey="snr" fill="#3b82f6" name="SNR (dB)" />
            <Bar dataKey="rssi" fill="#a855f7" name="RSSI (dBm)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Channel Utilization */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Channel Utilization (24h)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={channelData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="hour"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="utilization"
              stroke="#f59e0b"
              strokeWidth={2}
              name="Utilization %"
            />
            <Line
              type="monotone"
              dataKey="airtime"
              stroke="#10b981"
              strokeWidth={2}
              name="Airtime %"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Node Status Distribution */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Node Status Distribution</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={nodeStatusData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
            />
            <Bar dataKey="value" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
