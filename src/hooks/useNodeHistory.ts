/**
 * useNodeHistory Hook
 * Fetch historical timeline events for a node
 */

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/http";

export type TimelineEventType = "telemetry" | "position" | "message" | "traceroute";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface NodeHistoryResponse {
  success: boolean;
  nodeId: string;
  events: TimelineEvent[];
  summary: {
    totalEvents: number;
    telemetryCount: number;
    positionCount: number;
    messageCount: number;
    tracerouteCount: number;
    since: number;
  };
}

export interface UseNodeHistoryOptions {
  nodeId: string | null;
  since?: number; // Timestamp
  limit?: number;
  type?: TimelineEventType | "all";
  enabled?: boolean;
}

export function useNodeHistory({
  nodeId,
  since,
  limit = 50,
  type = "all",
  enabled = true,
}: UseNodeHistoryOptions) {
  return useQuery({
    queryKey: ["node-history", nodeId, since, limit, type],
    queryFn: async () => {
      if (!nodeId) return null;

      const params = new URLSearchParams();
      if (since) params.append("since", since.toString());
      if (limit) params.append("limit", limit.toString());
      if (type && type !== "all") params.append("type", type);

      const url = `/api/nodes/${encodeURIComponent(nodeId)}/history?${params}`;
      return apiGet<NodeHistoryResponse>(url);
    },
    enabled: enabled && !!nodeId,
    refetchInterval: 30000,
    staleTime: 15000,
  });
}

export default useNodeHistory;
