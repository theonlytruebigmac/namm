/**
 * useHeatmapData Hook
 * Transform node data into heatmap points based on selected data type
 */

import { useMemo } from "react";
import type { Node } from "@/types/node";
import type { HeatmapDataType } from "@/components/map/HeatmapLayer";

interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
}

interface HeatmapConfig {
  dataType: HeatmapDataType;
  nodes: Node[];
  enabled: boolean;
}

/**
 * Calculate heatmap points from nodes based on the data type
 */
export function useHeatmapData({ dataType, nodes, enabled }: HeatmapConfig): HeatmapPoint[] {
  return useMemo(() => {
    if (!enabled || nodes.length === 0) return [];

    // Filter nodes with valid positions
    const nodesWithPosition = nodes.filter(
      (node) => node.position?.latitude && node.position?.longitude
    );

    if (nodesWithPosition.length === 0) return [];

    switch (dataType) {
      case "signal-strength":
        return calculateSignalStrength(nodesWithPosition);
      case "node-density":
        return calculateNodeDensity(nodesWithPosition);
      case "channel-utilization":
        return calculateChannelUtilization(nodesWithPosition);
      case "battery-levels":
        return calculateBatteryLevels(nodesWithPosition);
      case "activity":
        return calculateActivity(nodesWithPosition);
      default:
        return calculateNodeDensity(nodesWithPosition);
    }
  }, [dataType, nodes, enabled]);
}

/**
 * Signal strength heatmap - based on SNR values
 */
function calculateSignalStrength(nodes: Node[]): HeatmapPoint[] {
  const points: HeatmapPoint[] = [];

  for (const node of nodes) {
    if (!node.position) continue;

    // SNR typically ranges from -20 to +10 dB
    // Normalize to 0-1 range
    const snr = node.snr ?? 0;
    const intensity = Math.max(0, Math.min(1, (snr + 20) / 30));

    points.push({
      lat: node.position.latitude,
      lng: node.position.longitude,
      intensity,
    });

    // Also add interpolated points for coverage area
    // Based on estimated range from SNR
    const range = 0.005 + intensity * 0.01; // ~500m to 1.5km in degrees
    const subPoints = 4;
    for (let i = 0; i < subPoints; i++) {
      const angle = (i / subPoints) * Math.PI * 2;
      points.push({
        lat: node.position.latitude + Math.cos(angle) * range * 0.5,
        lng: node.position.longitude + Math.sin(angle) * range * 0.5,
        intensity: intensity * 0.6,
      });
    }
  }

  return points;
}

/**
 * Node density heatmap - shows concentration of nodes
 */
function calculateNodeDensity(nodes: Node[]): HeatmapPoint[] {
  // Each node contributes to the density
  return nodes
    .filter((n) => n.position)
    .map((node) => ({
      lat: node.position!.latitude,
      lng: node.position!.longitude,
      intensity: 0.8, // Equal weight for all nodes
    }));
}

/**
 * Channel utilization heatmap - shows congestion
 */
function calculateChannelUtilization(nodes: Node[]): HeatmapPoint[] {
  const points: HeatmapPoint[] = [];

  for (const node of nodes) {
    if (!node.position) continue;

    // Channel utilization is 0-100%
    const utilization = node.channelUtilization ?? 0;
    const intensity = utilization / 100;

    points.push({
      lat: node.position.latitude,
      lng: node.position.longitude,
      intensity,
    });

    // Add surrounding points for area coverage
    if (intensity > 0.3) {
      const range = 0.003; // ~300m
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        points.push({
          lat: node.position.latitude + Math.cos(angle) * range,
          lng: node.position.longitude + Math.sin(angle) * range,
          intensity: intensity * 0.5,
        });
      }
    }
  }

  return points;
}

/**
 * Battery levels heatmap - shows battery health distribution
 */
function calculateBatteryLevels(nodes: Node[]): HeatmapPoint[] {
  return nodes
    .filter((n) => n.position && n.batteryLevel !== undefined)
    .map((node) => ({
      lat: node.position!.latitude,
      lng: node.position!.longitude,
      // Battery 0-100% -> intensity 0-1
      intensity: (node.batteryLevel ?? 50) / 100,
    }));
}

/**
 * Activity heatmap - based on last heard time
 */
function calculateActivity(nodes: Node[]): HeatmapPoint[] {
  const now = Date.now();
  const hourMs = 3600000;

  return nodes
    .filter((n) => n.position && n.lastHeard)
    .map((node) => {
      const age = now - (node.lastHeard || 0);
      // Nodes active in last hour get high intensity
      // Intensity drops off over 24 hours
      const hoursAgo = age / hourMs;
      const intensity = Math.max(0, 1 - hoursAgo / 24);

      return {
        lat: node.position!.latitude,
        lng: node.position!.longitude,
        intensity,
      };
    });
}

export default useHeatmapData;
