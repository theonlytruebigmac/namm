import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { NodeRepository, PositionRepository } from "@/lib/db/db";

/**
 * GET /api/nodes
 * Fetch all nodes from the database with their latest positions
 */
export async function GET() {
  try {
    const db = getDatabase();
    const nodeRepo = new NodeRepository(db);
    const positionRepo = new PositionRepository(db);
    const nodes = nodeRepo.getAll();

    // Enrich nodes with their latest position
    const nodesWithPosition = nodes.map(node => {
      const latestPosition = positionRepo.getLatestForNode(node.id);
      if (latestPosition) {
        return {
          ...node,
          position: {
            latitude: latestPosition.latitude,
            longitude: latestPosition.longitude,
            altitude: latestPosition.altitude,
            timestamp: latestPosition.timestamp,
          }
        };
      }
      return node;
    });

    return NextResponse.json({
      success: true,
      data: {
        nodes: nodesWithPosition,
        pagination: {
          page: 1,
          limit: nodesWithPosition.length,
          totalCount: nodesWithPosition.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      }
    });
  } catch (error) {
    console.error("API Error - GET /api/nodes:", error);
    return NextResponse.json(
      { error: "Failed to fetch nodes from database" },
      { status: 500 }
    );
  }
}
