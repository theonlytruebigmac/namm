"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useNodeAliases } from "@/hooks/useNodeAliases";
import { useFavorites } from "@/hooks/useFavorites";
import type { Node } from "@/types";
import {
  MoreHorizontal,
  MessageSquare,
  Route,
  Star,
  StarOff,
  Pencil,
  MapPin,
  Copy,
  ExternalLink,
  Radio,
  GitCompare,
  Folder,
} from "lucide-react";
import Link from "next/link";
import { RenameNodeDialog } from "./RenameNodeDialog";
import { AddToGroupMenu } from "./NodeGroups";

interface QuickNodeActionsProps {
  node: Node;
  variant?: "default" | "icon";
  size?: "default" | "sm" | "lg" | "icon";
}

export function QuickNodeActions({ node, variant = "icon", size = "icon" }: QuickNodeActionsProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const { toggleFavorite, isFavorite } = useFavorites();
  const { getAlias } = useNodeAliases();
  const nodeIsFavorite = isFavorite(node.id);
  const alias = getAlias(node.id);

  const handleCopyId = () => {
    navigator.clipboard.writeText(node.id);
  };

  const handleCopyPosition = () => {
    if (node.position?.latitude && node.position?.longitude) {
      navigator.clipboard.writeText(`${node.position.latitude}, ${node.position.longitude}`);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size={size}>
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-mono text-xs truncate">
            {alias || node.shortName || node.id}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Navigation Actions */}
          <DropdownMenuItem asChild>
            <Link href={`/nodes/${node.id}`} className="flex items-center gap-2 cursor-pointer">
              <ExternalLink className="h-4 w-4" />
              View Details
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href={`/messages?node=${node.id}`} className="flex items-center gap-2 cursor-pointer">
              <MessageSquare className="h-4 w-4" />
              Send Message
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href={`/traceroutes?to=${node.id}`} className="flex items-center gap-2 cursor-pointer">
              <Route className="h-4 w-4" />
              Traceroute
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href={`/compare?node1=${node.id}`} className="flex items-center gap-2 cursor-pointer">
              <GitCompare className="h-4 w-4" />
              Compare With...
            </Link>
          </DropdownMenuItem>

          {node.position?.latitude && node.position?.longitude && (
            <DropdownMenuItem asChild>
              <Link href={`/map?focus=${node.id}`} className="flex items-center gap-2 cursor-pointer">
                <MapPin className="h-4 w-4" />
                Show on Map
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Quick Actions */}
          <DropdownMenuItem onClick={() => toggleFavorite(node.id)} className="cursor-pointer">
            {nodeIsFavorite ? (
              <>
                <StarOff className="h-4 w-4 mr-2" />
                Remove Favorite
              </>
            ) : (
              <>
                <Star className="h-4 w-4 mr-2" />
                Add to Favorites
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setRenameOpen(true)} className="cursor-pointer">
            <Pencil className="h-4 w-4 mr-2" />
            {alias ? "Edit Alias" : "Set Alias"}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setGroupsOpen(true)} className="cursor-pointer">
            <Folder className="h-4 w-4 mr-2" />
            Manage Groups
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Copy Actions */}
          <DropdownMenuItem onClick={handleCopyId} className="cursor-pointer">
            <Copy className="h-4 w-4 mr-2" />
            Copy Node ID
          </DropdownMenuItem>

          {node.position?.latitude && node.position?.longitude && (
            <DropdownMenuItem onClick={handleCopyPosition} className="cursor-pointer">
              <MapPin className="h-4 w-4 mr-2" />
              Copy Coordinates
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs */}
      <RenameNodeDialog node={node} open={renameOpen} onOpenChange={setRenameOpen} />

      {groupsOpen && (
        <AddToGroupMenu
          nodeId={node.id}
          trigger={<span className="hidden" />}
        />
      )}
    </>
  );
}

/**
 * Compact version for use in lists/tables
 */
interface NodeActionButtonsProps {
  node: Node;
  showFavorite?: boolean;
  showMessage?: boolean;
  showMenu?: boolean;
}

export function NodeActionButtons({
  node,
  showFavorite = true,
  showMessage = true,
  showMenu = true
}: NodeActionButtonsProps) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const nodeIsFavorite = isFavorite(node.id);

  return (
    <div className="flex items-center gap-1">
      {showFavorite && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => toggleFavorite(node.id)}
        >
          <Star className={`h-4 w-4 ${nodeIsFavorite ? "fill-yellow-500 text-yellow-500" : ""}`} />
        </Button>
      )}

      {showMessage && (
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href={`/messages?node=${node.id}`}>
            <MessageSquare className="h-4 w-4" />
          </Link>
        </Button>
      )}

      {showMenu && <QuickNodeActions node={node} />}
    </div>
  );
}
