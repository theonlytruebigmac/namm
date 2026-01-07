"use client";

import { useEffect, useMemo } from "react";
import { Polyline, CircleMarker, Popup, useMap } from "react-leaflet";
import type { NodeTrajectory, TrajectoryConfig } from "@/lib/trajectories";

interface TrajectoryLayerProps {
  trajectories: NodeTrajectory[];
  config: TrajectoryConfig;
}

// Format timestamp for display
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * TrajectoryLayer - Render node movement paths on the map
 */
export function TrajectoryLayer({ trajectories, config }: TrajectoryLayerProps) {
  const map = useMap();

  // Filter visible trajectories with enough points
  const visibleTrajectories = useMemo(() => {
    return trajectories.filter((t) => t.visible && t.points.length >= 2);
  }, [trajectories]);

  if (!config.enabled || visibleTrajectories.length === 0) {
    return null;
  }

  return (
    <>
      {visibleTrajectories.map((trajectory) => {
        const positions = trajectory.points.map((p) => [p.lat, p.lng] as [number, number]);
        const color = trajectory.color || "#3b82f6";

        // Calculate opacity gradient if enabled
        const baseOpacity = config.fadeOlderPoints ? 0.4 : 0.7;
        const headOpacity = 0.9;

        return (
          <div key={trajectory.nodeId}>
            {/* Main trajectory line */}
            <Polyline
              positions={positions}
              pathOptions={{
                color,
                weight: 3,
                opacity: baseOpacity,
                lineCap: "round",
                lineJoin: "round",
              }}
            >
              <Popup>
                <div className="min-w-[180px]">
                  <h4 className="font-semibold mb-2">{trajectory.shortName}</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>{trajectory.points.length} points recorded</p>
                    <p>
                      Started: {formatTime(trajectory.points[0].timestamp)}
                    </p>
                    <p>
                      Latest: {formatTime(trajectory.points[trajectory.points.length - 1].timestamp)}
                    </p>
                  </div>
                </div>
              </Popup>
            </Polyline>

            {/* Animated gradient segments for recent movement */}
            {config.animatePaths && trajectory.points.length >= 2 && (
              <Polyline
                positions={positions.slice(-5)} // Last 5 points
                pathOptions={{
                  color,
                  weight: 4,
                  opacity: headOpacity,
                  lineCap: "round",
                  lineJoin: "round",
                  dashArray: config.animatePaths ? "10, 5" : undefined,
                  className: config.animatePaths ? "animate-dash" : "",
                }}
              />
            )}

            {/* Start point marker */}
            <CircleMarker
              center={positions[0]}
              radius={5}
              pathOptions={{
                color: "#ffffff",
                fillColor: color,
                fillOpacity: 0.8,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <strong>Start</strong>
                  <br />
                  {trajectory.shortName}
                  <br />
                  {formatTime(trajectory.points[0].timestamp)}
                </div>
              </Popup>
            </CircleMarker>

            {/* End point marker (current position) */}
            <CircleMarker
              center={positions[positions.length - 1]}
              radius={7}
              pathOptions={{
                color: "#ffffff",
                fillColor: color,
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <strong>Current</strong>
                  <br />
                  {trajectory.shortName}
                  <br />
                  {formatTime(trajectory.points[trajectory.points.length - 1].timestamp)}
                </div>
              </Popup>
            </CircleMarker>

            {/* Timestamp markers (if enabled) */}
            {config.showTimestamps &&
              trajectory.points
                .filter((_, i) => i > 0 && i < trajectory.points.length - 1 && i % 5 === 0)
                .map((point, idx) => (
                  <CircleMarker
                    key={`ts-${trajectory.nodeId}-${idx}`}
                    center={[point.lat, point.lng]}
                    radius={3}
                    pathOptions={{
                      color: color,
                      fillColor: "#ffffff",
                      fillOpacity: 0.8,
                      weight: 1,
                    }}
                  >
                    <Popup>
                      <div className="text-xs">
                        {formatTime(point.timestamp)}
                        {point.altitude && <br />}
                        {point.altitude && `Alt: ${point.altitude}m`}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
          </div>
        );
      })}

      {/* CSS for animated dash effect */}
      <style jsx global>{`
        .animate-dash {
          animation: dash 1s linear infinite;
        }
        @keyframes dash {
          to {
            stroke-dashoffset: -15;
          }
        }
      `}</style>
    </>
  );
}

export default TrajectoryLayer;
