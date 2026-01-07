"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNodeGroups, type NodeGroup } from "@/hooks/useNodeGroups";
import { useNodes } from "@/hooks/useNodes";
import { Folder, FolderPlus, Trash2, Edit2, Plus, X, Check, Users } from "lucide-react";
import type { Node } from "@/types";

interface CreateGroupDialogProps {
  onCreated?: (groupId: string) => void;
  trigger?: React.ReactNode;
}

export function CreateGroupDialog({ onCreated, trigger }: CreateGroupDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const { createGroup, defaultColors } = useNodeGroups();

  const handleCreate = () => {
    if (!name.trim()) return;
    const id = createGroup(name.trim(), selectedColor || undefined);
    onCreated?.(id);
    setName("");
    setSelectedColor("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <FolderPlus className="h-4 w-4" />
            New Group
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            Create Node Group
          </DialogTitle>
          <DialogDescription>Create a group to organize your nodes.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              placeholder="e.g., Home Network, Remote Sensors..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {defaultColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className="w-8 h-8 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: color,
                    borderColor: selectedColor === color ? "white" : "transparent",
                    boxShadow: selectedColor === color ? `0 0 0 2px ${color}` : "none",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface NodeGroupBadgeProps {
  group: NodeGroup;
  onRemove?: () => void;
  size?: "sm" | "default";
}

export function NodeGroupBadge({ group, onRemove, size = "default" }: NodeGroupBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`gap-1 ${size === "sm" ? "text-xs px-1.5 py-0" : ""}`}
      style={{ borderColor: group.color, color: group.color }}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: group.color }}
      />
      {group.name}
      {onRemove && (
        <button onClick={onRemove} className="ml-1 hover:opacity-70">
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}

interface AddToGroupMenuProps {
  nodeId: string;
  trigger?: React.ReactNode;
}

export function AddToGroupMenu({ nodeId, trigger }: AddToGroupMenuProps) {
  const [open, setOpen] = useState(false);
  const { groups, addNodeToGroup, removeNodeFromGroup, isNodeInGroup } = useNodeGroups();

  const handleToggle = (groupId: string) => {
    if (isNodeInGroup(nodeId, groupId)) {
      removeNodeFromGroup(groupId, nodeId);
    } else {
      addNodeToGroup(groupId, nodeId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-1">
            <Folder className="h-4 w-4" />
            Groups
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[350px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Manage Groups
          </DialogTitle>
          <DialogDescription>Add or remove this node from groups.</DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-2">
          {groups.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No groups created yet</p>
              <CreateGroupDialog
                trigger={
                  <Button variant="outline" size="sm" className="mt-2">
                    <Plus className="h-4 w-4 mr-1" />
                    Create First Group
                  </Button>
                }
              />
            </div>
          ) : (
            groups.map((group) => {
              const isInGroup = isNodeInGroup(nodeId, group.id);
              return (
                <button
                  key={group.id}
                  onClick={() => handleToggle(group.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    isInGroup ? "bg-accent" : "hover:bg-muted"
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: group.color }}
                  >
                    {isInGroup && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <span className="flex-1 text-left font-medium">{group.name}</span>
                  <span className="text-xs text-muted-foreground">{group.nodeIds.length} nodes</span>
                </button>
              );
            })
          )}
        </div>

        {groups.length > 0 && (
          <DialogFooter className="flex-row justify-between">
            <CreateGroupDialog
              trigger={
                <Button variant="ghost" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New Group
                </Button>
              }
            />
            <Button onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface NodeGroupsManagerProps {
  className?: string;
}

export function NodeGroupsManager({ className }: NodeGroupsManagerProps) {
  const { groups, deleteGroup, updateGroup } = useNodeGroups();
  const { data: nodes } = useNodes();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const startEdit = (group: NodeGroup) => {
    setEditingId(group.id);
    setEditName(group.name);
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      updateGroup(editingId, { name: editName.trim() });
    }
    setEditingId(null);
    setEditName("");
  };

  const getGroupNodes = (group: NodeGroup): Node[] => {
    return nodes?.filter((n) => group.nodeIds.includes(n.id)) || [];
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Node Groups
          </CardTitle>
          <CreateGroupDialog />
        </div>
        <CardDescription>Organize nodes into groups for easy filtering</CardDescription>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Folder className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No groups yet</p>
            <p className="text-sm">Create groups to organize your nodes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const groupNodes = getGroupNodes(group);
              return (
                <div
                  key={group.id}
                  className="flex items-center gap-3 p-3 bg-muted rounded-lg"
                >
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  {editingId === group.id ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-7 flex-1"
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium flex-1">{group.name}</span>
                  )}
                  <Badge variant="secondary">{groupNodes.length} nodes</Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(group)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteGroup(group.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
