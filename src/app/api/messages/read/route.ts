import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { MessageRepository } from "@/lib/db/repositories/messages";

/**
 * PUT /api/messages/read
 * Mark messages as read - supports single, multiple, or by channel
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageIds, channel } = body;

    const db = getDatabase();
    const messageRepo = new MessageRepository(db);

    // Mark by channel
    if (channel !== undefined) {
      const channelNum = parseInt(channel);
      if (isNaN(channelNum)) {
        return NextResponse.json({ error: "Invalid channel number" }, { status: 400 });
      }

      const result = messageRepo.markChannelAsRead(channelNum);

      return NextResponse.json({
        success: true,
        message: `Marked ${result.changes} messages as read in channel ${channelNum}`,
        channel: channelNum,
        count: result.changes,
        readAt: Date.now(),
      });
    }

    // Mark by message IDs
    if (messageIds && Array.isArray(messageIds)) {
      const ids = messageIds.map((id) => parseInt(id)).filter((id) => !isNaN(id));

      if (ids.length === 0) {
        return NextResponse.json({ error: "No valid message IDs provided" }, { status: 400 });
      }

      messageRepo.markManyAsRead(ids);

      return NextResponse.json({
        success: true,
        message: `Marked ${ids.length} messages as read`,
        messageIds: ids,
        count: ids.length,
        readAt: Date.now(),
      });
    }

    return NextResponse.json(
      { error: "Either messageIds or channel is required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("API Error - PUT /api/messages/read:", error);
    return NextResponse.json({ error: "Failed to mark messages as read" }, { status: 500 });
  }
}

/**
 * GET /api/messages/read
 * Get unread message counts
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const channel = searchParams.get("channel");

    const db = getDatabase();
    const messageRepo = new MessageRepository(db);

    if (channel !== null) {
      const channelNum = parseInt(channel);
      if (isNaN(channelNum)) {
        return NextResponse.json({ error: "Invalid channel number" }, { status: 400 });
      }

      const count = messageRepo.getUnreadCount(channelNum);
      return NextResponse.json({
        channel: channelNum,
        unreadCount: count,
      });
    }

    // Get unread count per channel
    const byChannel = messageRepo.getUnreadCountByChannel();
    const total = byChannel.reduce((sum, c) => sum + c.count, 0);

    return NextResponse.json({
      total,
      byChannel,
    });
  } catch (error) {
    console.error("API Error - GET /api/messages/read:", error);
    return NextResponse.json({ error: "Failed to get unread counts" }, { status: 500 });
  }
}
