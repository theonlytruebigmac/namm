"use client";

import { useMemo } from "react";
import { Circle, Polyline, useMap } from "react-leaflet";
import { Node } from "@/types";

interface SignalPropagationLayerProps {
  nodes: Node[];
  selectedNode?: string | null;
  showAllNodes?: boolean;
  maxDistance?: number; // in meters
}

/**
 * Calculate signal strength based on distance using free-space path loss model
 * Returns a value between 0 and 1
 */
function calculateSignalStrength(
  distanceKm: number,
  frequencyMHz: number = 915 // US LoRa frequency
): number {
  if (distanceKm <= 0) return 1;

  // Free Space Path Loss formula: FSPL = 20*log10(d) + 20*log10(f) + 20*log10(4π/c)
  // Simplified for our purposes
  const pathLoss = 20 * Math.log10(distanceKm) + 20 * Math.log10(frequencyMHz) + 32.44;

  // Normalize to 0-1 range (assuming max usable signal at ~100dB loss)
  const maxLoss = 140; // Typical max for LoRa
  const minLoss = 60; // Close range
  const normalized = 1 - Math.min(1, Math.max(0, (pathLoss - minLoss) / (maxLoss - minLoss)));

  return normalized;
}

/**
 * Calculate distance between two coordinates in kilometers
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Generate concentric signal rings around a node
 */
function SignalRings({ node, maxDistanceKm = 10 }: { node: Node; maxDistanceKm?: number }) {
  if (!node.position) return null;

  const center: [number, number] = [node.position.latitude, node.position.longitude];
  const rings = [
    { distance: 0.5, opacity: 0.4, color: "#22c55e" }, // 500m - excellent
    { distance: 1, opacity: 0.35, color: "#84cc16" }, // 1km - very good
    { distance: 2, opacity: 0.3, color: "#eab308" }, // 2km - good
    { distance: 5, opacity: 0.2, color: "#f97316" }, // 5km - moderate
    { distance: maxDistanceKm, opacity: 0.1, color: "#ef4444" }, // max - weak
  ];

  return (
    <>
      {rings.map((ring) => (
        <Circle
          key={ring.distance}
          center={center}
          radius={ring.distance * 1000} // Convert km to meters
          pathOptions={{
            color: ring.color,
            fillColor: ring.color,
            fillOpacity: ring.opacity,
            weight: 1,
            opacity: ring.opacity + 0.2,
          }}
        />
      ))}
    </>
  );
}

/**
 * Draw signal strength lines between connected nodes
 */
function SignalLines({
  sourceNode,
  targetNodes,
}: {
  sourceNode: Node;
  targetNodes: Node[];
}) {
  if (!sourceNode.position) return null;

  const lines = useMemo(() => {
    return targetNodes
      .filter((target) => target.position && target.id !== sourceNode.id)
      .map((target) => {
        const distance = haversineDistance(
          sourceNode.position!.latitude,
          sourceNode.position!.longitude,
          target.position!.latitude,
          target.position!.longitude
        );
        const strength = calculateSignalStrength(distance);

        // Color based on signal strength
        let color: string;
        if (strength > 0.7) color = "#22c55e"; // green - excellent
        else if (strength > 0.5) color = "#84cc16"; // lime - good
        else if (strength > 0.3) color = "#eab308"; // yellow - moderate
        else if (strength > 0.15) color = "#f97316"; // orange - weak
        else color = "#ef4444"; // red - very weak

        return {
          positions: [
            [sourceNode.position!.latitude, sourceNode.position!.longitude] as [number, number],
            [target.position!.latitude, target.position!.longitude] as [number, number],
          ],
          color,
          strength,
          weight: Math.max(1, strength * 5),
          targetId: target.id,
        };
      });
  }, [sourceNode, targetNodes]);

  return (
    <>
      {lines.map((line) => (
        <Polyline
          key={`${sourceNode.id}-${line.targetId}`}
          positions={line.positions}
          pathOptions={{
            color: line.color,
            weight: line.weight,
            opacity: 0.6 + line.strength * 0.4,
            dashArray: line.strength < 0.3 ? "5, 10" : undefined,
          }}
        />
      ))}
    </>
  );
}

/**
 * Signal Propagation Layer Component
 *
 * Shows estimated signal coverage and strength between nodes on the map
 */
export function SignalPropagationLayer({
  nodes,
  selectedNode,
  showAllNodes = false,
  maxDistance = 10000, // 10km default
}: SignalPropagationLayerProps) {
  const nodesWithPosition = useMemo(
    () => nodes.filter((n) => n.position?.latitude && n.position?.longitude),
    [nodes]
  );

  // If a specific node is selected, show its propagation
  if (selectedNode) {
    const sourceNode = nodesWithPosition.find((n) => n.id === selectedNode);
    if (!sourceNode) return null;

    return (
      <>
        <SignalRings node={sourceNode} maxDistanceKm={maxDistance / 1000} />
        <SignalLines sourceNode={sourceNode} targetNodes={nodesWithPosition} />
      </>
    );
  }

  // Show signal lines for all router nodes if showAllNodes is enabled
  if (showAllNodes) {
    const routerNodes = nodesWithPosition.filter(
      (n) => n.role === "ROUTER" || n.role === "ROUTER_CLIENT"
    );

    return (
      <>
        {routerNodes.map((router) => (
          <SignalRings key={router.id} node={router} maxDistanceKm={2} />
        ))}
      </>
    );
  }

  return null;
}

/**
 * Signal strength legend for the map
 */
export function SignalLegend() {
  const items = [
    { color: "#22c55e", label: "Excellent (>70%)" },
    { color: "#84cc16", label: "Good (50-70%)" },
    { color: "#eab308", label: "Moderate (30-50%)" },
    { color: "#f97316", label: "Weak (15-30%)" },
    { color: "#ef4444", label: "Very Weak (<15%)" },
  ];

  return (
    <div className="bg-[hsl(var(--card))] p-3 rounded-lg border border-border text-sm space-y-1.5">
      <div className="font-medium text-foreground mb-2">Signal Strength</div>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
