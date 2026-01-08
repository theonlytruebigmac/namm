import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getChannelMessages, getDirectMessages, sendMessage, addReaction, markChannelAsRead, searchMessages } from "@/lib/api";
import { useSSEEvent } from "./useSSE";

export function useChannelMessages(channel: number) {
  const queryClient = useQueryClient();

  // Subscribe to real-time message updates via SSE
  useSSEEvent("message.new", (data: { channel?: number } | null) => {
    // Check if message is for this channel
    if (data && data.channel === channel) {
      // Invalidate to refetch with new message
      queryClient.invalidateQueries({ queryKey: ["messages", "channel", channel] });
    }
  });

  return useQuery({
    queryKey: ["messages", "channel", channel],
    queryFn: () => getChannelMessages(channel),
    refetchInterval: 30000, // Reduce polling since we have SSE
    staleTime: 5000,
  });
}

export function useDirectMessages(nodeA: string | null, nodeB: string | null) {
  const queryClient = useQueryClient();

  // Subscribe to real-time message updates via SSE
  useSSEEvent("message.new", (data: { fromId?: string; toId?: string } | null) => {
    // Check if message is between these two nodes
    if (data && nodeA && nodeB) {
      const isRelevant =
        (data.fromId === nodeA && data.toId === nodeB) ||
        (data.fromId === nodeB && data.toId === nodeA);
      if (isRelevant) {
        queryClient.invalidateQueries({ queryKey: ["messages", "dm", nodeA, nodeB] });
      }
    }
  });

  return useQuery({
    queryKey: ["messages", "dm", nodeA, nodeB],
    queryFn: () => (nodeA && nodeB ? getDirectMessages(nodeA, nodeB) : []),
    enabled: !!(nodeA && nodeB),
    refetchInterval: 30000,
    staleTime: 5000,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendMessage,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["messages", "channel", variables.channel]
      });
    },
  });
}

export function useAddReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      addReaction(messageId, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

export function useMarkChannelAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channel: number) => markChannelAsRead(channel),
    onSuccess: (_, channel) => {
      // Invalidate channel messages to update read status
      queryClient.invalidateQueries({ queryKey: ["messages", "channel", channel] });
      // Also invalidate channels to update unread counts
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
  });
}

/**
 * Search messages across all channels
 */
export function useSearchMessages(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return useQuery({
    queryKey: ["messages", "search", debouncedQuery],
    queryFn: () => searchMessages(debouncedQuery),
    enabled: debouncedQuery.length >= 2, // Only search when 2+ chars
    staleTime: 30000,
  });
}
