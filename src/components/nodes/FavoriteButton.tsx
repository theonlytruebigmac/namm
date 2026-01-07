"use client";

import { memo, useCallback } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  nodeId: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "ghost" | "outline";
  showLabel?: boolean;
}

/**
 * A button to toggle favorite status of a node
 */
export const FavoriteButton = memo(function FavoriteButton({
  nodeId,
  className,
  size = "icon",
  variant = "ghost",
  showLabel = false,
}: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite, isToggling } = useFavorites();

  const favorite = isFavorite(nodeId);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering parent click handlers
    e.preventDefault();
    toggleFavorite(nodeId);
  }, [nodeId, toggleFavorite]);

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={isToggling}
      className={cn(
        "transition-colors",
        favorite && "text-yellow-500 hover:text-yellow-600",
        className
      )}
      title={favorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Star
        className={cn(
          "h-4 w-4",
          favorite ? "fill-current" : "fill-none"
        )}
      />
      {showLabel && (
        <span className="ml-1">
          {favorite ? "Favorited" : "Favorite"}
        </span>
      )}
    </Button>
  );
});
