import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getChannels, getChannel, markChannelRead } from "@/lib/api";
import { useWebSocketEvent } from "./useWebSocket";

export function useChannels() {
  const queryClient = useQueryClient();

  // Subscribe to message updates to refresh channel message counts
  useWebSocketEvent("message.new", () => {
    queryClient.invalidateQueries({ queryKey: ["channels"] });
  });

  return useQuery({
    queryKey: ["channels"],
    queryFn: getChannels,
    refetchInterval: 30000, // Reduce polling since we have WebSocket
    staleTime: 5000,
  });
}

export function useChannel(index: number | null) {
  return useQuery({
    queryKey: ["channels", index],
    queryFn: () => (index !== null ? getChannel(index) : null),
    enabled: index !== null,
  });
}

export function useMarkChannelRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markChannelRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
  });
}
