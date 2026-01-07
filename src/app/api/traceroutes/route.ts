import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { TracerouteRepository } from "@/lib/db/repositories/traceroutes";
import { getMQTTWorker } from "@/lib/worker/mqtt-worker";
import { createTracerouteRequest } from "@/lib/crypto/protobuf-encoder";
import { encryptWithDefaultKey, generatePacketId, keyFromHex, MESHTASTIC_KEYS, encryptPayload } from "@/lib/crypto/meshtastic-crypto";
import { getChannelKeys } from "../channels/keys/store";

// Gateway ID for this NAMM instance
const GATEWAY_ID = process.env.GATEWAY_ID || "!namm0001";

// Get node number from gateway ID or use random
function getNodeNum(): number {
  const match = GATEWAY_ID.match(/^!([0-9a-f]{8})$/i);
  if (match) {
    return parseInt(match[1], 16);
  }
  return Math.floor(Math.random() * 0xffffffff);
}

const LOCAL_NODE_NUM = getNodeNum();

/**
 * GET /api/traceroutes
 * Fetch traceroutes with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "100");
    const fromId = searchParams.get("fromId");
    const toId = searchParams.get("toId");
    const since = searchParams.get("since");
    const nodeId = searchParams.get("nodeId"); // Get routes involving this node

    const db = getDatabase();
    const tracerouteRepo = new TracerouteRepository(db);

    let traceroutes;

    if (nodeId) {
      // Get traceroutes involving a specific node
      traceroutes = tracerouteRepo.getForNode(nodeId, limit);
    } else if (fromId && toId) {
      // Get traceroutes between two nodes
      traceroutes = tracerouteRepo.getBetweenNodes(fromId, toId, limit);
    } else {
      // Get all with optional filters
      traceroutes = tracerouteRepo.getAll({
        fromId: fromId || undefined,
        toId: toId || undefined,
        since: since ? parseInt(since) : undefined,
      }, limit);
    }

    return NextResponse.json({
      traceroutes,
      count: traceroutes.length,
    });
  } catch (error) {
    console.error("API Error - GET /api/traceroutes:", error);
    return NextResponse.json(
      { error: "Failed to fetch traceroutes" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/traceroutes/stats
 * Get traceroute statistics
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const db = getDatabase();
    const tracerouteRepo = new TracerouteRepository(db);

    if (action === "stats") {
      const since = body.since ? parseInt(body.since) : undefined;
      const stats = tracerouteRepo.getStats(since);
      return NextResponse.json(stats);
    }

    if (action === "unique-routes") {
      const routes = tracerouteRepo.getUniqueRoutes();
      return NextResponse.json({ routes });
    }

    if (action === "send") {
      // Send a traceroute request to a target node
      const { toNodeId, channel = 0 } = body;

      if (!toNodeId) {
        return NextResponse.json(
          { error: "toNodeId is required" },
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

      // Parse target node ID
      const toNode = parseInt(toNodeId.replace("!", ""), 16);
      if (isNaN(toNode)) {
        return NextResponse.json(
          { error: "Invalid node ID format" },
          { status: 400 }
        );
      }

      // Generate packet ID
      const packetId = generatePacketId();

      // Determine encryption function based on channel
      const channelKeys = getChannelKeys();
      const channelConfig = channelKeys.find(c => c.index === channel);

      let encryptFn: (plaintext: Buffer, packetId: number, fromNode: number) => Buffer | null;

      if (channel === 0 || !channelConfig?.psk) {
        encryptFn = encryptWithDefaultKey;
      } else if (channelConfig?.psk) {
        const key = Buffer.from(channelConfig.psk, 'base64');
        encryptFn = (plaintext, pId, from) => {
          let expandedKey: Buffer;
          if (key.length === 1) {
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

      // Build MQTT topic
      const baseTopic = process.env.MQTT_TOPIC || "msh/US/KY/2/#";
      const topicParts = baseTopic.replace("/#", "").split("/");
      const publishTopic = `${topicParts.slice(0, 4).join("/")}/e/${channelName}/${GATEWAY_ID}`;

      // Create the traceroute request
      const envelope = createTracerouteRequest({
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
          { error: "Failed to create traceroute packet" },
          { status: 500 }
        );
      }

      // Publish to MQTT
      const success = await worker.publish(publishTopic, envelope);

      if (success) {
        console.log(`[API] Traceroute request sent to ${toNodeId} via ${publishTopic}`);
        return NextResponse.json({
          success: true,
          message: "Traceroute request sent",
          packetId,
          toNodeId,
          topic: publishTopic,
        });
      } else {
        return NextResponse.json(
          { error: "Failed to publish traceroute request" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("API Error - POST /api/traceroutes:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
