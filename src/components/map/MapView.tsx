"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap, Tooltip } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Node } from "@/types";
import { HeatmapLayer, HEATMAP_GRADIENTS, type HeatmapDataType } from "./HeatmapLayer";
import { TrajectoryLayer } from "./TrajectoryLayer";
import { SignalPropagationLayer } from "./SignalPropagationLayer";
import { useHeatmapData } from "@/hooks/useHeatmapData";
import type { NodeTrajectory, TrajectoryConfig } from "@/lib/trajectories";
import Link from "next/link";

type MapLayer = "street" | "satellite" | "terrain";

// Fix for default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom marker icons based on node role
const createCustomIcon = (role: string, isOnline: boolean) => {
  const getColor = () => {
    if (!isOnline) return "#6b7280"; // gray for offline

    switch (role) {
      case "ROUTER":
      case "ROUTER_CLIENT":
        return "#10b981"; // emerald green
      case "CLIENT":
      case "CLIENT_MUTE":
        return "#3b82f6"; // blue
      case "REPEATER":
        return "#a855f7"; // purple
      case "TRACKER":
        return "#f59e0b"; // amber
      default:
        return "#06b6d4"; // cyan
    }
  };

  const color = getColor();

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background-color: ${color};
        border: 2px solid rgba(0,0,0,0.6);
        outline: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background-color: white;
          border-radius: 50%;
          opacity: ${isOnline ? '1' : '0.3'};
        "></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

// Component to auto-fit bounds to all markers
function FitBounds({ nodes, autoCenter }: { nodes: Node[]; autoCenter: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!autoCenter || nodes.length === 0) return;

    const bounds = nodes
      .filter((node) => node.position?.latitude && node.position?.longitude)
      .map((node) => [node.position!.latitude, node.position!.longitude] as [number, number]);

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [nodes, map, autoCenter]);

  return null;
}

// Format time ago
function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export interface TracerouteOverlay {
  id: number;
  route: number[];
  hops: number;
  success: boolean;
  timestamp: number;
}

export interface HeatmapOptions {
  enabled: boolean;
  dataType: HeatmapDataType;
  radius?: number;
  blur?: number;
  opacity?: number;
}

export interface TrajectoryOptions {
  enabled: boolean;
  trajectories: NodeTrajectory[];
  config: TrajectoryConfig;
}

interface MapViewProps {
  nodes: Node[];
  mapLayer?: MapLayer;
  showRangeCircles?: boolean;
  showSignalLines?: boolean;
  showSignalPropagation?: boolean;
  selectedNodeForSignal?: string | null;
  showNodeLabels?: boolean;
  clusterMarkers?: boolean;
  autoCenter?: boolean;
  traceroutes?: TracerouteOverlay[];
  showTraceroutes?: boolean;
  heatmap?: HeatmapOptions;
  trajectory?: TrajectoryOptions;
}

export function MapView({
  nodes,
  mapLayer = "street",
  showRangeCircles = false,
  showSignalLines = false,
  showSignalPropagation = false,
  selectedNodeForSignal = null,
  showNodeLabels = true,
  clusterMarkers = true,
  autoCenter = false,
  traceroutes = [],
  showTraceroutes = false,
  heatmap,
  trajectory,
}: MapViewProps) {
  const [mounted, setMounted] = useState(false);

  // Calculate heatmap data points
  const heatmapPoints = useHeatmapData({
    dataType: heatmap?.dataType || "node-density",
    nodes,
    enabled: heatmap?.enabled ?? false,
  });

  // Get gradient for current heatmap type
  const heatmapGradient = useMemo(() => {
    if (!heatmap?.dataType) return HEATMAP_GRADIENTS["node-density"];
    return HEATMAP_GRADIENTS[heatmap.dataType];
  }, [heatmap?.dataType]);

  // Only render map on client side
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  // Filter nodes that have valid GPS coordinates
  const nodesWithPosition = nodes.filter(
    (node) => node.position?.latitude && node.position?.longitude
  );

  // Default center (San Francisco) if no nodes with position
  const defaultCenter: [number, number] = [37.7749, -122.4194];
  const center: [number, number] =
    nodesWithPosition.length > 0
      ? [nodesWithPosition[0].position!.latitude, nodesWithPosition[0].position!.longitude]
      : defaultCenter;

  // Map tile layers
  const getTileLayer = () => {
    switch (mapLayer) {
      case "satellite":
        return {
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
        };
      case "terrain":
        return {
          url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
          attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
        };
      default: // street
        return {
          url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        };
    }
  };

  const tileLayer = getTileLayer();

  // Calculate signal lines between nodes with recent communication
  const getSignalLines = () => {
    if (!showSignalLines) return [];

    const lines: Array<{ from: Node; to: Node; strength: number }> = [];
    const recentlyHeard = nodesWithPosition.filter(n =>
      n.lastHeard && Date.now() - n.lastHeard < 3600000
    );

    // Create connections between nearby nodes (simplified - in reality would use routing table)
    for (let i = 0; i < recentlyHeard.length; i++) {
      for (let j = i + 1; j < Math.min(i + 3, recentlyHeard.length); j++) {
        const node1 = recentlyHeard[i];
        const node2 = recentlyHeard[j];

        // Calculate distance
        const lat1 = node1.position!.latitude;
        const lon1 = node1.position!.longitude;
        const lat2 = node2.position!.latitude;
        const lon2 = node2.position!.longitude;

        const distance = Math.sqrt(
          Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2)
        );

        // Only show connections within reasonable range (~10km in degrees)
        if (distance < 0.1) {
          const strength = Math.max(0, 100 - distance * 1000);
          lines.push({ from: node1, to: node2, strength });
        }
      }
    }

    return lines;
  };

  // Build traceroute polylines from node positions
  const getTracerouteLines = () => {
    if (!showTraceroutes || traceroutes.length === 0) return [];

    // Create a map from node num to position
    const nodePositionMap = new Map<number, [number, number]>();
    nodesWithPosition.forEach(node => {
      const nodeNum = parseInt(node.id.replace("!", ""), 16);
      if (node.position?.latitude && node.position?.longitude) {
        nodePositionMap.set(nodeNum, [node.position.latitude, node.position.longitude]);
      }
    });

    return traceroutes.map(trace => {
      const positions: [number, number][] = [];
      for (const nodeNum of trace.route) {
        const pos = nodePositionMap.get(nodeNum);
        if (pos) {
          positions.push(pos);
        }
      }
      return {
        id: trace.id,
        positions,
        success: trace.success,
        hops: trace.hops,
        timestamp: trace.timestamp
      };
    }).filter(line => line.positions.length >= 2);
  };

  const signalLines = getSignalLines();
  const tracerouteLines = getTracerouteLines();

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
      >
        <TileLayer
          attribution={tileLayer.attribution}
          url={tileLayer.url}
        />

        <FitBounds nodes={nodesWithPosition} autoCenter={autoCenter} />

        {/* Heatmap overlay */}
        {heatmap?.enabled && (
          <HeatmapLayer
            points={heatmapPoints}
            enabled={heatmap.enabled}
            radius={heatmap.radius ?? 30}
            blur={heatmap.blur ?? 20}
            opacity={heatmap.opacity ?? 0.6}
            gradient={heatmapGradient}
          />
        )}

        {/* Node trajectory paths */}
        {trajectory?.enabled && (
          <TrajectoryLayer
            trajectories={trajectory.trajectories}
            config={trajectory.config}
          />
        )}

        {/* Signal propagation visualization */}
        {showSignalPropagation && (
          <SignalPropagationLayer
            nodes={nodesWithPosition}
            selectedNode={selectedNodeForSignal}
            showAllNodes={!selectedNodeForSignal}
          />
        )}

        {/* Traceroute path lines */}
        {showTraceroutes && tracerouteLines.map((line, idx) => (
          <Polyline
            key={`trace-${line.id}`}
            positions={line.positions}
            pathOptions={{
              color: line.success ? "#a855f7" : "#ef4444", // Purple for success, red for failed
              weight: 3,
              opacity: 0.7,
              dashArray: line.success ? undefined : "10, 5"
            }}
          >
            <Popup>
              <div className="min-w-[160px]">
                <h4 className="font-semibold mb-1">Traceroute #{line.id}</h4>
                <p className="text-sm text-gray-600">{line.hops} hops</p>
                <p className="text-sm text-gray-600">
                  {line.success ? "✓ Successful" : "✗ Failed"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(line.timestamp).toLocaleString()}
                </p>
              </div>
            </Popup>
          </Polyline>
        ))}

        {/* Signal strength lines between nodes */}
        {showSignalLines && signalLines.map((line, idx) => {
          const opacity = line.strength / 100;
          const color = line.strength > 70 ? "#22c55e" : line.strength > 40 ? "#f59e0b" : "#ef4444";

          return (
            <Polyline
              key={`signal-${idx}`}
              positions={[
                [line.from.position!.latitude, line.from.position!.longitude],
                [line.to.position!.latitude, line.to.position!.longitude]
              ]}
              pathOptions={{
                color: color,
                weight: 2,
                opacity: opacity * 0.6,
                dashArray: "5, 10"
              }}
            />
          );
        })}

        {/* Range circles for nodes */}
        {showRangeCircles && nodesWithPosition.map((node) => {
          const isOnline = node.lastHeard && Date.now() - node.lastHeard < 3600000;
          if (!isOnline) return null;

          // Calculate range based on role and SNR if available
          // Better SNR = better range estimation
          const baseRange = node.role === "ROUTER" || node.role === "ROUTER_CLIENT" ? 8000 :
                           node.role === "REPEATER" ? 12000 :
                           5000;

          // Adjust based on SNR if available (SNR of 10+ is excellent)
          const snrMultiplier = node.snr ? Math.min(1.5, Math.max(0.5, (node.snr + 10) / 20)) : 1;
          const range = Math.round(baseRange * snrMultiplier);

          const color = node.role === "ROUTER" || node.role === "ROUTER_CLIENT" ? "#10b981" :
                       node.role === "REPEATER" ? "#a855f7" :
                       "#3b82f6";

          return (
            <Circle
              key={`range-${node.id}`}
              center={[node.position!.latitude, node.position!.longitude]}
              radius={range}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.08,
                weight: 2,
                opacity: 0.4,
                dashArray: "4, 4"
              }}
            />
          );
        })}

        {/* Nodes - with or without clustering based on settings */}
        {clusterMarkers ? (
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={50}
            spiderfyOnMaxZoom={true}
            showCoverageOnHover={false}
            iconCreateFunction={(cluster: any) => {
              const count = cluster.getChildCount();
              let size = "small";
              if (count > 10) size = "medium";
              if (count > 50) size = "large";

              return L.divIcon({
                html: `<div><span>${count}</span></div>`,
                className: `marker-cluster marker-cluster-${size}`,
                iconSize: L.point(40, 40, true),
              });
            }}
          >
            {nodesWithPosition.map((node) => {
              const isOnline = node.lastHeard && Date.now() - node.lastHeard < 3600000;

              return (
                <Marker
                  key={node.id}
                  position={[node.position!.latitude, node.position!.longitude]}
                  icon={createCustomIcon(node.role || "CLIENT", isOnline || false)}
                >
                  <Tooltip direction="top" offset={[0, -20]} opacity={0.95}>
                    <div className="text-xs font-sans">
                      <div className="font-bold text-sm mb-1">{node.shortName}</div>
                      <div className="flex gap-3 text-gray-600">
                        {node.batteryLevel !== undefined && (
                          <span className={node.batteryLevel > 50 ? "text-green-600" : "text-red-600"}>
                            🔋 {node.batteryLevel}%
                          </span>
                        )}
                        {node.snr !== undefined && (
                          <span>📶 {node.snr.toFixed(1)} dB</span>
                        )}
                        {node.hopsAway !== undefined && (
                          <span>📍 {node.hopsAway} hop{node.hopsAway !== 1 ? "s" : ""}</span>
                        )}
                      </div>
                    </div>
                  </Tooltip>
                  <Popup>
                    <div className="min-w-[240px] p-2">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-lg">
                          {node.longName || node.shortName || `Node ${node.id}`}
                        </h3>
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${
                            isOnline ? "bg-green-500" : "bg-gray-400"
                          }`}
                        />
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Short Name:</span>
                          <span className="font-mono font-semibold">{node.shortName}</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Role:</span>
                          <span className="capitalize">
                            {(node.role || "unknown").toLowerCase().replace("_", " ")}
                          </span>
                        </div>

                        <div className="border-t border-border pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Position:</span>
                            <span className="text-xs font-mono">
                              {node.position?.latitude.toFixed(5)}°, {node.position?.longitude.toFixed(5)}°
                            </span>
                          </div>
                          {node.position?.altitude && (
                            <div className="flex justify-between mt-1">
                              <span className="text-muted-foreground">Altitude:</span>
                              <span>{node.position.altitude}m</span>
                            </div>
                          )}
                        </div>

                        {(node.batteryLevel !== undefined || node.snr !== undefined || node.rssi !== undefined) && (
                          <div className="border-t border-border pt-2 mt-2">
                            {node.batteryLevel !== undefined && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Battery:</span>
                                <span className={node.batteryLevel > 50 ? "text-green-600" : "text-red-600"}>
                                  {node.batteryLevel}%
                                </span>
                              </div>
                            )}
                            {node.snr !== undefined && (
                              <div className="flex justify-between mt-1">
                                <span className="text-muted-foreground">SNR:</span>
                                <span>{node.snr} dB</span>
                              </div>
                            )}
                            {node.rssi !== undefined && (
                              <div className="flex justify-between mt-1">
                                <span className="text-muted-foreground">RSSI:</span>
                                <span>{node.rssi} dBm</span>
                              </div>
                            )}
                          </div>
                        )}

                        {node.lastHeard && (
                          <div className="border-t border-border pt-2 mt-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Last Heard:</span>
                              <span>{timeAgo(node.lastHeard)}</span>
                            </div>
                          </div>
                        )}

                        {/* Quick Actions */}
                        <div className="border-t border-border pt-3 mt-2 flex gap-2">
                          <Link
                            href={`/nodes/${node.id}`}
                            className="flex-1 px-2 py-1.5 text-xs font-medium text-center rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                          >
                            Details
                          </Link>
                          <Link
                            href={`/messages?to=${node.id}`}
                            className="flex-1 px-2 py-1.5 text-xs font-medium text-center rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                          >
                            Message
                          </Link>
                          <Link
                            href={`/traceroutes?target=${node.id}`}
                            className="flex-1 px-2 py-1.5 text-xs font-medium text-center rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                          >
                            Trace
                          </Link>
                        </div>
                      </div>
                    </div>
                    {showNodeLabels && (
                      <div className="text-xs font-semibold text-center mt-2 pt-2 border-t border-border">
                        {node.shortName}
                      </div>
                    )}
                  </Popup>
                </Marker>
              );
            })}
          </MarkerClusterGroup>
        ) : (
          <>
            {nodesWithPosition.map((node) => {
              const isOnline = node.lastHeard && Date.now() - node.lastHeard < 3600000;

              return (
                <Marker
                  key={node.id}
                  position={[node.position!.latitude, node.position!.longitude]}
                  icon={createCustomIcon(node.role || "CLIENT", isOnline || false)}
                >
                  <Tooltip direction="top" offset={[0, -20]} opacity={0.95}>
                    <div className="text-xs font-sans">
                      <div className="font-bold text-sm mb-1">{node.shortName}</div>
                      <div className="flex gap-3 text-gray-600">
                        {node.batteryLevel !== undefined && (
                          <span className={node.batteryLevel > 50 ? "text-green-600" : "text-red-600"}>
                            🔋 {node.batteryLevel}%
                          </span>
                        )}
                        {node.snr !== undefined && (
                          <span>📶 {node.snr.toFixed(1)} dB</span>
                        )}
                        {node.hopsAway !== undefined && (
                          <span>📍 {node.hopsAway} hop{node.hopsAway !== 1 ? "s" : ""}</span>
                        )}
                      </div>
                    </div>
                  </Tooltip>
                  <Popup>
                    <div className="min-w-[240px] p-2">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-lg">
                          {node.longName || node.shortName || `Node ${node.id}`}
                        </h3>
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${
                            isOnline ? "bg-green-500" : "bg-gray-400"
                          }`}
                        />
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Short Name:</span>
                          <span className="font-mono font-semibold">{node.shortName}</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Role:</span>
                          <span className="capitalize">
                            {(node.role || "unknown").toLowerCase().replace("_", " ")}
                          </span>
                        </div>

                        <div className="border-t border-border pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Position:</span>
                            <span className="text-xs font-mono">
                              {node.position?.latitude.toFixed(5)}°, {node.position?.longitude.toFixed(5)}°
                            </span>
                          </div>
                          {node.position?.altitude && (
                            <div className="flex justify-between mt-1">
                              <span className="text-muted-foreground">Altitude:</span>
                              <span>{node.position.altitude}m</span>
                            </div>
                          )}
                        </div>

                        {(node.batteryLevel !== undefined || node.snr !== undefined || node.rssi !== undefined) && (
                          <div className="border-t border-border pt-2 mt-2">
                            {node.batteryLevel !== undefined && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Battery:</span>
                                <span className={node.batteryLevel > 50 ? "text-green-600" : "text-red-600"}>
                                  {node.batteryLevel}%
                                </span>
                              </div>
                            )}
                            {node.snr !== undefined && (
                              <div className="flex justify-between mt-1">
                                <span className="text-muted-foreground">SNR:</span>
                                <span>{node.snr} dB</span>
                              </div>
                            )}
                            {node.rssi !== undefined && (
                              <div className="flex justify-between mt-1">
                                <span className="text-muted-foreground">RSSI:</span>
                                <span>{node.rssi} dBm</span>
                              </div>
                            )}
                          </div>
                        )}

                        {node.lastHeard && (
                          <div className="border-t border-border pt-2 mt-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Last Heard:</span>
                              <span>{timeAgo(node.lastHeard)}</span>
                            </div>
                          </div>
                        )}

                        {/* Quick Actions */}
                        <div className="border-t border-border pt-3 mt-2 flex gap-2">
                          <Link
                            href={`/nodes/${node.id}`}
                            className="flex-1 px-2 py-1.5 text-xs font-medium text-center rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                          >
                            Details
                          </Link>
                          <Link
                            href={`/messages?to=${node.id}`}
                            className="flex-1 px-2 py-1.5 text-xs font-medium text-center rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                          >
                            Message
                          </Link>
                          <Link
                            href={`/traceroutes?target=${node.id}`}
                            className="flex-1 px-2 py-1.5 text-xs font-medium text-center rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                          >
                            Trace
                          </Link>
                        </div>
                      </div>
                    </div>
                    {showNodeLabels && (
                      <div className="text-xs font-semibold text-center mt-2 pt-2 border-t border-border">
                        {node.shortName}
                      </div>
                    )}
                  </Popup>
                </Marker>
              );
            })}
          </>
        )}
      </MapContainer>

      {nodesWithPosition.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-background/90 backdrop-blur-sm border border-border rounded-lg p-6 shadow-lg">
            <p className="text-muted-foreground text-center">
              No nodes with GPS coordinates found
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
