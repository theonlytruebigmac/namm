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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useConnections,
  useCreateSerialConnection,
} from "@/hooks/useMultiConnection";
import { useWebSerial } from "@/hooks/useWebSerial";
import type { SerialConnectionConfig } from "@/lib/connections/types";
import {
  Usb,
  Plus,
  MoreHorizontal,
  Plug,
  PlugZap,
  Trash2,
  Pencil,
  Check,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";

// ============================================================================
// Serial Connection Card
// ============================================================================

interface SerialConnectionCardProps {
  config: SerialConnectionConfig;
  onConnect: () => void;
  onDisconnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  isConnected?: boolean;
  isConnecting?: boolean;
}

function SerialConnectionCard({
  config,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  onToggle,
  isConnected = false,
  isConnecting = false,
}: SerialConnectionCardProps) {
  return (
    <Card className={!config.enabled ? "opacity-60" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Usb className="h-4 w-4 text-orange-500" />
              {config.name}
            </CardTitle>
            <CardDescription className="text-xs">
              {config.portName || "Click Connect to select port"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : isConnecting ? "outline" : "secondary"}>
              {isConnecting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Connecting...
                </>
              ) : isConnected ? (
                <>
                  <Plug className="h-3 w-3 mr-1" />
                  Connected
                </>
              ) : (
                <>
                  <PlugZap className="h-3 w-3 mr-1" />
                  Disconnected
                </>
              )}
            </Badge>
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
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Baud Rate:</span>{" "}
            <span className="font-medium">{config.baudRate}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Auto-connect:</span>{" "}
            <span className="font-medium">{config.autoConnect ? "Yes" : "No"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Add Serial Connection Dialog
// ============================================================================

interface AddSerialConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editConfig?: SerialConnectionConfig;
}

export function AddSerialConnectionDialog({
  open,
  onOpenChange,
  editConfig,
}: AddSerialConnectionDialogProps) {
  const { update } = useConnections();
  const createSerial = useCreateSerialConnection();

  const [name, setName] = useState(editConfig?.name || "");
  const [baudRate, setBaudRate] = useState(editConfig?.baudRate?.toString() || "115200");
  const [autoConnect, setAutoConnect] = useState(editConfig?.autoConnect ?? false);

  const handleSave = () => {
    if (!name) return;

    if (editConfig) {
      update(editConfig.id, {
        name,
        baudRate: parseInt(baudRate) || 115200,
        autoConnect,
      });
    } else {
      createSerial(name, {
        baudRate: parseInt(baudRate) || 115200,
        autoConnect,
      });
    }

    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setBaudRate("115200");
    setAutoConnect(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editConfig ? "Edit Serial Connection" : "Add Serial Connection"}
          </DialogTitle>
          <DialogDescription>
            Connect to a Meshtastic device via USB Serial
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Connection Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Meshtastic Device"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="baudRate">Baud Rate</Label>
            <Input
              id="baudRate"
              type="number"
              value={baudRate}
              onChange={(e) => setBaudRate(e.target.value)}
              placeholder="115200"
            />
            <p className="text-xs text-muted-foreground">
              Default is 115200 for Meshtastic devices
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-connect on startup</Label>
              <p className="text-xs text-muted-foreground">
                Automatically connect when the app starts
              </p>
            </div>
            <Switch
              checked={autoConnect}
              onCheckedChange={setAutoConnect}
            />
          </div>

          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Web Serial API Required</p>
                <p>
                  Serial connections require a browser with Web Serial API support
                  (Chrome, Edge, Opera). The port will be selected when you connect.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name}>
            {editConfig ? "Save Changes" : "Add Connection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Serial Connections Manager
// ============================================================================

export function SerialConnectionsManager() {
  const { serialConnections, remove, toggle } = useConnections();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<SerialConnectionConfig | undefined>();
  const [connectError, setConnectError] = useState<string | null>(null);

  // Use the Web Serial hook
  const {
    isSupported,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    error: serialError,
  } = useWebSerial();

  const handleEdit = (config: SerialConnectionConfig) => {
    setEditConfig(config);
    setAddDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this connection?")) {
      remove(id);
    }
  };

  const handleConnect = async (config: SerialConnectionConfig) => {
    setConnectError(null);
    try {
      const success = await connect();
      if (!success) {
        // User cancelled the port selection
        setConnectError("Port selection cancelled");
      }
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Failed to connect");
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (err) {
      console.error("Disconnect error:", err);
    }
  };

  const handleCloseDialog = (open: boolean) => {
    setAddDialogOpen(open);
    if (!open) {
      setEditConfig(undefined);
    }
  };

  if (!isSupported) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Serial Connections</h3>
            <p className="text-sm text-muted-foreground">
              Connect to Meshtastic devices via USB
            </p>
          </div>
        </div>

        <Card className="border-dashed border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h4 className="font-medium mb-1">Web Serial Not Available</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Web Serial API requires a secure context (HTTPS or localhost).
            </p>
            <p className="text-xs text-muted-foreground">
              If accessing via network IP, try using <code className="bg-muted px-1 rounded">localhost:3002</code> instead,
              or enable HTTPS for this server.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Serial Connections</h3>
        <p className="text-sm text-muted-foreground">
          Connect to Meshtastic devices via USB
        </p>
      </div>

      {serialConnections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Usb className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="font-medium mb-1">No Serial Connections</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Add a serial connection to connect to a Meshtastic device via USB
            </p>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Connection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {serialConnections.map((config) => (
            <SerialConnectionCard
              key={config.id}
              config={config}
              onConnect={() => handleConnect(config)}
              onDisconnect={handleDisconnect}
              onEdit={() => handleEdit(config)}
              onDelete={() => handleDelete(config.id)}
              onToggle={() => toggle(config.id)}
              isConnected={isConnected}
              isConnecting={isConnecting}
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

      <AddSerialConnectionDialog
        open={addDialogOpen}
        onOpenChange={handleCloseDialog}
        editConfig={editConfig}
      />
    </div>
  );
}
