import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getNodes, getNode, getActiveNodes, setNodeFavorite } from "@/lib/api";
import { useVirtualNodes } from "./useVirtualNodes";
import { useMemo } from "react";
import type { Node } from "@/types/node";
import type { VirtualNode } from "@/lib/virtual-nodes";

/**
 * Convert a virtual node to the Node interface
 */
function virtualNodeToNode(vnode: VirtualNode): Node {
  return {
    id: vnode.id,
    nodeNum: vnode.nodeNum,
    shortName: vnode.shortName,
    longName: vnode.longName,
    hwModel: "VIRTUAL",
    role: vnode.role,
    batteryLevel: vnode.batteryLevel,
    voltage: vnode.voltage,
    snr: vnode.snr,
    lastHeard: vnode.lastHeard,
    position: vnode.position,
    channelUtilization: vnode.channelUtilization,
    airUtilTx: vnode.airUtilTx,
    isMobile: vnode.movementPattern !== "static",
    // @ts-expect-error - Mark as virtual for UI indicators
    isVirtual: true,
  };
}

export function useNodes() {
  const nodesQuery = useQuery({
    queryKey: ["nodes"],
    queryFn: getNodes,
    refetchInterval: 30000, // Poll every 30s
  });

  const { nodes: virtualNodes, enabled: virtualEnabled } = useVirtualNodes();

  // Merge real nodes with virtual nodes
  const mergedData = useMemo(() => {
    const realNodes = nodesQuery.data || [];
    if (!virtualEnabled || virtualNodes.length === 0) {
      return realNodes;
    }
    const convertedVirtual = virtualNodes.map(virtualNodeToNode);
    return [...realNodes, ...convertedVirtual];
  }, [nodesQuery.data, virtualNodes, virtualEnabled]);

  return {
    ...nodesQuery,
    data: mergedData,
  };
}

export function useNode(id: string | null) {
  const { nodes: virtualNodes, enabled: virtualEnabled } = useVirtualNodes();

  const nodeQuery = useQuery({
    queryKey: ["nodes", id],
    queryFn: () => (id ? getNode(id) : null),
    enabled: !!id,
  });

  // Check if requested node is a virtual node
  const data = useMemo(() => {
    if (nodeQuery.data) return nodeQuery.data;
    if (!virtualEnabled || !id) return null;

    const virtualNode = virtualNodes.find((vn) => vn.id === id);
    return virtualNode ? virtualNodeToNode(virtualNode) : null;
  }, [nodeQuery.data, virtualNodes, virtualEnabled, id]);

  return {
    ...nodeQuery,
    data,
  };
}

export function useActiveNodes(hours: number = 24) {
  const activeQuery = useQuery({
    queryKey: ["nodes", "active", hours],
    queryFn: () => getActiveNodes(hours),
    refetchInterval: 30000,
  });

  const { nodes: virtualNodes, enabled: virtualEnabled } = useVirtualNodes();

  // Merge active real nodes with virtual nodes (virtual nodes are always "active")
  const mergedData = useMemo(() => {
    const realNodes = activeQuery.data || [];
    if (!virtualEnabled || virtualNodes.length === 0) {
      return realNodes;
    }
    const convertedVirtual = virtualNodes.map(virtualNodeToNode);
    return [...realNodes, ...convertedVirtual];
  }, [activeQuery.data, virtualNodes, virtualEnabled]);

  return {
    ...activeQuery,
    data: mergedData,
  };
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      setNodeFavorite(id, isFavorite),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nodes"] });
    },
  });
}
