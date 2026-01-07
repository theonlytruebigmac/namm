"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNodeAliases } from "@/hooks/useNodeAliases";
import { Pencil, X } from "lucide-react";
import type { Node } from "@/types";

interface RenameNodeDialogProps {
  node: Node;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameNodeDialog({ node, open, onOpenChange }: RenameNodeDialogProps) {
  const { getAlias, setAlias, removeAlias } = useNodeAliases();
  const currentAlias = getAlias(node.id);
  const [aliasValue, setAliasValue] = useState(currentAlias || "");

  // Update local state when dialog opens
  useEffect(() => {
    if (open) {
      setAliasValue(currentAlias || "");
    }
  }, [open, currentAlias]);

  const handleSave = () => {
    if (aliasValue.trim()) {
      setAlias(node.id, aliasValue.trim());
    } else {
      removeAlias(node.id);
    }
    onOpenChange(false);
  };

  const handleRemove = () => {
    removeAlias(node.id);
    setAliasValue("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Rename Node
          </DialogTitle>
          <DialogDescription>
            Set a custom alias for this node. This only affects how the node is
            displayed in the app and is stored locally.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="original-name" className="text-muted-foreground">
              Original Name
            </Label>
            <div className="text-sm font-mono bg-muted px-3 py-2 rounded-md">
              {node.shortName || node.longName || node.id}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="alias">Custom Alias</Label>
            <Input
              id="alias"
              placeholder="Enter custom name..."
              value={aliasValue}
              onChange={(e) => setAliasValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                }
              }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use the original name
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          {currentAlias && (
            <Button variant="destructive" onClick={handleRemove} className="mr-auto">
              <X className="h-4 w-4 mr-1" />
              Remove Alias
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Button to trigger the rename dialog
 */
interface RenameNodeButtonProps {
  node: Node;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function RenameNodeButton({
  node,
  variant = "outline",
  size = "sm",
  className
}: RenameNodeButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { getAlias } = useNodeAliases();
  const hasAlias = !!getAlias(node.id);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setDialogOpen(true)}
        className={className}
      >
        <Pencil className="h-4 w-4" />
        {size !== "icon" && (
          <span className="ml-1">{hasAlias ? "Edit Alias" : "Rename"}</span>
        )}
      </Button>
      <RenameNodeDialog node={node} open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
