import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { MessageRepository } from "@/lib/db/repositories/messages";
import { ReactionRepository } from "@/lib/db/repositories/reactions";
import { getMQTTWorker } from "@/lib/worker/mqtt-worker";
import { createTextMessage } from "@/lib/crypto/protobuf-encoder";
import { encryptWithDefaultKey, generatePacketId, keyFromHex, MESHTASTIC_KEYS, encryptPayload } from "@/lib/crypto/meshtastic-crypto";
import { getChannelKeys } from "../channels/keys/store";

// Gateway ID for this NAMM instance (will be used in MQTT topic)
const GATEWAY_ID = process.env.GATEWAY_ID || "!namm0001";

// Get node number from gateway ID or use random
function getNodeNum(): number {
  // Parse from GATEWAY_ID if it's in !xxxxxxxx format
  const match = GATEWAY_ID.match(/^!([0-9a-f]{8})$/i);
  if (match) {
    return parseInt(match[1], 16);
  }
  // Generate a random node number in the valid range
  return Math.floor(Math.random() * 0xffffffff);
}

const LOCAL_NODE_NUM = getNodeNum();

/**
 * GET /api/messages
 * Fetch messages from the database
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "100");
    const channel = searchParams.get("channel");
    const search = searchParams.get("search");

    const db = getDatabase();
    const messageRepo = new MessageRepository(db);
    const reactionRepo = new ReactionRepository(db);

    let messages;
    if (search) {
      // Full-text search across all messages
      messages = messageRepo.search(search, limit);
    } else if (channel !== null) {
      messages = messageRepo.getAll({ channel: parseInt(channel) });
    } else {
      messages = messageRepo.getRecent(limit);
    }

    // Get reactions for all messages in batch
    const messageIds = messages.map(m => m.id);
    const reactionsMap = reactionRepo.getForMessages(messageIds);

    // Transform DB messages to API format
    const transformedMessages = messages.map(msg => ({
      id: msg.id,
      fromNode: msg.from_id,
      toNode: msg.to_id,
      channel: msg.channel,
      text: msg.text,
      timestamp: msg.timestamp,
      snr: msg.snr,
      rssi: msg.rssi,
      hopsAway: msg.hops_away,
      replyTo: msg.reply_to,
      readAt: msg.read_at,
      reactions: reactionsMap.get(msg.id) || [],
    }));

    return NextResponse.json({ messages: transformedMessages, count: transformedMessages.length });
  } catch (error) {
    console.error("API Error - GET /api/messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages from database" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messages
 * Send a message to the mesh network via MQTT
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, channel = 0, to } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Message text is required" },
        { status: 400 }
      );
    }

    if (text.length > 237) {
      return NextResponse.json(
        { error: "Message too long (max 237 characters)" },
        { status: 400 }
      );
    }

    // Get MQTT worker
    let worker;
    try {
      worker = getMQTTWorker();
    } catch {
      return NextResponse.json(
        { error: "MQTT worker not initialized" },
        { status: 503 }
      );
    }

    if (!worker.isConnected()) {
      return NextResponse.json(
        { error: "Not connected to MQTT broker" },
        { status: 503 }
      );
    }

    // Generate packet ID
    const packetId = generatePacketId();

    // Determine encryption function based on channel
    const channelKeys = getChannelKeys();
    const channelConfig = channelKeys.find(c => c.index === channel);

    let encryptFn: (plaintext: Buffer, packetId: number, fromNode: number) => Buffer | null;

    if (channel === 0 || !channelConfig?.psk) {
      // Use default LongFast key
      encryptFn = encryptWithDefaultKey;
    } else if (channelConfig?.psk) {
      // Use channel-specific key
      const key = Buffer.from(channelConfig.psk, 'base64');
      encryptFn = (plaintext, pId, from) => {
        // Expand the PSK properly
        let expandedKey: Buffer;
        if (key.length === 1) {
          // PSK index
          expandedKey = keyFromHex(MESHTASTIC_KEYS.LONGFAST_DEFAULT);
          expandedKey[15] = (expandedKey[15] + key[0] - 1) & 0xff;
        } else if (key.length === 16 || key.length === 32) {
          expandedKey = key;
        } else if (key.length < 16) {
          expandedKey = Buffer.alloc(16);
          key.copy(expandedKey);
        } else {
          expandedKey = Buffer.alloc(32);
          key.copy(expandedKey, 0, 0, 32);
        }
        return encryptPayload(plaintext, expandedKey, pId, from);
      };
    } else {
      encryptFn = encryptWithDefaultKey;
    }

    // Determine channel name for topic
    const channelName = channel === 0 ? "LongFast" : (channelConfig?.name || `Channel${channel}`);

    // Build MQTT topic: msh/{region}/{subregion}/{modem}/e/{channel}/!{gatewayId}
    // Using the same topic pattern as the subscription but for publishing
    const baseTopic = process.env.MQTT_TOPIC || "msh/US/KY/2/#";
    const topicParts = baseTopic.replace("/#", "").split("/");
    const publishTopic = `${topicParts.slice(0, 4).join("/")}/e/${channelName}/${GATEWAY_ID}`;

    // Create the encrypted message
    const toNode = to ? parseInt(to.replace("!", ""), 16) : 0xffffffff; // Broadcast
    const envelope = createTextMessage({
      text,
      fromNode: LOCAL_NODE_NUM,
      toNode,
      channel,
      packetId,
      channelId: channelName,
      gatewayId: GATEWAY_ID,
      encryptFn,
    });

    if (!envelope) {
      return NextResponse.json(
        { error: "Failed to create message packet" },
        { status: 500 }
      );
    }

    // Publish to MQTT
    const success = await worker.publish(publishTopic, envelope);

    if (success) {
      console.log(`[API] Message sent to ${publishTopic}: "${text.substring(0, 50)}..."`);
      return NextResponse.json({
        success: true,
        message: "Message sent",
        packetId,
        topic: publishTopic,
      });
    } else {
      return NextResponse.json(
        { error: "Failed to publish message to MQTT" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("API Error - POST /api/messages:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/messages
 * Mark messages as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageIds, channel } = body;

    const db = getDatabase();
    const messageRepo = new MessageRepository(db);

    if (channel !== undefined) {
      // Mark all messages in channel as read
      const result = messageRepo.markChannelAsRead(channel);
      return NextResponse.json({
        success: true,
        updated: result.changes,
      });
    } else if (Array.isArray(messageIds) && messageIds.length > 0) {
      // Mark specific messages as read
      messageRepo.markManyAsRead(messageIds);
      return NextResponse.json({
        success: true,
        updated: messageIds.length,
      });
    } else {
      return NextResponse.json(
        { error: "Either messageIds array or channel is required" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("API Error - PATCH /api/messages:", error);
    return NextResponse.json(
      { error: "Failed to mark messages as read" },
      { status: 500 }
    );
  }
}
