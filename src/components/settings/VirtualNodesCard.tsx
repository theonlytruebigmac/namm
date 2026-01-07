"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Radio,
  MapPin,
  Battery,
  Wifi,
  Package,
} from "lucide-react";
import { useVirtualNodes } from "@/hooks/useVirtualNodes";
import { type VirtualNode } from "@/lib/virtual-nodes";

export function VirtualNodesCard() {
  const {
    nodes,
    enabled,
    loading,
    toggle,
    add,
    update,
    remove,
    loadPreset,
    clear,
  } = useVirtualNodes();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<VirtualNode | null>(null);

  // New node form
  const [newShortName, setNewShortName] = useState("");
  const [newLongName, setNewLongName] = useState("");
  const [newRole, setNewRole] = useState<VirtualNode["role"]>("CLIENT");
  const [newLat, setNewLat] = useState("");
  const [newLng, setNewLng] = useState("");
  const [newMovement, setNewMovement] = useState<VirtualNode["movementPattern"]>("static");

  // Edit form
  const [editShortName, setEditShortName] = useState("");
  const [editLongName, setEditLongName] = useState("");
  const [editRole, setEditRole] = useState<VirtualNode["role"]>("CLIENT");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");

  const resetCreateForm = () => {
    setNewShortName("");
    setNewLongName("");
    setNewRole("CLIENT");
    setNewLat("");
    setNewLng("");
    setNewMovement("static");
  };

  const handleCreateNode = () => {
    add({
      shortName: newShortName || undefined,
      longName: newLongName || undefined,
      role: newRole,
      position:
        newLat && newLng
          ? { latitude: parseFloat(newLat), longitude: parseFloat(newLng) }
          : undefined,
      movementPattern: newMovement,
    });
    resetCreateForm();
    setCreateDialogOpen(false);
  };

  const openEditDialog = (node: VirtualNode) => {
    setEditingNode(node);
    setEditShortName(node.shortName);
    setEditLongName(node.longName);
    setEditRole(node.role);
    setEditLat(node.position?.latitude?.toString() || "");
    setEditLng(node.position?.longitude?.toString() || "");
  };

  const handleEditNode = () => {
    if (!editingNode) return;
    update(editingNode.id, {
      shortName: editShortName,
      longName: editLongName,
      role: editRole,
      position:
        editLat && editLng
          ? { latitude: parseFloat(editLat), longitude: parseFloat(editLng) }
          : undefined,
    });
    setEditingNode(null);
  };

  const handleLoadPreset = (preset: "small" | "medium" | "large" | "stress") => {
    loadPreset(preset);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Virtual Nodes
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Virtual Nodes
          </CardTitle>
          <CardDescription>
            Create simulated nodes for testing and demonstration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Enable Virtual Nodes</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))]">
                Virtual nodes will appear in the node list and on the map
              </div>
            </div>
            <Switch checked={enabled} onCheckedChange={toggle} />
          </div>

          {/* Preset Networks */}
          <div className="space-y-3">
            <Label>Load Preset Network</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLoadPreset("small")}
              >
                <Package className="h-4 w-4 mr-1" />
                Small (5)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLoadPreset("medium")}
              >
                <Package className="h-4 w-4 mr-1" />
                Medium (15)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLoadPreset("large")}
              >
                <Package className="h-4 w-4 mr-1" />
                Large (30)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLoadPreset("stress")}
              >
                <Package className="h-4 w-4 mr-1" />
                Stress (100)
              </Button>
            </div>
          </div>

          {/* Node List */}
          {nodes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Virtual Nodes ({nodes.length})</Label>
                <div className="flex gap-2">
                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Virtual Node</DialogTitle>
                        <DialogDescription>
                          Add a new simulated node to the network
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Short Name</Label>
                            <Input
                              value={newShortName}
                              onChange={(e) => setNewShortName(e.target.value.toUpperCase().slice(0, 4))}
                              placeholder="AUTO"
                              maxLength={4}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Role</Label>
                            <Select value={newRole} onValueChange={(v) => setNewRole(v as VirtualNode["role"])}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="CLIENT">Client</SelectItem>
                                <SelectItem value="ROUTER">Router</SelectItem>
                                <SelectItem value="ROUTER_CLIENT">Router+Client</SelectItem>
                                <SelectItem value="REPEATER">Repeater</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Long Name</Label>
                          <Input
                            value={newLongName}
                            onChange={(e) => setNewLongName(e.target.value)}
                            placeholder="Virtual Node Name"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Latitude</Label>
                            <Input
                              type="number"
                              step="any"
                              value={newLat}
                              onChange={(e) => setNewLat(e.target.value)}
                              placeholder="38.2527"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Longitude</Label>
                            <Input
                              type="number"
                              step="any"
                              value={newLng}
                              onChange={(e) => setNewLng(e.target.value)}
                              placeholder="-85.7585"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Movement Pattern</Label>
                          <Select value={newMovement} onValueChange={(v) => setNewMovement(v as VirtualNode["movementPattern"])}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="static">Static</SelectItem>
                              <SelectItem value="random">Random Walk</SelectItem>
                              <SelectItem value="path">Follow Path</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={handleCreateNode} className="w-full">
                          Create Node
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button size="sm" variant="destructive" onClick={clear}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {nodes.slice(0, 20).map((node) => (
                  <div
                    key={node.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted))]"
                  >
                    <div className="flex items-center gap-3">
                      <Radio className="h-4 w-4 text-[hsl(var(--primary))]" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-sm">
                            {node.shortName}
                          </span>
                          <Badge
                            variant={node.role === "ROUTER" ? "default" : "outline"}
                            className="text-xs"
                          >
                            {node.role}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                          {node.position && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {node.position.latitude.toFixed(4)}, {node.position.longitude.toFixed(4)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Battery className="h-3 w-3" />
                            {Math.round(node.batteryLevel)}%
                          </span>
                          <span className="flex items-center gap-1">
                            <Wifi className="h-3 w-3" />
                            {node.snr.toFixed(1)}dB
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(node)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(node.id)}
                      >
                        <Trash2 className="h-4 w-4 text-[hsl(var(--red))]" />
                      </Button>
                    </div>
                  </div>
                ))}
                {nodes.length > 20 && (
                  <div className="text-center text-sm text-[hsl(var(--muted-foreground))] py-2">
                    ... and {nodes.length - 20} more nodes
                  </div>
                )}
              </div>
            </div>
          )}

          {nodes.length === 0 && (
            <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No virtual nodes created</p>
              <p className="text-xs mt-1">
                Load a preset or create nodes manually
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Node Dialog */}
      <Dialog open={!!editingNode} onOpenChange={(open) => !open && setEditingNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Virtual Node</DialogTitle>
            <DialogDescription>
              Update node properties for {editingNode?.shortName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Short Name</Label>
                <Input
                  value={editShortName}
                  onChange={(e) => setEditShortName(e.target.value.toUpperCase().slice(0, 4))}
                  maxLength={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as VirtualNode["role"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLIENT">Client</SelectItem>
                    <SelectItem value="ROUTER">Router</SelectItem>
                    <SelectItem value="ROUTER_CLIENT">Router+Client</SelectItem>
                    <SelectItem value="REPEATER">Repeater</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Long Name</Label>
              <Input
                value={editLongName}
                onChange={(e) => setEditLongName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={editLat}
                  onChange={(e) => setEditLat(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={editLng}
                  onChange={(e) => setEditLng(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleEditNode} className="w-full">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
