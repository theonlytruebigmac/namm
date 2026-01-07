import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { FavoriteRepository } from "@/lib/db/repositories/favorites";

/**
 * GET /api/nodes/favorites
 * Get all favorite node IDs
 */
export async function GET() {
  try {
    const db = getDatabase();
    const favoriteRepo = new FavoriteRepository(db);

    const favorites = favoriteRepo.getAll();

    return NextResponse.json({
      favorites,
      count: favorites.length,
    });
  } catch (error) {
    console.error("API Error - GET /api/nodes/favorites:", error);
    return NextResponse.json(
      { error: "Failed to fetch favorites" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/nodes/favorites
 * Add a node to favorites
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodeId } = body;

    if (!nodeId || typeof nodeId !== "string") {
      return NextResponse.json(
        { error: "Node ID is required" },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const favoriteRepo = new FavoriteRepository(db);

    favoriteRepo.add(nodeId);

    return NextResponse.json({
      success: true,
      nodeId,
      isFavorite: true,
    });
  } catch (error) {
    console.error("API Error - POST /api/nodes/favorites:", error);
    return NextResponse.json(
      { error: "Failed to add favorite" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/nodes/favorites
 * Remove a node from favorites
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const nodeId = searchParams.get("nodeId");

    if (!nodeId) {
      return NextResponse.json(
        { error: "Node ID is required" },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const favoriteRepo = new FavoriteRepository(db);

    favoriteRepo.remove(nodeId);

    return NextResponse.json({
      success: true,
      nodeId,
      isFavorite: false,
    });
  } catch (error) {
    console.error("API Error - DELETE /api/nodes/favorites:", error);
    return NextResponse.json(
      { error: "Failed to remove favorite" },
      { status: 500 }
    );
  }
}
