import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { FavoriteRepository } from "@/lib/db/repositories/favorites";

/**
 * POST /api/nodes/[id]/favorite
 * Toggle favorite status for a node
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: nodeId } = await params;

    if (!nodeId) {
      return NextResponse.json(
        { error: "Node ID is required" },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const favoriteRepo = new FavoriteRepository(db);

    const result = favoriteRepo.toggle(nodeId);

    return NextResponse.json({
      success: true,
      nodeId,
      isFavorite: result.isFavorite,
    });
  } catch (error) {
    console.error("API Error - POST /api/nodes/[id]/favorite:", error);
    return NextResponse.json(
      { error: "Failed to toggle favorite" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/nodes/[id]/favorite
 * Check if a node is a favorite
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: nodeId } = await params;

    const db = getDatabase();
    const favoriteRepo = new FavoriteRepository(db);

    const isFavorite = favoriteRepo.isFavorite(nodeId);

    return NextResponse.json({
      nodeId,
      isFavorite,
    });
  } catch (error) {
    console.error("API Error - GET /api/nodes/[id]/favorite:", error);
    return NextResponse.json(
      { error: "Failed to check favorite status" },
      { status: 500 }
    );
  }
}
