"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getNodeAliases,
  getNodeAlias,
  setNodeAlias as saveNodeAlias,
  removeNodeAlias as deleteNodeAlias,
  type NodeAliases
} from "@/lib/settings";

/**
 * Hook to manage node aliases (custom display names)
 * @returns aliases object and functions to get/set/remove aliases
 */
export function useNodeAliases() {
  const [aliases, setAliases] = useState<NodeAliases>({});

  // Load aliases on mount
  useEffect(() => {
    setAliases(getNodeAliases());

    // Listen for changes from other components
    const handleAliasChange = (e: CustomEvent<NodeAliases>) => {
      setAliases(e.detail);
    };

    window.addEventListener("node-aliases-changed", handleAliasChange as EventListener);
    return () => {
      window.removeEventListener("node-aliases-changed", handleAliasChange as EventListener);
    };
  }, []);

  const setAlias = useCallback((nodeId: string, alias: string) => {
    saveNodeAlias(nodeId, alias);
  }, []);

  const removeAlias = useCallback((nodeId: string) => {
    deleteNodeAlias(nodeId);
  }, []);

  const getAlias = useCallback((nodeId: string): string | undefined => {
    return aliases[nodeId];
  }, [aliases]);

  /**
   * Get the display name for a node, using alias if available
   */
  const getDisplayName = useCallback((nodeId: string, defaultName: string): string => {
    return aliases[nodeId] || defaultName;
  }, [aliases]);

  return {
    aliases,
    getAlias,
    setAlias,
    removeAlias,
    getDisplayName,
  };
}
