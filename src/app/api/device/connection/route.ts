import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

/**
 * GET /api/device/connection
 * Get device connection status
 * For MQTT mode, we report as connected when we have recent data
 */
export async function GET() {
  try {
    const db = getDatabase();

    // Check if we have any recent nodes (within last 5 minutes)
    const recentNode = db.prepare(`
      SELECT MAX(last_heard) as last_heard
      FROM nodes
      WHERE last_heard > ?
    `).get(Date.now() - 5 * 60 * 1000) as { last_heard: number | null } | undefined;

    const hasRecentData = recentNode?.last_heard != null;

    return NextResponse.json({
      connected: hasRecentData,
      connectionType: "mqtt",
      lastSeen: recentNode?.last_heard || Date.now(),
      uptimeSeconds: 0, // Not tracked for MQTT mode
    });
  } catch (error) {
    console.error("API Error - GET /api/device/connection:", error);
    return NextResponse.json({
      connected: true, // Assume connected for MQTT mode
      connectionType: "mqtt",
      lastSeen: Date.now(),
      uptimeSeconds: 0,
    });
  }
}
