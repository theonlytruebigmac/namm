"use client";

import { memo } from "react";
import { Node } from "@/types";
import { Badge } from "@/components/ui/badge";
import { formatTimestamp } from "@/lib/utils";
import { Battery, Signal } from "lucide-react";

interface NodeStatusItemProps {
  node: Node;
  onNodeClick?: (nodeId: string) => void;
}

// Memoized individual node item to prevent re-renders
const NodeStatusItem = memo(function NodeStatusItem({ node, onNodeClick }: NodeStatusItemProps) {
  const isActive = Date.now() - node.lastHeard < 3600000;
  const batteryLevel = node.batteryLevel || 0;
  const batteryColor =
    batteryLevel > 50
      ? "text-[hsl(var(--green))]"
      : batteryLevel > 20
      ? "text-[hsl(var(--yellow))]"
      : "text-[hsl(var(--red))]";

  return (
    <button
      onClick={() => onNodeClick?.(node.id)}
      className="w-full text-left p-3 rounded-lg bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent))] transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div
            className={`h-2 w-2 rounded-full ${
              isActive
                ? "bg-[hsl(var(--green))] animate-pulse"
                : "bg-[hsl(var(--muted-foreground))] opacity-50"
            }`}
          />
          <div>
            <div className="font-mono text-sm font-semibold text-[hsl(var(--primary))]">
              {node.shortName}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              {node.role.toLowerCase().replace("_", " ")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {node.batteryLevel !== undefined && (
            <div className={`flex items-center gap-1 text-xs ${batteryColor}`}>
              <Battery className="h-3 w-3" />
              <span className="font-medium">{batteryLevel}%</span>
            </div>
          )}
          {node.snr !== undefined && (
            <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
              <Signal className="h-3 w-3" />
              <span>{node.snr.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="text-xs text-[hsl(var(--muted-foreground))]">
        Last heard: {formatTimestamp(node.lastHeard)}
      </div>
    </button>
  );
});

interface NodeStatusListProps {
  nodes: Node[];
  maxNodes?: number;
  onNodeClick?: (nodeId: string) => void;
}

export const NodeStatusList = memo(function NodeStatusList({
  nodes,
  maxNodes = 8,
  onNodeClick
}: NodeStatusListProps) {
  const displayNodes = nodes.slice(0, maxNodes);

  return (
    <div className="space-y-2">
      {displayNodes.map((node) => (
        <NodeStatusItem
          key={node.id}
          node={node}
          onNodeClick={onNodeClick}
        />
      ))}
    </div>
  );
});
