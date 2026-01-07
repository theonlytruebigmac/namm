import { NextResponse } from "next/server";
import { meshtasticClient } from "@/lib/meshtastic-client";

/**
 * GET /api/device
 * Get information about the connected Meshtastic device
 */
export async function GET() {
  const useRealAPI = process.env.NEXT_PUBLIC_USE_REAL_API === "true";

  // If not using real API, return mock connected status
  if (!useRealAPI) {
    return NextResponse.json({
      connected: true,
      mode: "mock",
      device: {
        myNodeNum: 123456789,
        numOnlineNodes: 25,
        numTotalNodes: 25,
      }
    });
  }

  // Try to connect to real device
  try {
    const deviceInfo = await meshtasticClient.getDeviceInfo();
    const connected = await meshtasticClient.testConnection();

    return NextResponse.json({
      connected,
      mode: "real",
      device: deviceInfo
    });
  } catch (error) {
    // Suppress ECONNREFUSED errors - this is expected when no device connected
    const isConnectionRefused = error instanceof Error &&
      (error.message.includes("ECONNREFUSED") ||
       ('cause' in error && String((error as any).cause).includes("ECONNREFUSED")));

    if (!isConnectionRefused) {
      console.error("API Error - GET /api/device:", error);
    }

    // Return 200 with connected: false instead of 500
    // This allows the app to function without a device
    return NextResponse.json({
      connected: false,
      mode: "real",
      device: null,
      message: "No Meshtastic device connected"
    });
  }
}
