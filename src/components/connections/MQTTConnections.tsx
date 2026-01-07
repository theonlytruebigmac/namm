"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useConnections,
  useMultiMQTT,
  useCreateMQTTConnection,
} from "@/hooks/useMultiConnection";
import type { MQTTConnectionConfig, ConnectionState } from "@/lib/connections/types";
import {
  Server,
  Plus,
  MoreHorizontal,
  Plug,
  PlugZap,
  Trash2,
  Pencil,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";

// ============================================================================
// Connection Status Badge
// ============================================================================

interface StatusBadgeProps {
  state?: ConnectionState;
}

function StatusBadge({ state }: StatusBadgeProps) {
  if (!state) {
    return <Badge variant="secondary">Unknown</Badge>;
  }

  switch (state.status) {
    case "connected":
      return (
        <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
          <Wifi className="h-3 w-3 mr-1" />
          Connected
        </Badge>
      );
    case "connecting":
      return (
        <Badge variant="secondary">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Connecting
        </Badge>
      );
    case "reconnecting":
      return (
        <Badge variant="secondary">
          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
          Reconnecting
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <WifiOff className="h-3 w-3 mr-1" />
          Disconnected
        </Badge>
      );
  }
}

// ============================================================================
// MQTT Connection Card
// ============================================================================

interface MQTTConnectionCardProps {
  config: MQTTConnectionConfig;
  state?: ConnectionState;
  onConnect: () => void;
  onDisconnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}

function MQTTConnectionCard({
  config,
  state,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  onToggle,
}: MQTTConnectionCardProps) {
  const isConnected = state?.status === "connected";
  const isConnecting = state?.status === "connecting" || state?.status === "reconnecting";

  return (
    <Card className={!config.enabled ? "opacity-60" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              {config.name}
            </CardTitle>
            <CardDescription className="text-xs font-mono truncate max-w-[200px]">
              {config.brokerUrl}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge state={state} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isConnected ? (
                  <DropdownMenuItem onClick={onDisconnect}>
                    <PlugZap className="h-4 w-4 mr-2" />
                    Disconnect
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={onConnect} disabled={!config.enabled}>
                    <Plug className="h-4 w-4 mr-2" />
                    Connect
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggle}>
                  {config.enabled ? (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      Disable
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Enable
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 text-xs">
          <div className="flex flex-wrap gap-1">
            <span className="text-muted-foreground">Topics:</span>{" "}
            {config.subscriptions.length === 0 ? (
              <span className="text-muted-foreground italic">None configured</span>
            ) : (
              config.subscriptions.filter(s => s.enabled).map((sub) => (
                <Badge key={sub.id} variant="secondary" className="font-mono text-xs">
                  {sub.topic}
                </Badge>
              ))
            )}
          </div>
          {state && state.status === "connected" && (
            <div className="flex gap-4">
              <div>
                <span className="text-muted-foreground">Messages:</span>{" "}
                <span className="font-medium">{state.messagesReceived}</span>
              </div>
            </div>
          )}
          {state?.error && (
            <div className="text-destructive">
              Error: {state.error}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Add MQTT Connection Dialog
// ============================================================================

interface AddMQTTConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editConfig?: MQTTConnectionConfig;
}

export function AddMQTTConnectionDialog({
  open,
  onOpenChange,
  editConfig,
}: AddMQTTConnectionDialogProps) {
  const { add, update } = useConnections();
  const createMQTT = useCreateMQTTConnection();

  // Parse existing broker URL into components
  const parseUrl = (url: string) => {
    const match = url.match(/^(mqtt|mqtts|ws|wss):\/\/([^:\/]+)(?::(\d+))?/);
    if (match) {
      return {
        protocol: match[1] as "mqtt" | "mqtts" | "ws" | "wss",
        host: match[2],
        port: match[3] || getDefaultPort(match[1] as "mqtt" | "mqtts" | "ws" | "wss"),
      };
    }
    return { protocol: "mqtt" as const, host: "", port: "1883" };
  };

  const getDefaultPort = (protocol: "mqtt" | "mqtts" | "ws" | "wss") => {
    switch (protocol) {
      case "mqtt": return "1883";
      case "mqtts": return "8883";
      case "ws": return "80";
      case "wss": return "443";
    }
  };

  const parsed = editConfig?.brokerUrl ? parseUrl(editConfig.brokerUrl) : { protocol: "mqtt" as const, host: "", port: "1883" };

  const [name, setName] = useState(editConfig?.name || "");
  const [protocol, setProtocol] = useState<"mqtt" | "mqtts" | "ws" | "wss">(parsed.protocol);
  const [host, setHost] = useState(parsed.host);
  const [port, setPort] = useState(parsed.port);
  const [username, setUsername] = useState(editConfig?.username || "");
  const [password, setPassword] = useState(editConfig?.password || "");
  const [autoConnect, setAutoConnect] = useState(editConfig?.autoConnect ?? true);
  const [subscriptions, setSubscriptions] = useState(editConfig?.subscriptions || []);
  const [newTopic, setNewTopic] = useState("");

  // Build broker URL from components
  const brokerUrl = host ? `${protocol}://${host}:${port}` : "";

  const addTopic = () => {
    if (!newTopic.trim()) return;
    const sub = {
      id: `sub_${Date.now()}`,
      topic: newTopic.trim(),
      enabled: true,
    };
    setSubscriptions([...subscriptions, sub]);
    setNewTopic("");
  };

  const removeTopic = (id: string) => {
    setSubscriptions(subscriptions.filter(s => s.id !== id));
  };

  const handleProtocolChange = (newProtocol: "mqtt" | "mqtts" | "ws" | "wss") => {
    setProtocol(newProtocol);
    // Update port to default for new protocol if it was the default for old protocol
    const oldDefault = getDefaultPort(protocol);
    if (port === oldDefault) {
      setPort(getDefaultPort(newProtocol));
    }
  };

  const handleSave = () => {
    if (!name || !host) return;

    if (editConfig) {
      update(editConfig.id, {
        name,
        brokerUrl,
        username: username || undefined,
        password: password || undefined,
        subscriptions,
        autoConnect,
        useTLS: protocol === "mqtts" || protocol === "wss",
      });
    } else {
      createMQTT(name, brokerUrl, {
        username: username || undefined,
        password: password || undefined,
        subscriptions,
        autoConnect,
        useTLS: protocol === "mqtts" || protocol === "wss",
      });
    }

    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setProtocol("mqtt");
    setHost("");
    setPort("1883");
    setUsername("");
    setPassword("");
    setSubscriptions([]);
    setNewTopic("");
    setAutoConnect(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {editConfig ? "Edit MQTT Connection" : "Add MQTT Connection"}
          </DialogTitle>
          <DialogDescription>
            Connect to an MQTT broker to receive Meshtastic mesh data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4 max-h-[60vh] overflow-y-auto overflow-x-hidden">
          <div className="space-y-2">
            <Label htmlFor="name">Connection Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Kentucky Mesh"
            />
          </div>

          <div className="space-y-2">
            <Label>Broker</Label>
            <div className="grid grid-cols-[auto_1fr_80px] gap-2">
              <Select value={protocol} onValueChange={(v) => handleProtocolChange(v as "mqtt" | "mqtts" | "ws" | "wss")}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mqtt">mqtt://</SelectItem>
                  <SelectItem value="mqtts">mqtts://</SelectItem>
                  <SelectItem value="ws">ws://</SelectItem>
                  <SelectItem value="wss">wss://</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="mqtt.meshtastic.org"
              />
              <Input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="1883"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Protocol, hostname, and port
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Topic Subscriptions</Label>
            <div className="flex gap-2">
              <Input
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder="e.g., msh/US/KY/#"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTopic())}
              />
              <Button type="button" variant="secondary" onClick={addTopic} disabled={!newTopic.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add full MQTT topics. Use # for wildcards (e.g., msh/US/# for all US traffic)
            </p>
            {subscriptions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {subscriptions.map((sub) => (
                  <Badge
                    key={sub.id}
                    variant="secondary"
                    className="font-mono text-xs flex items-center gap-1 pr-1"
                  >
                    {sub.topic}
                    <button
                      onClick={() => removeTopic(sub.id)}
                      className="ml-1 hover:bg-destructive/20 rounded p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="autoConnect">Auto-connect on startup</Label>
            <Switch
              id="autoConnect"
              checked={autoConnect}
              onCheckedChange={setAutoConnect}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name || !host}>
            {editConfig ? "Save Changes" : "Add Connection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MQTT Connections Manager
// ============================================================================

export function MQTTConnectionsManager() {
  const { mqttConnections, remove, toggle } = useConnections();
  const { connectionStates, connect, disconnect } = useMultiMQTT();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<MQTTConnectionConfig | undefined>();

  const handleEdit = (config: MQTTConnectionConfig) => {
    setEditConfig(config);
    setAddDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this connection?")) {
      disconnect(id);
      remove(id);
    }
  };

  const handleCloseDialog = (open: boolean) => {
    setAddDialogOpen(open);
    if (!open) {
      setEditConfig(undefined);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">MQTT Connections</h3>
        <p className="text-sm text-muted-foreground">
          Connect to multiple MQTT brokers to aggregate mesh data
        </p>
      </div>

      {mqttConnections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="font-medium mb-1">No MQTT Connections</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Add your first MQTT connection to start receiving mesh data
            </p>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Connection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {mqttConnections.map((config) => (
            <MQTTConnectionCard
              key={config.id}
              config={config}
              state={connectionStates.get(config.id)}
              onConnect={() => connect(config.id)}
              onDisconnect={() => disconnect(config.id)}
              onEdit={() => handleEdit(config)}
              onDelete={() => handleDelete(config.id)}
              onToggle={() => toggle(config.id)}
            />
          ))}
          <Card
            className="border-dashed cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setAddDialogOpen(true)}
          >
            <CardContent className="flex flex-col items-center justify-center py-8 text-center h-full">
              <Plus className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Add Connection</p>
            </CardContent>
          </Card>
        </div>
      )}

      <AddMQTTConnectionDialog
        open={addDialogOpen}
        onOpenChange={handleCloseDialog}
        editConfig={editConfig}
      />
    </div>
  );
}
