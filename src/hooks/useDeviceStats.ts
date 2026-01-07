"use client";

import { useQuery } from "@tanstack/react-query";
import { getDeviceStats, getDeviceInfo } from "@/lib/api/device";

/**
 * Hook to fetch and cache device statistics
 */
export function useDeviceStats() {
  return useQuery({
    queryKey: ["device", "stats"],
    queryFn: getDeviceStats,
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 2,
  });
}

/**
 * Hook to get device info (basic information)
 */
export function useDeviceInfo() {
  return useQuery({
    queryKey: ["device", "info"],
    queryFn: getDeviceInfo,
    staleTime: 60000, // Data is fresh for 1 minute
    retry: 2,
  });
}
