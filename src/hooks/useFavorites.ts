import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

interface FavoritesResponse {
  favorites: string[];
  count: number;
}

interface ToggleFavoriteResponse {
  success: boolean;
  nodeId: string;
  isFavorite: boolean;
}

interface ToggleMutationContext {
  previousFavorites: FavoritesResponse | undefined;
}

/**
 * Hook to manage node favorites
 */
export function useFavorites() {
  const queryClient = useQueryClient();

  // Fetch all favorites
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<FavoritesResponse>({
    queryKey: ["favorites"],
    queryFn: async () => {
      const response = await fetch("/api/nodes/favorites");
      if (!response.ok) {
        throw new Error("Failed to fetch favorites");
      }
      return response.json();
    },
    staleTime: 30000, // 30 seconds
  });

  // Toggle favorite mutation
  const toggleMutation = useMutation<ToggleFavoriteResponse, Error, string, ToggleMutationContext>({
    mutationFn: async (nodeId: string) => {
      const response = await fetch(`/api/nodes/${nodeId}/favorite`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to toggle favorite");
      }
      return response.json();
    },
    onMutate: async (nodeId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["favorites"] });

      // Snapshot the previous value
      const previousFavorites = queryClient.getQueryData<FavoritesResponse>(["favorites"]);

      // Optimistically update
      if (previousFavorites) {
        const isFavorite = previousFavorites.favorites.includes(nodeId);
        queryClient.setQueryData<FavoritesResponse>(["favorites"], {
          favorites: isFavorite
            ? previousFavorites.favorites.filter((id) => id !== nodeId)
            : [...previousFavorites.favorites, nodeId],
          count: isFavorite
            ? previousFavorites.count - 1
            : previousFavorites.count + 1,
        });
      }

      return { previousFavorites };
    },
    onError: (err, nodeId, context) => {
      // Rollback on error
      if (context?.previousFavorites) {
        queryClient.setQueryData(["favorites"], context.previousFavorites);
      }
    },
    onSettled: () => {
      // Refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  // Add favorite mutation
  const addMutation = useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (nodeId: string) => {
      const response = await fetch("/api/nodes/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId }),
      });
      if (!response.ok) {
        throw new Error("Failed to add favorite");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  // Remove favorite mutation
  const removeMutation = useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (nodeId: string) => {
      const response = await fetch(`/api/nodes/favorites?nodeId=${encodeURIComponent(nodeId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to remove favorite");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  // Favorites as a Set for O(1) lookup
  const favoritesSet = useMemo(() => {
    return new Set(data?.favorites ?? []);
  }, [data?.favorites]);

  // Check if a node is a favorite
  const isFavorite = useCallback(
    (nodeId: string) => favoritesSet.has(nodeId),
    [favoritesSet]
  );

  // Toggle favorite (optimistic)
  const toggleFavorite = useCallback(
    (nodeId: string) => {
      toggleMutation.mutate(nodeId);
    },
    [toggleMutation]
  );

  // Add favorite
  const addFavorite = useCallback(
    (nodeId: string) => {
      addMutation.mutate(nodeId);
    },
    [addMutation]
  );

  // Remove favorite
  const removeFavorite = useCallback(
    (nodeId: string) => {
      removeMutation.mutate(nodeId);
    },
    [removeMutation]
  );

  return {
    // Data
    favorites: data?.favorites ?? [],
    favoritesSet,
    count: data?.count ?? 0,

    // State
    isLoading,
    error,
    isToggling: toggleMutation.isPending,

    // Actions
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    refetch,
  };
}

export default useFavorites;
