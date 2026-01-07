"use client";

import { useNodes } from "@/hooks/useNodes";
import { useSettings } from "@/hooks/useSettings";
import { useFavorites } from "@/hooks/useFavorites";
import { useNodeAliases } from "@/hooks/useNodeAliases";
import { useNodeGroups } from "@/hooks/useNodeGroups";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FavoriteButton } from "@/components/nodes/FavoriteButton";
import { AddToGroupMenu, NodeGroupBadge, CreateGroupDialog } from "@/components/nodes/NodeGroups";
import { QuickNodeActions } from "@/components/nodes/QuickNodeActions";
import { BatchNodeActions, NodeSelectCheckbox } from "@/components/nodes/BatchNodeActions";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Node } from "@/types";
import { formatTimestamp } from "@/lib/utils";
import Link from "next/link";
import {
  Radio,
  Battery,
  Signal,
  MapPin,
  Activity,
  Clock,
  Filter,
  Search,
  X,
  Download,
  Star,
  ExternalLink,
  Folder,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { exportNodesToCSV, exportToJSON } from "@/lib/export";

export default function NodesPage() {
  const { data: nodes, isLoading } = useNodes();
  const settings = useSettings();
  const { isFavorite, favoritesSet } = useFavorites();
  const { getDisplayName, getAlias } = useNodeAliases();
  const { groups, getNodeGroups } = useNodeGroups();
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterFavorites, setFilterFavorites] = useState<boolean>(false);
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());

  const toggleNodeSelection = useCallback((nodeId: string) => {
    setSelectedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-32 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const roles = ["all", ...new Set(nodes?.map(n => n.role) || [])];

  // Advanced filtering with search
  const filteredNodes = useMemo(() => {
    let filtered = nodes || [];

    // Role filter
    if (filterRole !== "all") {
      filtered = filtered.filter(n => n.role === filterRole);
    }

    // Status filter
    if (filterStatus === "online") {
      filtered = filtered.filter(n => Date.now() - n.lastHeard < 3600000);
    } else if (filterStatus === "offline") {
      filtered = filtered.filter(n => Date.now() - n.lastHeard >= 3600000);
    }

    // Favorites filter
    if (filterFavorites) {
      filtered = filtered.filter(n => favoritesSet.has(n.id));
    }

    // Group filter
    if (filterGroup !== "all") {
      const group = groups.find(g => g.id === filterGroup);
      if (group) {
        filtered = filtered.filter(n => group.nodeIds.includes(n.id));
      }
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(n =>
        n.shortName?.toLowerCase().includes(query) ||
        n.longName?.toLowerCase().includes(query) ||
        n.id.toLowerCase().includes(query)
      );
    }

    // Sort favorites first
    filtered = [...filtered].sort((a, b) => {
      const aFav = favoritesSet.has(a.id) ? 1 : 0;
      const bFav = favoritesSet.has(b.id) ? 1 : 0;
      return bFav - aFav;
    });

    return filtered;
  }, [nodes, filterRole, filterStatus, filterFavorites, filterGroup, groups, favoritesSet, searchQuery]);

  const clearFilters = useCallback(() => {
    setFilterRole("all");
    setFilterStatus("all");
    setFilterFavorites(false);
    setFilterGroup("all");
    setSearchQuery("");
  }, []);

  const hasActiveFilters = filterRole !== "all" || filterStatus !== "all" || filterFavorites || filterGroup !== "all" || searchQuery !== "";

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">
              Nodes
            </h1>
            <p className="text-[hsl(var(--muted-foreground))]">
              {filteredNodes?.length || 0} nodes in the mesh network
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => exportNodesToCSV(filteredNodes || [])}
            disabled={!filteredNodes || filteredNodes.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => exportToJSON(filteredNodes, `nodes_${new Date().toISOString().split("T")[0]}`)}
            disabled={!filteredNodes || filteredNodes.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search nodes by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Role Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Role</label>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <Button
                  key={role}
                  variant={filterRole === role ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterRole(role)}
              >
                {role === "all" ? "All Nodes" : role.toLowerCase().replace("_", " ")}
              </Button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Status</label>
          <div className="flex gap-2">
            <Button
              variant={filterStatus === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("all")}
            >
              All
            </Button>
            <Button
              variant={filterStatus === "online" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("online")}
            >
              Online
            </Button>
            <Button
              variant={filterStatus === "offline" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("offline")}
            >
              Offline
            </Button>
          </div>
        </div>

        {/* Favorites Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Favorites</label>
          <div className="flex gap-2">
            <Button
              variant={filterFavorites ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterFavorites(!filterFavorites)}
              className={filterFavorites ? "text-yellow-500" : ""}
            >
              <Star className={`h-4 w-4 mr-1 ${filterFavorites ? "fill-current" : ""}`} />
              Favorites Only
            </Button>
          </div>
        </div>

        {/* Groups Filter */}
        {groups.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Folder className="h-4 w-4" />
              Groups
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filterGroup === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterGroup("all")}
              >
                All Groups
              </Button>
              {groups.map((group) => (
                <Button
                  key={group.id}
                  variant={filterGroup === group.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterGroup(group.id)}
                  style={filterGroup === group.id ? { backgroundColor: group.color } : {}}
                >
                  <span
                    className="w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: group.color }}
                  />
                  {group.name} ({group.nodeIds.length})
                </Button>
              ))}
              <CreateGroupDialog />
            </div>
          </div>
        )}
      </CardContent>
    </Card>

      {/* Batch Actions */}
      <BatchNodeActions
        nodes={filteredNodes || []}
        selectedIds={selectedNodes}
        onSelectionChange={setSelectedNodes}
      />

      {/* Nodes Grid */}
      <div className={`grid gap-4 ${settings.compactMode ? 'md:grid-cols-3 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
        {filteredNodes?.map((node) => {
          const isActive = Date.now() - node.lastHeard < 3600000;
          const batteryLevel = node.batteryLevel || 0;
          const batteryVariant = batteryLevel > 50 ? "success" : batteryLevel > 20 ? "secondary" : "destructive";

          return (
            <Card key={node.id} className="hover:border-[hsl(var(--primary))] transition-colors">
              <CardHeader className={settings.compactMode ? 'py-3' : ''}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <NodeSelectCheckbox
                      nodeId={node.id}
                      selected={selectedNodes.has(node.id)}
                      onToggle={toggleNodeSelection}
                    />
                    <div>
                      <CardTitle className={`font-mono text-[hsl(var(--primary))] ${settings.compactMode ? 'text-base' : 'text-lg'}`}>
                        {getDisplayName(node.id, node.shortName)}
                        {getAlias(node.id) && (
                          <span className="ml-2 text-xs text-muted-foreground font-normal">
                            ({node.shortName})
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className={settings.compactMode ? 'mt-0.5 text-xs' : 'mt-1'}>
                        {node.longName}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <FavoriteButton nodeId={node.id} size="sm" />
                    <QuickNodeActions node={node} />
                    <div
                      className={`h-3 w-3 rounded-full ${
                        isActive ? "bg-[hsl(var(--green))] animate-pulse" : "bg-[hsl(var(--muted))]"
                      }`}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className={`${settings.compactMode ? 'space-y-2 py-3' : 'space-y-4'}`}>
                {/* Role */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">Role</span>
                  <Badge variant="secondary">
                    {node.role.toLowerCase().replace("_", " ")}
                  </Badge>
                </div>

                {/* Battery */}
                {node.batteryLevel !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                      <Battery className="h-4 w-4" />
                      Battery
                    </span>
                    <Badge variant={batteryVariant}>
                      {batteryLevel}%
                    </Badge>
                  </div>
                )}

                {/* SNR */}
                {node.snr !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                      <Signal className="h-4 w-4" />
                      Signal
                    </span>
                    <span className="text-sm font-medium">
                      {node.snr.toFixed(1)} dB
                    </span>
                  </div>
                )}

                {/* Last Heard */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Last Heard
                  </span>
                  <span className="text-sm font-medium">
                    {formatTimestamp(node.lastHeard)}
                  </span>
                </div>

                {/* Position */}
                {node.position && (
                  <div className="pt-2 border-t border-[hsl(var(--border))]">
                    <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                      <MapPin className="h-3 w-3" />
                      <span>
                        {node.position.latitude.toFixed(4)}°, {node.position.longitude.toFixed(4)}°
                      </span>
                      {node.position.altitude && (
                        <span className="ml-auto">
                          {node.position.altitude}m
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[hsl(var(--border))]">
                  {node.hopsAway !== undefined && (
                    <div className="text-center p-2 bg-[hsl(var(--muted))] rounded">
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">Hops</div>
                      <div className="text-lg font-bold text-[hsl(var(--primary))]">
                        {node.hopsAway}
                      </div>
                    </div>
                  )}
                  {node.neighborCount !== undefined && (
                    <div className="text-center p-2 bg-[hsl(var(--muted))] rounded">
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">Neighbors</div>
                      <div className="text-lg font-bold text-[hsl(var(--green))]">
                        {node.neighborCount}
                      </div>
                    </div>
                  )}
                </div>

                {/* Node Groups */}
                {getNodeGroups(node.id).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {getNodeGroups(node.id).map((group) => (
                      <NodeGroupBadge key={group.id} group={group} size="sm" />
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 mt-2 pt-2 border-t border-[hsl(var(--border))]">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    asChild
                  >
                    <Link href={`/nodes/${node.id}`} className="flex items-center justify-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      <span>View Details</span>
                    </Link>
                  </Button>
                  <AddToGroupMenu nodeId={node.id} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
    </>
  );
}
