"use client";

import { useQuery } from "@tanstack/react-query";
import { getDeviceConnection, getDeviceInfo } from "@/lib/api/device";
import type { DeviceConnection } from "@/lib/api/device";

interface DeviceConnectionInfo {
  connected: boolean;
  connectionType?: "http" | "bluetooth" | "serial";
  device?: {
    myNodeNum: number;
    nodeId: string;
    longName: string;
    shortName: string;
  };
  error?: string;
}

export function useDeviceConnection() {
  return useQuery<DeviceConnectionInfo>({
    queryKey: ["device", "connection"],
    queryFn: async () => {
      const connection = await getDeviceConnection();

      if (!connection) {
        return { connected: false, error: "Failed to get connection status" };
      }

      if (!connection.connected) {
        return {
          connected: false,
          connectionType: connection.type || undefined,
          error: "Device not connected"
        };
      }

      // Get additional device info if connected
      const deviceInfo = await getDeviceInfo();

      return {
        connected: true,
        connectionType: connection.type || undefined,
        device: deviceInfo ? {
          myNodeNum: deviceInfo.myNodeNum,
          nodeId: deviceInfo.nodeId,
          longName: deviceInfo.longName,
          shortName: deviceInfo.shortName,
        } : undefined,
      };
    },
    refetchInterval: 10000, // Check every 10s
    retry: false,
  });
}
