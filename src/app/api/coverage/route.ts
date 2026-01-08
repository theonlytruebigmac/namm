/**
 * Coverage Analysis API
 *
 * Returns enhanced coverage estimation including:
 * - Environment detection (urban/suburban/rural)
 * - LoRa range estimates
 * - Network connectivity from traceroutes
 * - Overlapping coverage analysis
 */

import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { NodeRepository } from "@/lib/db/repositories/nodes";
import { PositionRepository } from "@/lib/db/repositories/positions";
import { TracerouteRepository } from "@/lib/db/repositories/traceroutes";
import { MessageRepository } from "@/lib/db/repositories/messages";
import {
  estimateEnhancedCoverage,
  buildConnectivityGraph,
  type TracerouteData,
  type MessageRoutingData,
} from "@/lib/lora-coverage";
import type { Node } from "@/types/node";

export async function GET() {
  try {
    const db = getDatabase();
    const nodeRepo = new NodeRepository(db);
    const positionRepo = new PositionRepository(db);
    const tracerouteRepo = new TracerouteRepository(db);
    const messageRepo = new MessageRepository(db);

    // Get all nodes with their positions
    const dbNodes = nodeRepo.getAll();
    const nodes: Node[] = dbNodes.map((n) => {
      const latestPosition = positionRepo.getLatestForNode(n.id);
      return {
        id: n.id,
        nodeNum: n.node_num,
        shortName: n.short_name,
        longName: n.long_name,
        hwModel: n.hw_model as Node["hwModel"],
        role: n.role as unknown as Node["role"],
        batteryLevel: n.battery_level ?? undefined,
        voltage: n.voltage ?? undefined,
        snr: n.snr ?? undefined,
        rssi: n.rssi ?? undefined,
        lastHeard: n.last_heard,
        position: latestPosition
          ? {
              latitude: latestPosition.latitude,
              longitude: latestPosition.longitude,
              altitude: latestPosition.altitude ?? undefined,
            }
          : undefined,
        hopsAway: n.hops_away ?? undefined,
      };
    });

    // Get recent traceroutes (last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const traceroutes = tracerouteRepo.getAll({ since: thirtyDaysAgo }, 500);
    const tracerouteData: TracerouteData[] = traceroutes.map((t) => ({
      fromId: t.fromId,
      toId: t.toId,
      route: t.route,
      snrTowards: t.snrTowards,
      snrBack: t.snrBack,
      timestamp: t.timestamp,
      success: t.success,
    }));

    // Get recent messages (last 7 days) for routing data
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const messages = messageRepo.getByTimeRange(sevenDaysAgo, Date.now());
    const messageData: MessageRoutingData[] = messages.slice(0, 1000).map((m) => ({
      fromNode: m.from_id,
      toNode: m.to_id,
      hopsAway: m.hops_away ?? undefined,
      snr: m.snr ?? undefined,
      rssi: m.rssi ?? undefined,
      timestamp: m.timestamp,
    }));

    // Calculate enhanced coverage
    const coverage = estimateEnhancedCoverage(nodes, tracerouteData, messageData);

    // Build detailed connectivity graph
    const graph = buildConnectivityGraph(nodes, tracerouteData, messageData);

    // Prepare graph data for response (convert Maps to objects)
    const nodeConnectionsObj: Record<string, string[]> = {};
    for (const [nodeId, connections] of graph.nodeConnections.entries()) {
      nodeConnectionsObj[nodeId] = connections;
    }

    return NextResponse.json({
      coverage,
      graph: {
        links: graph.links,
        nodeConnections: nodeConnectionsObj,
        hubNodes: graph.hubNodes,
        bridgeNodes: graph.bridgeNodes,
        isolatedNodes: graph.isolatedNodes,
        overlappingPairs: graph.overlappingPairs.slice(0, 50), // Limit for response size
      },
      meta: {
        nodesAnalyzed: nodes.length,
        nodesWithPosition: nodes.filter((n) => n.position).length,
        traceroutesAnalyzed: traceroutes.length,
        messagesAnalyzed: messages.length,
        generatedAt: Date.now(),
      },
    });
  } catch (error) {
    console.error("Coverage analysis error:", error);
    return NextResponse.json(
      { error: "Failed to calculate coverage" },
      { status: 500 }
    );
  }
}
