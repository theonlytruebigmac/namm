"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Node } from "@/types";
import { useFavorites } from "@/hooks/useFavorites";
import { useNodeGroups } from "@/hooks/useNodeGroups";
import {
  Check,
  X,
  Star,
  StarOff,
  Folder,
  FolderPlus,
  Trash2,
  ChevronDown,
  MessageSquare,
  Download,
  Copy,
} from "lucide-react";

interface BatchNodeActionsProps {
  nodes: Node[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onAction?: (action: string, nodeIds: string[]) => void;
}

export function BatchNodeActions({
  nodes,
  selectedIds,
  onSelectionChange,
  onAction,
}: BatchNodeActionsProps) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const { groups, addNodeToGroup, removeNodeFromGroup } = useNodeGroups();

  const selectedCount = selectedIds.size;
  const allSelected = nodes.length > 0 && selectedCount === nodes.length;
  const someSelected = selectedCount > 0 && selectedCount < nodes.length;

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(nodes.map((n) => n.id)));
    }
  };

  const clearSelection = () => {
    onSelectionChange(new Set());
  };

  const handleAddToGroup = (groupId: string) => {
    [...selectedIds].forEach((nodeId) => {
      addNodeToGroup(groupId, nodeId);
    });
    onAction?.("addToGroup", [...selectedIds]);
  };

  const handleRemoveFromGroup = (groupId: string) => {
    [...selectedIds].forEach((nodeId) => {
      removeNodeFromGroup(groupId, nodeId);
    });
    onAction?.("removeFromGroup", [...selectedIds]);
  };

  const handleBatchFavorite = (add: boolean) => {
    [...selectedIds].forEach((nodeId) => {
      const currentlyFavorite = isFavorite(nodeId);
      if (add && !currentlyFavorite) {
        toggleFavorite(nodeId);
      } else if (!add && currentlyFavorite) {
        toggleFavorite(nodeId);
      }
    });
    onAction?.(add ? "favorite" : "unfavorite", [...selectedIds]);
  };

  const handleCopyIds = () => {
    const ids = [...selectedIds].join(", ");
    navigator.clipboard.writeText(ids);
    onAction?.("copyIds", [...selectedIds]);
  };

  if (selectedCount === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox
          checked={allSelected}
          onCheckedChange={toggleAll}
          aria-label="Select all nodes"
        />
        <span>Select nodes for batch actions</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
      <Checkbox
        checked={allSelected}
        ref={(el) => {
          if (el && someSelected) {
            (el as HTMLInputElement).indeterminate = true;
          }
        }}
        onCheckedChange={toggleAll}
        aria-label="Toggle select all"
      />
      <Badge variant="secondary">
        {selectedCount} selected
      </Badge>

      <div className="flex items-center gap-1 ml-2">
        {/* Add to Favorites */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleBatchFavorite(true)}
          title="Add all to favorites"
        >
          <Star className="h-4 w-4" />
        </Button>

        {/* Remove from Favorites */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleBatchFavorite(false)}
          title="Remove all from favorites"
        >
          <StarOff className="h-4 w-4" />
        </Button>

        {/* Group Actions */}
        {groups.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <FolderPlus className="h-4 w-4 mr-1" />
                Group
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                Add to Group
              </div>
              {groups.map((group) => (
                <DropdownMenuItem
                  key={group.id}
                  onClick={() => handleAddToGroup(group.id)}
                >
                  <div
                    className="h-3 w-3 rounded-full mr-2"
                    style={{ backgroundColor: group.color }}
                  />
                  {group.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                Remove from Group
              </div>
              {groups.map((group) => (
                <DropdownMenuItem
                  key={`remove-${group.id}`}
                  onClick={() => handleRemoveFromGroup(group.id)}
                >
                  <div
                    className="h-3 w-3 rounded-full mr-2"
                    style={{ backgroundColor: group.color }}
                  />
                  {group.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Copy IDs */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyIds}
          title="Copy node IDs"
        >
          <Copy className="h-4 w-4" />
        </Button>

        {/* Clear Selection */}
        <Button
          variant="ghost"
          size="sm"
          onClick={clearSelection}
          title="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface NodeSelectCheckboxProps {
  nodeId: string;
  selected: boolean;
  onToggle: (nodeId: string) => void;
}

export function NodeSelectCheckbox({
  nodeId,
  selected,
  onToggle,
}: NodeSelectCheckboxProps) {
  return (
    <Checkbox
      checked={selected}
      onCheckedChange={() => onToggle(nodeId)}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Select node ${nodeId}`}
    />
  );
}
