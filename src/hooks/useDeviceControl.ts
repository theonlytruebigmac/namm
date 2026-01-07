"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateDeviceSettings,
  rebootDevice,
  shutdownDevice,
} from "@/lib/api/device";

/**
 * Hook for device control operations (reboot, shutdown, settings updates)
 */
export function useDeviceControl() {
  const queryClient = useQueryClient();

  const updateSettings = useMutation({
    mutationFn: updateDeviceSettings,
    onSuccess: () => {
      // Invalidate device queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ["device"] });
    },
  });

  const reboot = useMutation({
    mutationFn: rebootDevice,
    onSuccess: () => {
      // Invalidate device queries after reboot
      queryClient.invalidateQueries({ queryKey: ["device"] });
    },
  });

  const shutdown = useMutation({
    mutationFn: shutdownDevice,
    onSuccess: () => {
      // Clear device queries as device is shutting down
      queryClient.invalidateQueries({ queryKey: ["device"] });
    },
  });

  return {
    updateSettings,
    reboot,
    shutdown,
  };
}
