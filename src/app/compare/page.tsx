"use client";

import { useState, useMemo } from "react";
import { useNodes } from "@/hooks/useNodes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTimestamp, formatDistance } from "@/lib/utils";
import { Node, NODE_ROLE_LABELS, HARDWARE_MODEL_LABELS } from "@/types";
import {
  GitCompare,
  Battery,
  Signal,
  MapPin,
  Clock,
  Radio,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Equal,
  Wifi,
  Cpu,
  ArrowLeft,
} from "lucide-react";

interface ComparisonRowProps {
  label: string;
  leftValue: string | number | undefined | null;
  rightValue: string | number | undefined | null;
  unit?: string;
  higherIsBetter?: boolean;
  formatter?: (value: any) => string;
}

function ComparisonRow({
  label,
  leftValue,
  rightValue,
  unit = "",
  higherIsBetter = true,
  formatter = (v) => String(v ?? "N/A"),
}: ComparisonRowProps) {
  const leftFormatted = formatter(leftValue);
  const rightFormatted = formatter(rightValue);

  const getComparison = () => {
    if (leftValue === undefined || rightValue === undefined || leftValue === null || rightValue === null) {
      return "equal";
    }
    const numLeft = typeof leftValue === "number" ? leftValue : parseFloat(String(leftValue));
    const numRight = typeof rightValue === "number" ? rightValue : parseFloat(String(rightValue));
    if (isNaN(numLeft) || isNaN(numRight)) return "equal";
    if (numLeft > numRight) return higherIsBetter ? "left-better" : "right-better";
    if (numRight > numLeft) return higherIsBetter ? "right-better" : "left-better";
    return "equal";
  };

  const comparison = getComparison();

  return (
    <div className="grid grid-cols-7 gap-4 py-3 border-b border-[hsl(var(--border))] last:border-0">
      <div className={`col-span-2 text-right ${comparison === "left-better" ? "text-[hsl(var(--green))] font-medium" : ""}`}>
        {leftFormatted}{unit && leftValue !== undefined && leftValue !== null ? ` ${unit}` : ""}
      </div>
      <div className="col-span-3 text-center">
        <div className="flex items-center justify-center gap-2">
          {comparison === "left-better" && <ArrowLeft className="h-3 w-3 text-[hsl(var(--green))]" />}
          <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{label}</span>
          {comparison === "right-better" && <ArrowRight className="h-3 w-3 text-[hsl(var(--green))]" />}
          {comparison === "equal" && <Equal className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />}
        </div>
      </div>
      <div className={`col-span-2 text-left ${comparison === "right-better" ? "text-[hsl(var(--green))] font-medium" : ""}`}>
        {rightFormatted}{unit && rightValue !== undefined && rightValue !== null ? ` ${unit}` : ""}
      </div>
    </div>
  );
}

export default function ComparePage() {
  const { data: nodes = [], isLoading } = useNodes();
  const [leftNodeId, setLeftNodeId] = useState<string | null>(null);
  const [rightNodeId, setRightNodeId] = useState<string | null>(null);

  const leftNode = useMemo(() => nodes.find((n) => n.id === leftNodeId), [nodes, leftNodeId]);
  const rightNode = useMemo(() => nodes.find((n) => n.id === rightNodeId), [nodes, rightNodeId]);

  // Get available nodes for selection (exclude already selected)
  const availableForLeft = nodes.filter((n) => n.id !== rightNodeId);
  const availableForRight = nodes.filter((n) => n.id !== leftNodeId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const swapNodes = () => {
    setLeftNodeId(rightNodeId);
    setRightNodeId(leftNodeId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">
          Compare Nodes
        </h1>
        <p className="text-[hsl(var(--muted-foreground))]">
          Compare statistics and capabilities between two nodes
        </p>
      </div>

      {/* Node Selectors */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-2 block">
                First Node
              </label>
              <Select value={leftNodeId || ""} onValueChange={setLeftNodeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a node..." />
                </SelectTrigger>
                <SelectContent>
                  {availableForLeft.map((node) => (
                    <SelectItem key={node.id} value={node.id}>
                      <span className="font-mono">{node.shortName}</span>
                      <span className="text-[hsl(var(--muted-foreground))] ml-2">
                        {node.longName}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={swapNodes}
              disabled={!leftNodeId || !rightNodeId}
              className="mt-6"
            >
              <GitCompare className="h-4 w-4" />
            </Button>

            <div className="flex-1">
              <label className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-2 block">
                Second Node
              </label>
              <Select value={rightNodeId || ""} onValueChange={setRightNodeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a node..." />
                </SelectTrigger>
                <SelectContent>
                  {availableForRight.map((node) => (
                    <SelectItem key={node.id} value={node.id}>
                      <span className="font-mono">{node.shortName}</span>
                      <span className="text-[hsl(var(--muted-foreground))] ml-2">
                        {node.longName}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {leftNode && rightNode ? (
        <div className="space-y-6">
          {/* Node Headers */}
          <div className="grid grid-cols-7 gap-4">
            <div className="col-span-2">
              <Card className="border-[hsl(var(--green))]">
                <CardContent className="pt-4 text-center">
                  <div className="font-mono text-xl font-bold text-[hsl(var(--green))]">
                    {leftNode.shortName}
                  </div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">
                    {leftNode.longName}
                  </div>
                  <Badge variant="outline" className="mt-2">
                    {NODE_ROLE_LABELS[leftNode.role] || leftNode.role}
                  </Badge>
                </CardContent>
              </Card>
            </div>
            <div className="col-span-3 flex items-center justify-center">
              <div className="text-center">
                <GitCompare className="h-8 w-8 text-[hsl(var(--muted-foreground))] mx-auto mb-2" />
                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                  Comparison
                </span>
              </div>
            </div>
            <div className="col-span-2">
              <Card className="border-[hsl(var(--blue))]">
                <CardContent className="pt-4 text-center">
                  <div className="font-mono text-xl font-bold text-[hsl(var(--blue))]">
                    {rightNode.shortName}
                  </div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">
                    {rightNode.longName}
                  </div>
                  <Badge variant="outline" className="mt-2">
                    {NODE_ROLE_LABELS[rightNode.role] || rightNode.role}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Stats Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                Signal & Connectivity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ComparisonRow
                label="Signal (SNR)"
                leftValue={leftNode.snr}
                rightValue={rightNode.snr}
                unit="dB"
                higherIsBetter={true}
                formatter={(v) => v?.toFixed(1) ?? "N/A"}
              />
              <ComparisonRow
                label="RSSI"
                leftValue={leftNode.rssi}
                rightValue={rightNode.rssi}
                unit="dBm"
                higherIsBetter={true}
              />
              <ComparisonRow
                label="Hops Away"
                leftValue={leftNode.hopsAway}
                rightValue={rightNode.hopsAway}
                higherIsBetter={false}
              />
              <ComparisonRow
                label="Neighbors"
                leftValue={leftNode.neighborCount}
                rightValue={rightNode.neighborCount}
                higherIsBetter={true}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Battery className="h-5 w-5" />
                Power & Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ComparisonRow
                label="Battery"
                leftValue={leftNode.batteryLevel}
                rightValue={rightNode.batteryLevel}
                unit="%"
                higherIsBetter={true}
              />
              <ComparisonRow
                label="Voltage"
                leftValue={leftNode.voltage}
                rightValue={rightNode.voltage}
                unit="V"
                higherIsBetter={true}
                formatter={(v) => v?.toFixed(2) ?? "N/A"}
              />
              <ComparisonRow
                label="Channel Util"
                leftValue={leftNode.channelUtilization}
                rightValue={rightNode.channelUtilization}
                unit="%"
                higherIsBetter={false}
                formatter={(v) => v?.toFixed(1) ?? "N/A"}
              />
              <ComparisonRow
                label="Air Time TX"
                leftValue={leftNode.airUtilTx}
                rightValue={rightNode.airUtilTx}
                unit="%"
                higherIsBetter={false}
                formatter={(v) => v?.toFixed(1) ?? "N/A"}
              />
              <ComparisonRow
                label="Uptime"
                leftValue={leftNode.uptime}
                rightValue={rightNode.uptime}
                higherIsBetter={true}
                formatter={(v) => v ? `${Math.floor(v / 60)}h ${v % 60}m` : "N/A"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                Hardware & Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-4 py-3 border-b border-[hsl(var(--border))]">
                <div className="col-span-2 text-right">
                  {HARDWARE_MODEL_LABELS[leftNode.hwModel] || leftNode.hwModel}
                </div>
                <div className="col-span-3 text-center text-sm font-medium text-[hsl(var(--muted-foreground))]">
                  Hardware Model
                </div>
                <div className="col-span-2 text-left">
                  {HARDWARE_MODEL_LABELS[rightNode.hwModel] || rightNode.hwModel}
                </div>
              </div>
              <div className="grid grid-cols-7 gap-4 py-3 border-b border-[hsl(var(--border))]">
                <div className="col-span-2 text-right">
                  {NODE_ROLE_LABELS[leftNode.role] || leftNode.role}
                </div>
                <div className="col-span-3 text-center text-sm font-medium text-[hsl(var(--muted-foreground))]">
                  Role
                </div>
                <div className="col-span-2 text-left">
                  {NODE_ROLE_LABELS[rightNode.role] || rightNode.role}
                </div>
              </div>
              <ComparisonRow
                label="Last Heard"
                leftValue={leftNode.lastHeard}
                rightValue={rightNode.lastHeard}
                higherIsBetter={true}
                formatter={(v) => v ? formatTimestamp(v) : "N/A"}
              />
              <div className="grid grid-cols-7 gap-4 py-3">
                <div className="col-span-2 text-right">
                  {leftNode.position
                    ? `${leftNode.position.latitude.toFixed(4)}°, ${leftNode.position.longitude.toFixed(4)}°`
                    : "No GPS"
                  }
                </div>
                <div className="col-span-3 text-center text-sm font-medium text-[hsl(var(--muted-foreground))]">
                  Position
                </div>
                <div className="col-span-2 text-left">
                  {rightNode.position
                    ? `${rightNode.position.latitude.toFixed(4)}°, ${rightNode.position.longitude.toFixed(4)}°`
                    : "No GPS"
                  }
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState
          icon={GitCompare}
          title="Select Two Nodes"
          description="Choose two nodes above to compare their statistics and capabilities"
        />
      )}
    </div>
  );
}
