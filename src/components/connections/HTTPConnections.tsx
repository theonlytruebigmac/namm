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
  useCreateHTTPConnection,
} from "@/hooks/useMultiConnection";
import type { HTTPConnectionConfig } from "@/lib/connections/types";
import {
  Globe,
  Plus,
  MoreHorizontal,
  Plug,
  PlugZap,
  Trash2,
  Pencil,
  Check,
  X,
  Wifi,
  WifiOff,
} from "lucide-react";

// ============================================================================
// HTTP Connection Card
// ============================================================================

interface HTTPConnectionCardProps {
  config: HTTPConnectionConfig;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}

function HTTPConnectionCard({
  config,
  onEdit,
  onDelete,
  onToggle,
}: HTTPConnectionCardProps) {
  return (
    <Card className={!config.enabled ? "opacity-60" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              {config.name}
            </CardTitle>
            <CardDescription className="text-xs font-mono truncate max-w-[200px]">
              {config.baseUrl}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={config.enabled ? "default" : "secondary"}>
              {config.enabled ? (
                <>
                  <Wifi className="h-3 w-3 mr-1" />
                  Enabled
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 mr-1" />
                  Disabled
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
            <span className="text-muted-foreground">Auto-connect:</span>{" "}
            <span className="font-medium">{config.autoConnect ? "Yes" : "No"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Polling:</span>{" "}
            <span className="font-medium">
              {config.pollingInterval ? `${config.pollingInterval}ms` : "Disabled"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Add HTTP Connection Dialog
// ============================================================================

interface AddHTTPConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editConfig?: HTTPConnectionConfig;
}

export function AddHTTPConnectionDialog({
  open,
  onOpenChange,
  editConfig,
}: AddHTTPConnectionDialogProps) {
  const { add, update } = useConnections();
  const createHTTP = useCreateHTTPConnection();

  const [name, setName] = useState(editConfig?.name || "");
  const [baseUrl, setBaseUrl] = useState(editConfig?.baseUrl || "");
  const [apiKey, setApiKey] = useState(editConfig?.apiKey || "");
  const [pollingInterval, setPollingInterval] = useState(
    editConfig?.pollingInterval?.toString() || "0"
  );
  const [autoConnect, setAutoConnect] = useState(editConfig?.autoConnect ?? true);

  const handleSave = () => {
    if (!name || !baseUrl) return;

    if (editConfig) {
      update(editConfig.id, {
        name,
        baseUrl,
        apiKey: apiKey || undefined,
        pollingInterval: parseInt(pollingInterval) || 0,
        autoConnect,
      });
    } else {
      createHTTP(name, baseUrl, {
        apiKey: apiKey || undefined,
        pollingInterval: parseInt(pollingInterval) || 0,
        autoConnect,
      });
    }

    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setBaseUrl("");
    setApiKey("");
    setPollingInterval("0");
    setAutoConnect(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editConfig ? "Edit HTTP Connection" : "Add HTTP Connection"}
          </DialogTitle>
          <DialogDescription>
            Connect to a Meshtastic HTTP API endpoint
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Connection Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Local Node"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input
              id="baseUrl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://192.168.1.100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key (optional)</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Optional API key"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="polling">Polling Interval (ms)</Label>
            <Input
              id="polling"
              type="number"
              value={pollingInterval}
              onChange={(e) => setPollingInterval(e.target.value)}
              placeholder="0 = disabled"
            />
            <p className="text-xs text-muted-foreground">
              Set to 0 to disable polling, or specify interval in milliseconds
            </p>
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
          <Button onClick={handleSave} disabled={!name || !baseUrl}>
            {editConfig ? "Save Changes" : "Add Connection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// HTTP Connections Manager
// ============================================================================

export function HTTPConnectionsManager() {
  const { httpConnections, remove, toggle } = useConnections();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<HTTPConnectionConfig | undefined>();

  const handleEdit = (config: HTTPConnectionConfig) => {
    setEditConfig(config);
    setAddDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this connection?")) {
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
        <h3 className="text-lg font-semibold">HTTP Connections</h3>
        <p className="text-sm text-muted-foreground">
          Connect to Meshtastic nodes via HTTP API
        </p>
      </div>

      {httpConnections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Globe className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="font-medium mb-1">No HTTP Connections</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Add an HTTP connection to connect to a Meshtastic node's web API
            </p>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Connection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {httpConnections.map((config) => (
            <HTTPConnectionCard
              key={config.id}
              config={config}
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

      <AddHTTPConnectionDialog
        open={addDialogOpen}
        onOpenChange={handleCloseDialog}
        editConfig={editConfig}
      />
    </div>
  );
}
