"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNodes } from "@/hooks/useNodes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { TracerouteGraph } from "@/components/network/TracerouteGraph";
import { formatTimestamp } from "@/lib/utils";
import { apiGet, apiPost } from "@/lib/api/http";
import {
  Route,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  GitBranch,
  Radio,
  Send,
  Loader2,
  Search,
  MapPin,
  Network,
} from "lucide-react";
import { useState } from "react";

interface Traceroute {
  id: number;
  fromId: string;
  toId: string;
  timestamp: number;
  route: number[];
  routeBack?: number[];
  snrTowards?: number[];
  snrBack?: number[];
  hops: number;
  success: boolean;
  latencyMs?: number;
}

interface TracerouteStats {
  totalTraceroutes: number;
  successfulTraceroutes: number;
  failedTraceroutes: number;
  avgHops: number;
  uniqueRoutes: number;
}

async function getTraceroutes(limit: number = 100): Promise<Traceroute[]> {
  const response = await apiGet<{ traceroutes: Traceroute[] }>(`/api/traceroutes?limit=${limit}`);
  return response.traceroutes || [];
}

async function getTracerouteStats(): Promise<TracerouteStats> {
  const response = await apiPost<TracerouteStats>("/api/traceroutes", { action: "stats" });
  return response;
}

async function sendTracerouteRequest(toNodeId: string, channel: number = 0): Promise<{ success: boolean; packetId?: number }> {
  return apiPost("/api/traceroutes", { action: "send", toNodeId, channel });
}

interface PathResult {
  nodes: string[];
  nodeNums: number[];
  hopCount: number;
  weight: number;
  reliable: boolean;
}

async function findPath(fromId: string, toId: string): Promise<PathResult | null> {
  const response = await apiPost<{ success: boolean; path: PathResult | null; message?: string }>("/api/paths", { fromId, toId });
  return response.path;
}

function useTraceroutes(limit: number = 100) {
  return useQuery({
    queryKey: ["traceroutes", limit],
    queryFn: () => getTraceroutes(limit),
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

function useTracerouteStats() {
  return useQuery({
    queryKey: ["traceroutes", "stats"],
    queryFn: getTracerouteStats,
    refetchInterval: 60000,
    staleTime: 30000,
  });
}

function useSendTraceroute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ toNodeId, channel }: { toNodeId: string; channel?: number }) =>
      sendTracerouteRequest(toNodeId, channel),
    onSuccess: () => {
      // Refetch traceroutes after a delay to allow response time
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["traceroutes"] });
      }, 5000);
    },
  });
}

function useFindPath() {
  return useMutation({
    mutationFn: ({ fromId, toId }: { fromId: string; toId: string }) =>
      findPath(fromId, toId),
  });
}

export default function TraceroutesPage() {
  const { data: traceroutes, isLoading } = useTraceroutes();
  const { data: stats } = useTracerouteStats();
  const { data: nodes } = useNodes();
  const [selectedTraceroute, setSelectedTraceroute] = useState<Traceroute | null>(null);
  const [selectedTargetNode, setSelectedTargetNode] = useState<string>("");
  const sendTraceroute = useSendTraceroute();

  // Path analysis state
  const [pathFromNode, setPathFromNode] = useState<string>("");
  const [pathToNode, setPathToNode] = useState<string>("");
  const [pathResult, setPathResult] = useState<PathResult | null>(null);
  const [pathError, setPathError] = useState<string>("");
  const pathFinder = useFindPath();

  // Filter state
  const [filterNode, setFilterNode] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<"all" | "success" | "failed">("all");

  // Create a map from node num to node info
  const nodeMap = new Map<number, { id: string; shortName: string; longName: string }>();
  nodes?.forEach(node => {
    const nodeNum = parseInt(node.id.replace("!", ""), 16);
    nodeMap.set(nodeNum, {
      id: node.id,
      shortName: node.shortName,
      longName: node.longName,
    });
  });

  // Filter traceroutes
  const filteredTraceroutes = traceroutes?.filter((trace) => {
    // Status filter
    if (filterStatus === "success" && !trace.success) return false;
    if (filterStatus === "failed" && trace.success) return false;

    // Node filter
    if (filterNode) {
      const fromMatch = trace.fromId === filterNode ||
        nodeMap.get(parseInt(trace.fromId.replace("!", ""), 16))?.shortName.toLowerCase().includes(filterNode.toLowerCase());
      const toMatch = trace.toId === filterNode ||
        nodeMap.get(parseInt(trace.toId.replace("!", ""), 16))?.shortName.toLowerCase().includes(filterNode.toLowerCase());
      const inRoute = trace.route.some(nodeNum => {
        const node = nodeMap.get(nodeNum);
        return node?.shortName.toLowerCase().includes(filterNode.toLowerCase()) ||
               node?.id === filterNode;
      });
      if (!fromMatch && !toMatch && !inRoute) return false;
    }

    return true;
  }) || [];

  const getNodeName = (nodeNum: number): string => {
    const node = nodeMap.get(nodeNum);
    return node?.shortName || `!${nodeNum.toString(16).padStart(8, "0")}`;
  };

  const getNodeId = (nodeId: string): string => {
    const node = nodes?.find(n => n.id === nodeId);
    return node?.shortName || nodeId;
  };

  const handleSendTraceroute = () => {
    if (selectedTargetNode) {
      sendTraceroute.mutate({ toNodeId: selectedTargetNode });
    }
  };

  const handleFindPath = () => {
    if (pathFromNode && pathToNode) {
      setPathError("");
      setPathResult(null);
      pathFinder.mutate(
        { fromId: pathFromNode, toId: pathToNode },
        {
          onSuccess: (result) => {
            if (result) {
              setPathResult(result);
            } else {
              setPathError("No path found between the selected nodes");
            }
          },
          onError: () => {
            setPathError("Failed to calculate path");
          },
        }
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!traceroutes || traceroutes.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">
            Traceroutes
          </h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            View mesh network routing paths and connectivity
          </p>
        </div>
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={Route}
              title="No Traceroutes Yet"
              description="Traceroute data will appear here when nodes send traceroute packets through the mesh network."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const successRate = stats
    ? ((stats.successfulTraceroutes / stats.totalTraceroutes) * 100).toFixed(1)
    : "0";

  // Get online nodes for selection
  const onlineNodes = nodes?.filter(n => Date.now() - n.lastHeard < 3600000) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">
            Traceroutes
          </h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            {traceroutes.length} traceroutes recorded · {stats?.uniqueRoutes || 0} unique paths
          </p>
        </div>

        {/* Send Traceroute */}
        <div className="flex items-center gap-2">
          <select
            value={selectedTargetNode}
            onChange={(e) => setSelectedTargetNode(e.target.value)}
            className="h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1 text-sm text-[hsl(var(--foreground))]"
          >
            <option value="">Select target node...</option>
            {onlineNodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.shortName} ({node.id})
              </option>
            ))}
          </select>
          <Button
            onClick={handleSendTraceroute}
            disabled={!selectedTargetNode || sendTraceroute.isPending}
            size="sm"
          >
            {sendTraceroute.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Trace Route
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Traceroutes"
          value={stats?.totalTraceroutes || 0}
          description="All recorded"
          icon={Route}
          color="blue"
        />
        <StatCard
          title="Success Rate"
          value={`${successRate}%`}
          description={`${stats?.successfulTraceroutes || 0} successful`}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Average Hops"
          value={(stats?.avgHops || 0).toFixed(1)}
          description="Per successful route"
          icon={GitBranch}
          color="blue"
        />
        <StatCard
          title="Unique Paths"
          value={stats?.uniqueRoutes || 0}
          description="Distinct routes seen"
          icon={Activity}
        />
      </div>

      {/* Path Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Path Analysis
          </CardTitle>
          <CardDescription>
            Find the optimal path between two nodes using Dijkstra&apos;s algorithm
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-[hsl(var(--muted-foreground))] block mb-2">
                From Node
              </label>
              <select
                value={pathFromNode}
                onChange={(e) => setPathFromNode(e.target.value)}
                className="w-full h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1 text-sm text-[hsl(var(--foreground))]"
              >
                <option value="">Select source...</option>
                {onlineNodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.shortName} ({node.id})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-[hsl(var(--muted-foreground))] block mb-2">
                To Node
              </label>
              <select
                value={pathToNode}
                onChange={(e) => setPathToNode(e.target.value)}
                className="w-full h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1 text-sm text-[hsl(var(--foreground))]"
              >
                <option value="">Select destination...</option>
                {onlineNodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.shortName} ({node.id})
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={handleFindPath}
              disabled={!pathFromNode || !pathToNode || pathFromNode === pathToNode || pathFinder.isPending}
            >
              {pathFinder.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4 mr-2" />
              )}
              Find Path
            </Button>
          </div>

          {/* Path Result */}
          {pathResult && (
            <div className="mt-4 p-4 bg-[hsl(var(--muted))] rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-[hsl(var(--foreground))]">
                  Optimal Path Found
                </h4>
                <div className="flex items-center gap-3">
                  <Badge variant={pathResult.reliable ? "default" : "secondary"}>
                    {pathResult.reliable ? "Reliable" : "Stale Links"}
                  </Badge>
                  <Badge variant="outline">
                    {pathResult.hopCount} hop{pathResult.hopCount !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {pathResult.nodeNums.map((nodeNum, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="px-3 py-1.5 bg-[hsl(var(--card))] rounded-lg border border-[hsl(var(--border))]">
                      <span className="font-mono text-sm text-[hsl(var(--foreground))]">
                        {getNodeName(nodeNum)}
                      </span>
                    </div>
                    {idx < pathResult.nodeNums.length - 1 && (
                      <ArrowRight className="h-3 w-3 text-[hsl(var(--green))]" />
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                Path weight: {pathResult.weight.toFixed(2)} (lower is better)
              </p>
            </div>
          )}

          {/* Path Error */}
          {pathError && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{pathError}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Traceroute List */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Traceroutes</CardTitle>
                <CardDescription>
                  {filterNode || filterStatus !== "all"
                    ? `${filteredTraceroutes.length} of ${traceroutes?.length || 0} traceroutes`
                    : "Click a traceroute to view path details"}
                </CardDescription>
              </div>
            </div>
            {/* Filters */}
            <div className="flex flex-wrap gap-2 mt-4">
              <input
                type="text"
                placeholder="Filter by node..."
                value={filterNode}
                onChange={(e) => setFilterNode(e.target.value)}
                className="h-8 flex-1 min-w-[150px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "all" | "success" | "failed")}
                className="h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-sm text-[hsl(var(--foreground))]"
              >
                <option value="all">All</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
              {(filterNode || filterStatus !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterNode("");
                    setFilterStatus("all");
                  }}
                  className="h-8 px-2"
                >
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredTraceroutes.map((trace) => (
                <button
                  key={trace.id}
                  onClick={() => setSelectedTraceroute(trace)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedTraceroute?.id === trace.id
                      ? "bg-[hsl(var(--accent))] border border-[hsl(var(--green))]"
                      : "bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent))]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {trace.success ? (
                        <CheckCircle className="h-4 w-4 text-[hsl(var(--green))]" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="font-mono text-sm text-[hsl(var(--green))]">
                        {getNodeId(trace.fromId)}
                      </span>
                      <ArrowRight className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                      <span className="font-mono text-sm text-[hsl(var(--mauve))]">
                        {getNodeId(trace.toId)}
                      </span>
                    </div>
                    <Badge variant={trace.success ? "default" : "destructive"}>
                      {trace.hops} hop{trace.hops !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[hsl(var(--muted-foreground))]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(trace.timestamp)}
                    </span>
                    {trace.latencyMs && (
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {trace.latencyMs}ms
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Selected Traceroute Details */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Route Details
            </CardTitle>
            <CardDescription>
              {selectedTraceroute
                ? `Path from ${getNodeId(selectedTraceroute.fromId)} to ${getNodeId(selectedTraceroute.toId)}`
                : "Select a traceroute to view details"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedTraceroute ? (
              <div className="space-y-4">
                {/* Graph visualization */}
                {nodes && nodes.length > 0 && (
                  <div className="h-48 rounded-lg overflow-hidden border border-[hsl(var(--border))]">
                    <TracerouteGraph
                      nodes={nodes}
                      route={selectedTraceroute.route}
                      routeBack={selectedTraceroute.routeBack}
                    />
                  </div>
                )}

                {/* Route visualization */}
                <div className="p-4 bg-[hsl(var(--muted))] rounded-lg">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-[hsl(var(--green))]" />
                    Forward Path
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedTraceroute.route.map((nodeNum, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="px-3 py-1.5 bg-[hsl(var(--card))] rounded-lg border border-[hsl(var(--border))]">
                          <span className="font-mono text-sm text-[hsl(var(--foreground))]">
                            {getNodeName(nodeNum)}
                          </span>
                          {selectedTraceroute.snrTowards?.[idx] !== undefined && (
                            <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
                              {selectedTraceroute.snrTowards[idx]}dB
                            </span>
                          )}
                        </div>
                        {idx < selectedTraceroute.route.length - 1 && (
                          <ArrowRight className="h-3 w-3 text-[hsl(var(--green))]" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Return path if available */}
                {selectedTraceroute.routeBack && selectedTraceroute.routeBack.length > 0 && (
                  <div className="p-4 bg-[hsl(var(--muted))] rounded-lg">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-[hsl(var(--mauve))] rotate-180" />
                      Return Path
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      {(selectedTraceroute.routeBack ?? []).map((nodeNum, idx, arr) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="px-3 py-1.5 bg-[hsl(var(--card))] rounded-lg border border-[hsl(var(--border))]">
                            <span className="font-mono text-sm text-[hsl(var(--foreground))]">
                              {getNodeName(nodeNum)}
                            </span>
                            {selectedTraceroute.snrBack?.[idx] !== undefined && (
                              <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
                                {selectedTraceroute.snrBack[idx]}dB
                              </span>
                            )}
                          </div>
                          {idx < arr.length - 1 && (
                            <ArrowRight className="h-3 w-3 text-[hsl(var(--mauve))]" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-[hsl(var(--muted))] rounded-lg">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Status</div>
                    <div className="flex items-center gap-2">
                      {selectedTraceroute.success ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-[hsl(var(--green))]" />
                          <span className="font-medium text-[hsl(var(--green))]">Success</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-destructive" />
                          <span className="font-medium text-destructive">Failed</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="p-3 bg-[hsl(var(--muted))] rounded-lg">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Hops</div>
                    <div className="font-medium text-[hsl(var(--foreground))]">
                      {selectedTraceroute.hops}
                    </div>
                  </div>
                  <div className="p-3 bg-[hsl(var(--muted))] rounded-lg">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Time</div>
                    <div className="font-medium text-[hsl(var(--foreground))]">
                      {formatTimestamp(selectedTraceroute.timestamp)}
                    </div>
                  </div>
                  {selectedTraceroute.latencyMs && (
                    <div className="p-3 bg-[hsl(var(--muted))] rounded-lg">
                      <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Latency</div>
                      <div className="font-medium text-[hsl(var(--foreground))]">
                        {selectedTraceroute.latencyMs}ms
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-[hsl(var(--muted-foreground))]">
                <Radio className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">Select a traceroute from the list</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
