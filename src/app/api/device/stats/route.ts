import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

/**
 * GET /api/device/stats
 * Get device statistics from database
 */
export async function GET() {
  try {
    const db = getDatabase();

    // Get message counts
    const messageStats = db.prepare(`
      SELECT
        COUNT(*) as total_messages,
        SUM(CASE WHEN timestamp > ? THEN 1 ELSE 0 END) as recent_messages
      FROM messages
    `).get(Date.now() - 24 * 60 * 60 * 1000) as { total_messages: number; recent_messages: number };

    // Get node count
    const nodeStats = db.prepare(`
      SELECT
        COUNT(*) as total_nodes,
        SUM(CASE WHEN last_heard > ? THEN 1 ELSE 0 END) as active_nodes
      FROM nodes
    `).get(Date.now() - 15 * 60 * 1000) as { total_nodes: number; active_nodes: number };

    // Get latest telemetry with channel utilization data (from last hour)
    const telemetryStats = db.prepare(`
      SELECT
        AVG(channel_utilization) as avg_channel_util,
        AVG(air_util_tx) as avg_air_util
      FROM telemetry
      WHERE timestamp > ?
        AND (channel_utilization IS NOT NULL OR air_util_tx IS NOT NULL)
    `).get(Date.now() - 60 * 60 * 1000) as {
      avg_channel_util: number | null;
      avg_air_util: number | null;
    } | undefined;

    // Get max uptime from any telemetry record (separate query for better results)
    const uptimeStats = db.prepare(`
      SELECT MAX(uptime) as max_uptime
      FROM telemetry
      WHERE uptime IS NOT NULL
        AND timestamp > ?
    `).get(Date.now() - 24 * 60 * 60 * 1000) as { max_uptime: number | null } | undefined;

    // Fallback: calculate monitoring uptime from first message/node if no telemetry uptime
    let monitoringUptime = 0;
    if (!uptimeStats?.max_uptime) {
      const firstSeen = db.prepare(`
        SELECT MIN(timestamp) as first_seen FROM (
          SELECT MIN(timestamp) as timestamp FROM messages
          UNION ALL
          SELECT MIN(first_seen) as timestamp FROM nodes
        )
      `).get() as { first_seen: number | null } | undefined;

      if (firstSeen?.first_seen) {
        monitoringUptime = Math.floor((Date.now() - firstSeen.first_seen) / 1000);
      }
    }

    return NextResponse.json({
      messagesReceived: messageStats?.total_messages || 0,
      messagesSent: 0, // We don't track sent messages in MQTT mode
      nodesInMesh: nodeStats?.active_nodes || 0,
      totalNodes: nodeStats?.total_nodes || 0,
      channelUtilization: telemetryStats?.avg_channel_util ?? 0,
      airUtilTx: telemetryStats?.avg_air_util ?? 0,
      uptimeSeconds: uptimeStats?.max_uptime ?? monitoringUptime,
    });
  } catch (error) {
    console.error("API Error - GET /api/device/stats:", error);
    return NextResponse.json({
      messagesReceived: 0,
      messagesSent: 0,
      nodesInMesh: 0,
      channelUtilization: 0,
      airUtilTx: 0,
      uptimeSeconds: 0,
    });
  }
}
