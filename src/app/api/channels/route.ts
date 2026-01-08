import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { MessageRepository } from "@/lib/db/repositories/messages";
import { ChannelRepository } from "@/lib/db/repositories/channels";

// Import the channel keys from the keys route
// We use a shared module for this
import { getChannelKeys } from "./keys/store";
import { getChannelMappings, getChannelName } from "@/lib/mqtt-processor";

/**
 * GET /api/channels
 * Return channel list combining:
 * 1. Channels from connected device (with names from config)
 * 2. Channel names learned from MQTT messages (persisted in DB)
 * 3. Synthetic channels from messages in database
 */
export async function GET() {
  try {
    const db = getDatabase();
    const messageRepo = new MessageRepository(db);
    const channelRepo = new ChannelRepository(db);

    // Get unread counts by channel
    const unreadByChannel = messageRepo.getUnreadCountByChannel();
    const unreadMap = new Map(unreadByChannel.map(u => [u.channel, u.count]));

    // Get unique channels from messages
    const channelsQuery = db.prepare(`
      SELECT DISTINCT channel, COUNT(*) as message_count
      FROM messages
      GROUP BY channel
      ORDER BY channel
    `);
    const channelData = channelsQuery.all() as { channel: number; message_count: number }[];

    // Get device-provided channel info (from serial connection)
    const deviceChannels = getChannelKeys();

    // Get channel mappings learned from MQTT messages (includes DB-persisted mappings)
    const mqttChannelMappings = getChannelMappings();

    // Also get directly from database for any that weren't loaded yet
    const dbChannels = channelRepo.getAll();

    // Create channel map
    const channelMap = new Map<number, {
      index: number;
      name: string;
      role: number;
      messageCount: number;
      unreadCount: number;
      hasKey: boolean;
    }>();

    // Add DB-persisted channels first (most reliable source)
    for (const ch of dbChannels) {
      channelMap.set(ch.id, {
        index: ch.id,
        name: ch.name,
        role: ch.role || (ch.id === 0 ? 1 : 2),
        messageCount: 0,
        unreadCount: unreadMap.get(ch.id) || 0,
        hasKey: ch.has_key === 1 || ch.id === 0,
      });
    }

    // Add device channels (override with device config if available)
    for (const dc of deviceChannels) {
      const existing = channelMap.get(dc.index);
      channelMap.set(dc.index, {
        index: dc.index,
        name: dc.name || existing?.name || getDefaultChannelName(dc.index),
        role: dc.role || existing?.role || (dc.index === 0 ? 1 : 2),
        messageCount: existing?.messageCount || 0,
        unreadCount: unreadMap.get(dc.index) || 0,
        hasKey: dc.hasKey || existing?.hasKey || false,
      });
    }

    // Add MQTT-learned channel names (if not already present)
    for (const mapping of mqttChannelMappings) {
      if (!channelMap.has(mapping.index)) {
        channelMap.set(mapping.index, {
          index: mapping.index,
          name: mapping.name,
          role: mapping.index === 0 ? 1 : 2,
          messageCount: 0,
          unreadCount: unreadMap.get(mapping.index) || 0,
          hasKey: mapping.index === 0, // Primary uses default key
        });
      }
    }

    // Merge with message data
    for (const row of channelData) {
      const existing = channelMap.get(row.channel);
      if (existing) {
        existing.messageCount = row.message_count;
      } else {
        // Channel not from device or MQTT - use learned name or create synthetic entry
        const learnedName = getChannelName(row.channel);
        channelMap.set(row.channel, {
          index: row.channel,
          name: learnedName || getDefaultChannelName(row.channel),
          role: row.channel === 0 ? 1 : 2,
          messageCount: row.message_count,
          unreadCount: unreadMap.get(row.channel) || 0,
          hasKey: false,
        });
      }
    }

    // Always include channel 0 (primary)
    if (!channelMap.has(0)) {
      const primaryName = getChannelName(0) || "LongFast";
      channelMap.set(0, {
        index: 0,
        name: primaryName,
        role: 1,
        messageCount: 0,
        unreadCount: unreadMap.get(0) || 0,
        hasKey: true, // Default LongFast key is known
      });
    }

    // Convert to sorted array, excluding disabled channels
    let channels = Array.from(channelMap.values())
      .filter(c => c.role > 0)
      .sort((a, b) => a.index - b.index);

    // Deduplicate channels by name - keep the lowest index for each unique name
    // This fixes the issue where channel 0 and 8 both show "LongFast"
    const seenNames = new Map<string, number>();
    channels = channels.filter(c => {
      const normalizedName = c.name.toLowerCase();
      const existingIndex = seenNames.get(normalizedName);
      if (existingIndex !== undefined) {
        // Merge message counts into the existing channel
        const existing = channels.find(ch => ch.index === existingIndex);
        if (existing) {
          existing.messageCount += c.messageCount;
        }
        return false; // Filter out duplicate
      }
      seenNames.set(normalizedName, c.index);
      return true;
    });

    return NextResponse.json({ channels, count: channels.length });
  } catch (error) {
    console.error("API Error - GET /api/channels:", error);
    return NextResponse.json(
      { error: "Failed to fetch channels" },
      { status: 500 }
    );
  }
}

/**
 * Get default channel name based on index
 */
function getDefaultChannelName(index: number): string {
  if (index === 0) return "Primary";
  return `Channel ${index}`;
}
