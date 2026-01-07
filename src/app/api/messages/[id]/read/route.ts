import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { MessageRepository } from "@/lib/db/repositories/messages";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * PUT /api/messages/[id]/read
 * Mark a message as read
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const messageId = parseInt(id);

    if (isNaN(messageId)) {
      return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });
    }

    const db = getDatabase();
    const messageRepo = new MessageRepository(db);

    const result = messageRepo.markAsRead(messageId);

    if (result.changes === 0) {
      // Message either doesn't exist or was already read
      return NextResponse.json({
        success: true,
        message: "Message already marked as read or not found",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Message marked as read",
      messageId,
      readAt: Date.now(),
    });
  } catch (error) {
    console.error("API Error - PUT /api/messages/[id]/read:", error);
    return NextResponse.json(
      { error: "Failed to mark message as read" },
      { status: 500 }
    );
  }
}
