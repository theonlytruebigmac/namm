"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MQTTConnectionsManager,
  HTTPConnectionsManager,
  SerialConnectionsManager
} from "@/components/connections";
import { useConnections, useConnectionStats } from "@/hooks/useMultiConnection";
import {
  Server,
  Globe,
  Usb,
  Bluetooth,
  Activity,
  Wifi,
  WifiOff,
  Database,
} from "lucide-react";

export default function ConnectionsPage() {
  const { connections, mqttConnections, httpConnections, serialConnections, bleConnection } = useConnections();
  const stats = useConnectionStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Connections</h1>
        <p className="text-muted-foreground">
          Manage your MQTT brokers, HTTP endpoints, and serial devices
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Total Connections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connections.length}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeConnections} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              MQTT Brokers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mqttConnections.length}</div>
            <p className="text-xs text-muted-foreground">
              {mqttConnections.filter(c => c.enabled).length} enabled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Messages Received
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMessagesReceived}</div>
            <p className="text-xs text-muted-foreground">
              {(stats.totalBytesReceived / 1024).toFixed(1)} KB
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              {stats.activeConnections > 0 ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-muted-foreground" />
              )}
              Status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={stats.activeConnections > 0 ? "default" : "secondary"}>
              {stats.activeConnections > 0 ? "Connected" : "Offline"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Connection Managers */}
      <Tabs defaultValue="mqtt" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mqtt" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            MQTT
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {mqttConnections.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="http" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            HTTP
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {httpConnections.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="serial" className="flex items-center gap-2">
            <Usb className="h-4 w-4" />
            Serial
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {serialConnections.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="ble" className="flex items-center gap-2">
            <Bluetooth className="h-4 w-4" />
            BLE
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {bleConnection ? 1 : 0}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mqtt">
          <MQTTConnectionsManager />
        </TabsContent>

        <TabsContent value="http">
          <HTTPConnectionsManager />
        </TabsContent>

        <TabsContent value="serial">
          <SerialConnectionsManager />
        </TabsContent>

        <TabsContent value="ble">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bluetooth className="h-5 w-5" />
                Bluetooth Low Energy
              </CardTitle>
              <CardDescription>
                Connect to a Meshtastic device via Bluetooth
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bluetooth className="h-12 w-12 text-muted-foreground mb-4" />
                <h4 className="font-medium mb-1">BLE Connection</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Only one BLE connection is supported at a time.
                  {bleConnection && (
                    <span className="block mt-2">
                      Currently connected to: <strong>{bleConnection.name}</strong>
                    </span>
                  )}
                </p>
                <Badge variant="outline">Coming Soon</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <Server className="h-4 w-4 text-primary" />
                MQTT
              </div>
              <p className="text-sm text-muted-foreground">
                Connect to MQTT brokers to receive mesh data from multiple regions or servers.
                Best for aggregating data from distributed mesh networks.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <Globe className="h-4 w-4 text-blue-500" />
                HTTP
              </div>
              <p className="text-sm text-muted-foreground">
                Connect directly to a Meshtastic node's web interface.
                Useful for local network access to your nodes.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <Usb className="h-4 w-4 text-orange-500" />
                Serial
              </div>
              <p className="text-sm text-muted-foreground">
                Connect to Meshtastic devices via USB using the Web Serial API.
                Requires Chrome, Edge, or Opera.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <Bluetooth className="h-4 w-4 text-blue-400" />
                BLE
              </div>
              <p className="text-sm text-muted-foreground">
                Connect to a nearby Meshtastic device via Bluetooth.
                Only one BLE connection is supported.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
