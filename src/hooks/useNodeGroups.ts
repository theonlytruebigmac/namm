"use client";

import { useState, useEffect, useCallback } from "react";

export interface NodeGroup {
  id: string;
  name: string;
  color: string;
  nodeIds: string[];
  createdAt: number;
}

const STORAGE_KEY = "namm-node-groups";

const DEFAULT_COLORS = [
  "#22c55e", // green
  "#3b82f6", // blue
  "#a855f7", // purple
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
];

function loadNodeGroups(): NodeGroup[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveNodeGroups(groups: NodeGroup[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
    window.dispatchEvent(new CustomEvent("node-groups-changed", { detail: groups }));
  } catch (error) {
    console.error("Failed to save node groups:", error);
  }
}

export function useNodeGroups() {
  const [groups, setGroups] = useState<NodeGroup[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    setGroups(loadNodeGroups());
    setIsLoaded(true);

    const handleChange = (e: CustomEvent<NodeGroup[]>) => {
      setGroups(e.detail);
    };

    window.addEventListener("node-groups-changed", handleChange as EventListener);
    return () => {
      window.removeEventListener("node-groups-changed", handleChange as EventListener);
    };
  }, []);

  // Save whenever groups change
  useEffect(() => {
    if (isLoaded) {
      saveNodeGroups(groups);
    }
  }, [groups, isLoaded]);

  const createGroup = useCallback((name: string, color?: string): string => {
    const id = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const usedColors = groups.map((g) => g.color);
    const availableColor = DEFAULT_COLORS.find((c) => !usedColors.includes(c)) || DEFAULT_COLORS[0];

    const newGroup: NodeGroup = {
      id,
      name,
      color: color || availableColor,
      nodeIds: [],
      createdAt: Date.now(),
    };

    setGroups((prev) => [...prev, newGroup]);
    return id;
  }, [groups]);

  const updateGroup = useCallback((id: string, updates: Partial<Omit<NodeGroup, "id" | "createdAt">>) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const addNodeToGroup = useCallback((groupId: string, nodeId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId && !g.nodeIds.includes(nodeId) ? { ...g, nodeIds: [...g.nodeIds, nodeId] } : g
      )
    );
  }, []);

  const removeNodeFromGroup = useCallback((groupId: string, nodeId: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, nodeIds: g.nodeIds.filter((id) => id !== nodeId) } : g))
    );
  }, []);

  const getNodeGroups = useCallback(
    (nodeId: string): NodeGroup[] => {
      return groups.filter((g) => g.nodeIds.includes(nodeId));
    },
    [groups]
  );

  const isNodeInGroup = useCallback(
    (nodeId: string, groupId: string): boolean => {
      const group = groups.find((g) => g.id === groupId);
      return group?.nodeIds.includes(nodeId) || false;
    },
    [groups]
  );

  return {
    groups,
    createGroup,
    updateGroup,
    deleteGroup,
    addNodeToGroup,
    removeNodeFromGroup,
    getNodeGroups,
    isNodeInGroup,
    defaultColors: DEFAULT_COLORS,
  };
}
