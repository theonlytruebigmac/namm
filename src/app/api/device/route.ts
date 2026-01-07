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
    // Log only once per minute to reduce log spam
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes("ECONNREFUSED")) {
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
