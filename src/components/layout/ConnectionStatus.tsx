"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDeviceConnection } from "@/hooks/useDeviceConnection";
import { useDeviceStats } from "@/hooks/useDeviceStats";
import { useMQTTConnectionStatus } from "@/hooks/useMQTT";
import { useSettings } from "@/hooks/useSettings";
import {
  Wifi,
  WifiOff,
  Radio,
  Usb,
  Server,
  Activity,
  Clock,
  Zap,
  RefreshCw,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

type ConnectionType = "mqtt" | "serial" | "http" | "ble";

interface ConnectionInfo {
  type: ConnectionType;
  connected: boolean;
  label: string;
  icon: React.ElementType;
  details?: string;
  latency?: number;
}

export function ConnectionStatusBadge() {
  const { data: deviceInfo } = useDeviceConnection();
  const { isConnected: mqttConnected } = useMQTTConnectionStatus();

  const useRealAPI = process.env.NEXT_PUBLIC_USE_REAL_API === "true";
  const isConnected = useRealAPI ? (deviceInfo?.connected || mqttConnected) : true;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted hover:bg-accent transition-colors">
          <div
            className={`h-2 w-2 rounded-full ${
              isConnected
                ? "bg-[hsl(var(--green))] animate-pulse"
                : "bg-[hsl(var(--red))]"
            }`}
          />
          <span className="text-sm">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Connection Status
          </DialogTitle>
          <DialogDescription>
            Current network and device connection details
          </DialogDescription>
        </DialogHeader>
        <ConnectionStatusDetails />
      </DialogContent>
    </Dialog>
  );
}

function ConnectionStatusDetails() {
  const settings = useSettings();
  const { data: deviceInfo } = useDeviceConnection();
  const { data: deviceStats } = useDeviceStats();
  const { isConnected: mqttConnected, error: mqttError } = useMQTTConnectionStatus();

  const connections: ConnectionInfo[] = [
    {
      type: "mqtt",
      connected: mqttConnected,
      label: "MQTT Broker",
      icon: Server,
      details: settings.mqttBroker || "Not configured",
    },
    {
      type: "http",
      connected: deviceInfo?.connected || false,
      label: "HTTP API",
      icon: Wifi,
      details: settings.apiEndpoint || "localhost",
    },
    {
      type: "serial",
      connected: false, // Would need useWebSerial hook
      label: "USB Serial",
      icon: Usb,
      details: "Not connected",
    },
  ];

  const activeConnection = connections.find((c) => c.connected);

  return (
    <div className="space-y-4 py-4">
      {/* Overall Status */}
      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-3">
          {activeConnection ? (
            <CheckCircle className="h-8 w-8 text-[hsl(var(--green))]" />
          ) : (
            <XCircle className="h-8 w-8 text-[hsl(var(--red))]" />
          )}
          <div>
            <h3 className="font-semibold">
              {activeConnection ? "Connected" : "Disconnected"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {activeConnection
                ? `via ${activeConnection.label}`
                : "No active connections"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4 mr-1" />
            Settings
          </Link>
        </Button>
      </div>

      {/* Connection Types */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Connections</h4>
        {connections.map((conn) => {
          const Icon = conn.icon;
          return (
            <div
              key={conn.type}
              className={`flex items-center justify-between p-3 rounded-lg ${
                conn.connected ? "bg-[hsl(var(--green))]/10" : "bg-muted"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${conn.connected ? "text-[hsl(var(--green))]" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium">{conn.label}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {conn.details}
                  </p>
                </div>
              </div>
              <Badge variant={conn.connected ? "default" : "secondary"}>
                {conn.connected ? "Active" : "Inactive"}
              </Badge>
            </div>
          );
        })}
      </div>

      {/* Device Stats */}
      {deviceStats && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Device Stats</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Messages Sent</p>
              <p className="text-lg font-bold">{deviceStats.messagesSent || 0}</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Uptime</p>
              <p className="text-lg font-bold">
                {deviceStats.uptimeSeconds ? formatUptime(deviceStats.uptimeSeconds) : "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button variant="outline" className="flex-1" asChild>
          <Link href="/mqtt">
            <Zap className="h-4 w-4 mr-2" />
            MQTT Console
          </Link>
        </Button>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/**
 * Compact connection indicator for use in headers/navbars
 */
export function ConnectionIndicator() {
  const { data: deviceInfo } = useDeviceConnection();
  const { isConnected: mqttConnected } = useMQTTConnectionStatus();

  const useRealAPI = process.env.NEXT_PUBLIC_USE_REAL_API === "true";
  const isConnected = useRealAPI ? (deviceInfo?.connected || mqttConnected) : true;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-2 w-2 rounded-full ${
          isConnected
            ? "bg-[hsl(var(--green))] animate-pulse"
            : "bg-[hsl(var(--red))]"
        }`}
      />
      <span className="text-xs text-muted-foreground">
        {isConnected ? "Connected" : "Offline"}
      </span>
    </div>
  );
}
