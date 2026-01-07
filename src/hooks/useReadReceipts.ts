"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut } from "@/lib/api/http";

interface UnreadCountByChannel {
  channel: number;
  count: number;
}

interface UnreadCountsResponse {
  total: number;
  byChannel: UnreadCountByChannel[];
}

interface MarkReadResponse {
  success: boolean;
  message: string;
  count?: number;
  readAt?: number;
}

/**
 * Hook to get unread message counts
 */
export function useUnreadCounts() {
  return useQuery({
    queryKey: ["messages", "unread"],
    queryFn: async (): Promise<UnreadCountsResponse> => {
      return apiGet<UnreadCountsResponse>("/api/messages/read");
    },
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000,
  });
}

/**
 * Hook to get unread count for a specific channel
 */
export function useChannelUnreadCount(channel: number) {
  const { data } = useUnreadCounts();
  const channelData = data?.byChannel.find((c) => c.channel === channel);
  return channelData?.count || 0;
}

/**
 * Hook to mark a single message as read
 */
export function useMarkMessageAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: number): Promise<MarkReadResponse> => {
      return apiPut<MarkReadResponse>(`/api/messages/${messageId}/read`, {});
    },
    onSuccess: () => {
      // Invalidate message and unread queries
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

/**
 * Hook to mark multiple messages as read
 */
export function useMarkMessagesAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageIds: number[]): Promise<MarkReadResponse> => {
      return apiPut<MarkReadResponse>("/api/messages/read", { messageIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

/**
 * Hook to mark all messages in a channel as read
 */
export function useMarkChannelAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channel: number): Promise<MarkReadResponse> => {
      return apiPut<MarkReadResponse>("/api/messages/read", { channel });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}
