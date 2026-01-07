"use client";

import { useState } from "react";
import { Node } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/nodes/FavoriteButton";
import { NodeHistoryTimeline } from "@/components/nodes/NodeHistoryTimeline";
import { formatTimestamp } from "@/lib/utils";
import {
  X,
  Radio,
  Battery,
  Signal,
  MapPin,
  Activity,
  Clock,
  Users,
  Zap,
  Thermometer,
  HardDrive,
  Cpu,
  ArrowLeft,
} from "lucide-react";

interface NodeDetailSheetProps {
  node: Node | null;
  onClose: () => void;
}

export function NodeDetailSheet({ node, onClose }: NodeDetailSheetProps) {
  const [showHistory, setShowHistory] = useState(false);

  if (!node) return null;

  const isActive = Date.now() - node.lastHeard < 3600000;
  const batteryLevel = node.batteryLevel || 0;
  const batteryVariant = batteryLevel > 50 ? "success" : batteryLevel > 20 ? "secondary" : "destructive";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[hsl(var(--card))] shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold font-mono text-[hsl(var(--primary))]">
              {node.shortName}
            </h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {node.longName}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <FavoriteButton nodeId={node.id} showLabel />
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between p-4 bg-[hsl(var(--muted))] rounded-lg">
            <div className="flex items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full ${
                  isActive ? "bg-[hsl(var(--green))] animate-pulse" : "bg-[hsl(var(--muted-foreground))]"
                }`}
              />
              <div>
                <div className="font-semibold text-[hsl(var(--foreground))]">
                  {isActive ? "Online" : "Offline"}
                </div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  Last heard {formatTimestamp(node.lastHeard)}
                </div>
              </div>
            </div>
            <Badge variant="secondary">
              {node.role.toLowerCase().replace("_", " ")}
            </Badge>
          </div>

          {/* Battery */}
          {node.batteryLevel !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Battery className="h-4 w-4" />
                  Battery Level
                </span>
                <Badge variant={batteryVariant}>
                  {batteryLevel}%
                </Badge>
              </div>
              <div className="h-3 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    batteryLevel > 50
                      ? "bg-[hsl(var(--green))]"
                      : batteryLevel > 20
                      ? "bg-[hsl(var(--yellow))]"
                      : "bg-[hsl(var(--red))]"
                  }`}
                  style={{ width: `${batteryLevel}%` }}
                />
              </div>
            </div>
          )}

          {/* Signal Quality */}
          {node.snr !== undefined && (
            <div className="p-4 bg-[hsl(var(--muted))] rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Signal className="h-4 w-4" />
                  Signal Quality
                </span>
                <span className="text-lg font-bold text-[hsl(var(--blue))]">
                  {node.snr.toFixed(1)} dB
                </span>
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                Signal-to-Noise Ratio
              </div>
            </div>
          )}

          {/* Network Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-[hsl(var(--muted))] rounded-lg text-center">
              <Radio className="h-5 w-5 mx-auto mb-2 text-[hsl(var(--primary))]" />
              <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Hops Away</div>
              <div className="text-xl font-bold">{node.hopsAway || 0}</div>
            </div>
            <div className="p-4 bg-[hsl(var(--muted))] rounded-lg text-center">
              <Users className="h-5 w-5 mx-auto mb-2 text-[hsl(var(--green))]" />
              <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Neighbors</div>
              <div className="text-xl font-bold">{node.neighborCount || 0}</div>
            </div>
          </div>

          {/* Position */}
          {node.position && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="h-4 w-4" />
                Location
              </div>
              <div className="p-4 bg-[hsl(var(--muted))] rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">Latitude</span>
                  <span className="font-mono">{node.position.latitude.toFixed(6)}°</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">Longitude</span>
                  <span className="font-mono">{node.position.longitude.toFixed(6)}°</span>
                </div>
                {node.position.altitude && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[hsl(var(--muted-foreground))]">Altitude</span>
                    <span className="font-mono">{node.position.altitude}m</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Environmental Data (Mock) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4" />
              Telemetry
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-[hsl(var(--muted))] rounded-lg text-center">
                <Thermometer className="h-4 w-4 mx-auto mb-1 text-[hsl(var(--muted-foreground))]" />
                <div className="text-xs text-[hsl(var(--muted-foreground))]">Temp</div>
                <div className="text-sm font-bold">
                  {(20 + Math.random() * 10).toFixed(1)}°C
                </div>
              </div>
              <div className="p-3 bg-[hsl(var(--muted))] rounded-lg text-center">
                <HardDrive className="h-4 w-4 mx-auto mb-1 text-[hsl(var(--muted-foreground))]" />
                <div className="text-xs text-[hsl(var(--muted-foreground))]">Storage</div>
                <div className="text-sm font-bold">
                  {Math.round(50 + Math.random() * 40)}%
                </div>
              </div>
              <div className="p-3 bg-[hsl(var(--muted))] rounded-lg text-center">
                <Cpu className="h-4 w-4 mx-auto mb-1 text-[hsl(var(--muted-foreground))]" />
                <div className="text-xs text-[hsl(var(--muted-foreground))]">CPU</div>
                <div className="text-sm font-bold">
                  {Math.round(10 + Math.random() * 30)}%
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-4 border-t border-[hsl(var(--border))]">
            <Button className="w-full" variant="default">
              <MapPin className="h-4 w-4 mr-2" />
              View on Map
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => setShowHistory(true)}
            >
              <Activity className="h-4 w-4 mr-2" />
              View Activity History
            </Button>
          </div>
        </div>

        {/* History Overlay */}
        {showHistory && (
          <div className="absolute inset-0 bg-[hsl(var(--card))] flex flex-col">
            <div className="p-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-semibold">Activity History</h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <NodeHistoryTimeline
                nodeId={node.id}
                nodeName={node.shortName}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
