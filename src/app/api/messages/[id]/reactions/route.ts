import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { ReactionRepository } from "@/lib/db/repositories/reactions";

/**
 * POST /api/messages/[id]/reactions
 * Add or toggle a reaction on a message
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messageId = parseInt(id, 10);

    if (isNaN(messageId)) {
      return NextResponse.json(
        { error: "Invalid message ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { emoji, fromNode } = body;

    if (!emoji || typeof emoji !== "string") {
      return NextResponse.json(
        { error: "Emoji is required" },
        { status: 400 }
      );
    }

    // Use provided fromNode or default to local node
    const nodeId = fromNode || "!local";

    const db = getDatabase();
    const reactionRepo = new ReactionRepository(db);

    // Toggle the reaction
    const result = reactionRepo.toggleReaction(messageId, nodeId, emoji);

    // Get updated reactions for this message
    const reactions = reactionRepo.getSummaryForMessage(messageId);

    return NextResponse.json({
      success: true,
      added: result.added,
      reactions,
    });
  } catch (error) {
    console.error("API Error - POST /api/messages/[id]/reactions:", error);
    return NextResponse.json(
      { error: "Failed to add reaction" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/messages/[id]/reactions
 * Get all reactions for a message
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messageId = parseInt(id, 10);

    if (isNaN(messageId)) {
      return NextResponse.json(
        { error: "Invalid message ID" },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const reactionRepo = new ReactionRepository(db);

    const reactions = reactionRepo.getSummaryForMessage(messageId);

    return NextResponse.json({
      reactions,
      count: reactions.reduce((acc, r) => acc + r.count, 0),
    });
  } catch (error) {
    console.error("API Error - GET /api/messages/[id]/reactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch reactions" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/messages/[id]/reactions
 * Remove a reaction from a message
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messageId = parseInt(id, 10);

    if (isNaN(messageId)) {
      return NextResponse.json(
        { error: "Invalid message ID" },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const emoji = searchParams.get("emoji");
    const fromNode = searchParams.get("fromNode") || "!local";

    if (!emoji) {
      return NextResponse.json(
        { error: "Emoji is required" },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const reactionRepo = new ReactionRepository(db);

    reactionRepo.removeReaction(messageId, fromNode, emoji);

    // Get updated reactions
    const reactions = reactionRepo.getSummaryForMessage(messageId);

    return NextResponse.json({
      success: true,
      reactions,
    });
  } catch (error) {
    console.error("API Error - DELETE /api/messages/[id]/reactions:", error);
    return NextResponse.json(
      { error: "Failed to remove reaction" },
      { status: 500 }
    );
  }
}
