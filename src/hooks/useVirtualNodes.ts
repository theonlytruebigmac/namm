"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  type VirtualNode,
  type VirtualNodeConfig,
  getVirtualNodeConfig,
  saveVirtualNodeConfig,
  addVirtualNode,
  updateVirtualNode,
  removeVirtualNode,
  toggleVirtualNodes,
  createVirtualNode,
  updateNodePosition,
  updateNodeTelemetry,
  createPresetNetwork,
  clearVirtualNodes,
} from "@/lib/virtual-nodes";

/**
 * Hook for managing virtual nodes
 */
export function useVirtualNodes() {
  const [config, setConfig] = useState<VirtualNodeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load config on mount
  useEffect(() => {
    setConfig(getVirtualNodeConfig());
    setLoading(false);
  }, []);

  // Listen for changes from other components
  useEffect(() => {
    const handleChange = (e: Event) => {
      const customEvent = e as CustomEvent<VirtualNodeConfig>;
      setConfig(customEvent.detail);
    };

    window.addEventListener("virtual-nodes-changed", handleChange);
    return () => window.removeEventListener("virtual-nodes-changed", handleChange);
  }, []);

  // Auto-update virtual nodes when enabled
  useEffect(() => {
    if (!config?.enabled || !config.simulateTelemetry) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      const currentConfig = getVirtualNodeConfig();
      if (!currentConfig.enabled) return;

      // Update all nodes
      const updatedNodes = currentConfig.nodes.map((node) => {
        let updated = updateNodeTelemetry(node);
        if (node.movementPattern !== "static") {
          updated = updateNodePosition(updated);
        }
        return updated;
      });

      currentConfig.nodes = updatedNodes;
      saveVirtualNodeConfig(currentConfig);
    }, config.updateInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [config?.enabled, config?.updateInterval, config?.simulateTelemetry]);

  // Toggle enabled state
  const toggle = useCallback((enabled: boolean) => {
    const updated = toggleVirtualNodes(enabled);
    setConfig(updated);
  }, []);

  // Add a new node
  const add = useCallback((overrides?: Partial<VirtualNode>) => {
    const node = createVirtualNode(overrides);
    const updated = addVirtualNode(node);
    setConfig(updated);
    return node;
  }, []);

  // Update a node
  const update = useCallback((nodeId: string, updates: Partial<VirtualNode>) => {
    const updated = updateVirtualNode(nodeId, updates);
    setConfig(updated);
  }, []);

  // Remove a node
  const remove = useCallback((nodeId: string) => {
    const updated = removeVirtualNode(nodeId);
    setConfig(updated);
  }, []);

  // Load a preset network
  const loadPreset = useCallback(
    (preset: "small" | "medium" | "large" | "stress") => {
      const nodes = createPresetNetwork(preset);
      const currentConfig = getVirtualNodeConfig();
      currentConfig.nodes = nodes;
      currentConfig.enabled = true;
      saveVirtualNodeConfig(currentConfig);
      setConfig(currentConfig);
    },
    []
  );

  // Clear all nodes
  const clear = useCallback(() => {
    const updated = clearVirtualNodes();
    setConfig(updated);
  }, []);

  // Update config settings
  const updateConfig = useCallback(
    (updates: Partial<Omit<VirtualNodeConfig, "nodes">>) => {
      const currentConfig = getVirtualNodeConfig();
      const updated = { ...currentConfig, ...updates };
      saveVirtualNodeConfig(updated);
      setConfig(updated);
    },
    []
  );

  return {
    config,
    nodes: config?.nodes ?? [],
    enabled: config?.enabled ?? false,
    loading,
    toggle,
    add,
    update,
    remove,
    loadPreset,
    clear,
    updateConfig,
  };
}
