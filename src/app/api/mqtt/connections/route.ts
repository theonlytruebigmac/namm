/**
 * Server-Side MQTT Connection Management API
 *
 * This endpoint allows managing MQTT connections that require native TCP (port 1883)
 * since browsers can only connect via WebSocket.
 *
 * POST /api/mqtt/connections - Add a new connection
 * GET /api/mqtt/connections - List all connections
 * DELETE /api/mqtt/connections/:id - Remove a connection
 */

import { NextRequest, NextResponse } from "next/server";
import mqtt, { type MqttClient } from "mqtt";
import { processMQTTMessage } from "@/lib/mqtt-processor";
import { getBroadcaster } from "@/lib/websocket";
import { getDatabase } from "@/lib/db";
import { NodeRepository } from "@/lib/db/repositories/nodes";
import { MessageRepository } from "@/lib/db/repositories/messages";
import { PositionRepository } from "@/lib/db/repositories/positions";
import { TelemetryRepository } from "@/lib/db/repositories/telemetry";

interface MQTTConnection {
  id: string;
  name: string;
  broker: string;
  username?: string;
  password?: string;
  topics: string[];
  status: "disconnected" | "connecting" | "connected" | "error";
  error?: string;
  messagesReceived: number;
  connectedAt?: number;
}

interface MQTTClientInstance {
  client: MqttClient;
  connection: MQTTConnection;
}

// Store for active connections (global singleton)
const activeConnections = new Map<string, MQTTClientInstance>();

// Lazy-loaded repositories
let nodeRepo: NodeRepository | null = null;
let msgRepo: MessageRepository | null = null;
let posRepo: PositionRepository | null = null;
let telRepo: TelemetryRepository | null = null;

function getRepos() {
  if (!nodeRepo) {
    const db = getDatabase();
    nodeRepo = new NodeRepository(db);
    msgRepo = new MessageRepository(db);
    posRepo = new PositionRepository(db);
    telRepo = new TelemetryRepository(db);
  }
  return { nodeRepo, msgRepo: msgRepo!, posRepo: posRepo!, telRepo: telRepo! };
}

function handleMQTTMessage(connectionId: string, topic: string, payload: Buffer) {
  const instance = activeConnections.get(connectionId);
  if (!instance) return;

  instance.connection.messagesReceived++;

  try {
    // Process the MQTT message
    const result = processMQTTMessage(topic, payload);
    if (!result || !result.type || result.type === "unknown" || result.type === "parse_error") {
      return;
    }

    const broadcaster = getBroadcaster();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = ('data' in result && result.data) ? result.data as any : null;

    // Extract nodeId for broadcast
    let nodeId: string | undefined;
    if (data) {
      if (data.id && typeof data.id === 'string') {
        nodeId = data.id;
      } else if (data.nodeId && typeof data.nodeId === 'string') {
        nodeId = data.nodeId;
      } else if (data.from && typeof data.from === 'string') {
        nodeId = data.from;
      }
    }

    // Broadcast raw MQTT packet for live stream view (always, even without data)
    if (broadcaster) {
      broadcaster.queueMQTTRaw(
        topic,
        payload.toString('base64'),
        result.type,
        nodeId,
        data
      );
    }

    // Check if result has data property for further processing
    if (!data) {
      return;
    }

    const { nodeRepo, msgRepo, posRepo, telRepo } = getRepos();

    // Handle based on message type
    switch (result.type) {
      case "nodeinfo": {
        const nodeInfo = {
          id: data.id as string,
          nodeNum: data.nodeNum as number,
          shortName: data.shortName as string,
          longName: data.longName as string,
          hwModel: data.hwModel as string,
          role: data.role as number,
          lastHeard: data.lastHeard as number,
        };
        nodeRepo.upsert(nodeInfo);
        if (broadcaster) {
          broadcaster.queueNodeUpdate(nodeInfo);
        }
        break;
      }

      case "position": {
        // Skip if required fields are missing
        if (!data.nodeId || typeof data.nodeNum !== 'number') {
          break;
        }
        try {
          // Ensure node exists
          nodeRepo.upsert({
            id: data.nodeId as string,
            nodeNum: data.nodeNum as number,
            longName: "",
            shortName: "",
            hwModel: "0",
            role: 0,
            lastHeard: Date.now(),
          });
          posRepo.insert(data);
          if (broadcaster) {
            broadcaster.queuePositionUpdate({
              id: 0,
              nodeId: data.nodeId as string,
              latitude: data.position?.latitude ?? 0,
              longitude: data.position?.longitude ?? 0,
              altitude: data.position?.altitude ?? 0,
              timestamp: data.timestamp as number,
            });
          }
        } catch (dbError) {
          // Log constraint errors at debug level
          const msg = dbError instanceof Error ? dbError.message : String(dbError);
          if (!msg.includes('FOREIGN KEY') && !msg.includes('UNIQUE constraint')) {
            console.error('[MQTT Server] Position DB error:', dbError);
          }
        }
        break;
      }

      case "telemetry": {
        // Skip if required fields are missing
        if (!data.nodeId || typeof data.nodeNum !== 'number') {
          break;
        }
        try {
          // Ensure node exists
          nodeRepo.upsert({
            id: data.nodeId as string,
            nodeNum: data.nodeNum as number,
            longName: "",
            shortName: "",
            hwModel: "0",
            role: 0,
            lastHeard: Date.now(),
          });
          telRepo.insert(data);
          if (broadcaster) {
            broadcaster.queueTelemetryUpdate({
              id: 0,
              nodeId: data.nodeId as string,
              timestamp: data.timestamp as number,
              batteryLevel: data.batteryLevel,
              voltage: data.voltage,
              channelUtilization: data.channelUtilization,
              airUtilTx: data.airUtilTx,
              uptime: data.uptime,
            });
          }
        } catch (dbError) {
          // Log constraint errors at debug level
          const msg = dbError instanceof Error ? dbError.message : String(dbError);
          if (!msg.includes('FOREIGN KEY') && !msg.includes('UNIQUE constraint')) {
            console.error('[MQTT Server] Telemetry DB error:', dbError);
          }
        }
        break;
      }

      case "text": {
        // Ensure node exists
        nodeRepo.upsert({
          id: data.from as string,
          nodeNum: data.id as number,
          longName: "",
          shortName: "",
          hwModel: "0",
          role: 0,
          lastHeard: Date.now(),
        });
        msgRepo.insert(data);
        if (broadcaster) {
          broadcaster.queueMessage({
            id: data.id as number,
            fromId: data.from as string,
            toId: data.to as string,
            channel: data.channel as number,
            text: (data.text as string) || "",
            timestamp: data.timestamp as number,
            snr: data.snr,
            rssi: data.rssi,
          });
        }
        break;
      }

      default:
        // Log other packet types for debugging
        console.log(`[MQTT Server] Received ${result.type} packet`);
        break;
    }
  } catch (error) {
    console.error(`[MQTT Server] Error processing message on ${topic}:`, error);
  }
}

function connectToMQTT(connection: MQTTConnection): MQTTClientInstance {
  console.log(`[MQTT Server] 🔌 Connecting to ${connection.name}: ${connection.broker}`);

  const client = mqtt.connect(connection.broker, {
    username: connection.username,
    password: connection.password,
    clientId: `namm_server_${connection.id.slice(-8)}_${Math.random().toString(16).slice(2, 6)}`,
    clean: true,
    keepalive: 60,
    reconnectPeriod: 5000,
  });

  const instance: MQTTClientInstance = {
    client,
    connection: { ...connection, status: "connecting" },
  };

  client.on("connect", () => {
    console.log(`[MQTT Server] ✅ ${connection.name} connected`);
    instance.connection.status = "connected";
    instance.connection.connectedAt = Date.now();
    instance.connection.error = undefined;

    // Subscribe to all configured topics
    for (const topic of connection.topics) {
      client.subscribe(topic, (err) => {
        if (err) {
          console.error(`[MQTT Server] Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`[MQTT Server] ✅ Subscribed to: ${topic}`);
        }
      });
    }
  });

  client.on("message", (topic, payload) => {
    handleMQTTMessage(connection.id, topic, payload);
  });

  client.on("error", (error) => {
    console.error(`[MQTT Server] ❌ ${connection.name} error:`, error);
    instance.connection.status = "error";
    instance.connection.error = error.message;
  });

  client.on("close", () => {
    console.log(`[MQTT Server] ${connection.name} connection closed`);
    if (instance.connection.status !== "disconnected") {
      instance.connection.status = "connecting"; // Will auto-reconnect
    }
  });

  client.on("reconnect", () => {
    console.log(`[MQTT Server] ${connection.name} reconnecting...`);
    instance.connection.status = "connecting";
  });

  return instance;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, broker, username, password, topics } = body;

    if (!id || !name || !broker || !topics?.length) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, broker, topics" },
        { status: 400 }
      );
    }

    // Check if connection already exists
    if (activeConnections.has(id)) {
      return NextResponse.json(
        { error: "Connection already exists" },
        { status: 409 }
      );
    }

    const connection: MQTTConnection = {
      id,
      name,
      broker,
      username,
      password,
      topics,
      status: "disconnected",
      messagesReceived: 0,
    };

    const instance = connectToMQTT(connection);
    activeConnections.set(id, instance);

    return NextResponse.json({
      success: true,
      connection: {
        id,
        name,
        status: instance.connection.status,
      },
    });
  } catch (error) {
    console.error("[MQTT Server] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create connection" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const connections = Array.from(activeConnections.values()).map((instance) => ({
    id: instance.connection.id,
    name: instance.connection.name,
    broker: instance.connection.broker,
    topics: instance.connection.topics,
    status: instance.connection.status,
    error: instance.connection.error,
    messagesReceived: instance.connection.messagesReceived,
    connectedAt: instance.connection.connectedAt,
  }));

  return NextResponse.json({ connections });
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing connection id" },
        { status: 400 }
      );
    }

    const instance = activeConnections.get(id);
    if (!instance) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    instance.client.end(true);
    activeConnections.delete(id);
    console.log(`[MQTT Server] ➖ Removed connection: ${instance.connection.name}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MQTT Server] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to remove connection" },
      { status: 500 }
    );
  }
}
