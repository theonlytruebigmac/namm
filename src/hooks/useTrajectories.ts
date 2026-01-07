/**
 * useTrajectories Hook
 * Manage node trajectory tracking and visualization
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { Node } from "@/types/node";
import {
  getTrajectoryConfig,
  saveTrajectoryConfig,
  getTrajectories,
  addTrajectoryPoint,
  clearTrajectories,
  clearNodeTrajectory,
  toggleTrajectoryVisibility,
  setTrajectoryColor,
  calculateTotalDistance,
  calculateAverageSpeed,
  type TrajectoryConfig,
  type NodeTrajectory,
} from "@/lib/trajectories";

interface UseTrajectories {
  config: TrajectoryConfig;
  trajectories: NodeTrajectory[];
  loading: boolean;
  enabled: boolean;
  toggle: () => void;
  updateConfig: (updates: Partial<TrajectoryConfig>) => void;
  trackNodes: (nodes: Node[]) => void;
  clearAll: () => void;
  clearNode: (nodeId: string) => void;
  toggleVisibility: (nodeId: string) => void;
  setColor: (nodeId: string, color: string) => void;
  getStats: (nodeId: string) => { distance: number; speed: number } | null;
}

export function useTrajectories(): UseTrajectories {
  const [config, setConfig] = useState<TrajectoryConfig>(getTrajectoryConfig);
  const [trajectories, setTrajectories] = useState<NodeTrajectory[]>([]);
  const [loading, setLoading] = useState(true);
  const lastPositions = useRef<Map<string, { lat: number; lng: number }>>(new Map());

  // Load initial data
  useEffect(() => {
    setConfig(getTrajectoryConfig());
    setTrajectories(getTrajectories());
    setLoading(false);
  }, []);

  // Listen for changes from other components
  useEffect(() => {
    const handleChange = () => {
      setTrajectories(getTrajectories());
    };

    window.addEventListener("trajectories-changed", handleChange);
    return () => window.removeEventListener("trajectories-changed", handleChange);
  }, []);

  // Toggle tracking
  const toggle = useCallback(() => {
    const newConfig = { ...config, enabled: !config.enabled };
    setConfig(newConfig);
    saveTrajectoryConfig(newConfig);
  }, [config]);

  // Update config
  const updateConfig = useCallback(
    (updates: Partial<TrajectoryConfig>) => {
      const newConfig = { ...config, ...updates };
      setConfig(newConfig);
      saveTrajectoryConfig(newConfig);
    },
    [config]
  );

  // Track nodes and record position changes
  const trackNodes = useCallback(
    (nodes: Node[]) => {
      if (!config.enabled) return;

      const MIN_DISTANCE_M = 10; // Minimum 10m movement to record

      for (const node of nodes) {
        if (!node.position?.latitude || !node.position?.longitude) continue;
        // Skip virtual nodes or nodes without proper IDs
        if ((node as any).isVirtual) continue;

        const lastPos = lastPositions.current.get(node.id);
        const currentPos = { lat: node.position.latitude, lng: node.position.longitude };

        // Check if position has changed significantly
        if (lastPos) {
          const latDiff = Math.abs(lastPos.lat - currentPos.lat);
          const lngDiff = Math.abs(lastPos.lng - currentPos.lng);

          // Roughly 10m ≈ 0.0001 degrees
          if (latDiff < 0.0001 && lngDiff < 0.0001) {
            continue; // No significant movement
          }
        }

        // Record new position
        addTrajectoryPoint(node.id, node.shortName, {
          lat: currentPos.lat,
          lng: currentPos.lng,
          altitude: node.position.altitude,
        });

        lastPositions.current.set(node.id, currentPos);
      }

      // Refresh trajectories
      setTrajectories(getTrajectories());
    },
    [config.enabled]
  );

  // Clear all trajectories
  const clearAll = useCallback(() => {
    clearTrajectories();
    setTrajectories([]);
    lastPositions.current.clear();
  }, []);

  // Clear single node trajectory
  const clearNode = useCallback((nodeId: string) => {
    clearNodeTrajectory(nodeId);
    setTrajectories(getTrajectories());
    lastPositions.current.delete(nodeId);
  }, []);

  // Toggle visibility
  const toggleVisibility = useCallback((nodeId: string) => {
    toggleTrajectoryVisibility(nodeId);
    setTrajectories(getTrajectories());
  }, []);

  // Set color
  const setColor = useCallback((nodeId: string, color: string) => {
    setTrajectoryColor(nodeId, color);
    setTrajectories(getTrajectories());
  }, []);

  // Get stats for a trajectory
  const getStats = useCallback(
    (nodeId: string) => {
      const trajectory = trajectories.find((t) => t.nodeId === nodeId);
      if (!trajectory || trajectory.points.length < 2) return null;

      return {
        distance: calculateTotalDistance(trajectory),
        speed: calculateAverageSpeed(trajectory),
      };
    },
    [trajectories]
  );

  return {
    config,
    trajectories,
    loading,
    enabled: config.enabled,
    toggle,
    updateConfig,
    trackNodes,
    clearAll,
    clearNode,
    toggleVisibility,
    setColor,
    getStats,
  };
}

export default useTrajectories;
