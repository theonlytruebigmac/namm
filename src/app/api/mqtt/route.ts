/**
 * Server-Side MQTT Handler
 *
 * Connects to MQTT broker using native TCP (not WebSocket)
 * Streams data to browser clients via Server-Sent Events
 * Decrypts encrypted messages server-side (Node.js crypto)
 */

import mqtt, { type MqttClient } from "mqtt";
import { NextRequest } from "next/server";
import { processEncryptedMessage, processMapReportMessage } from "@/lib/mqtt-processor";

let mqttClient: MqttClient | null = null;
let subscribers = new Set<ReadableStreamDefaultController>();

interface MQTTConfig {
  broker: string;
  username?: string;
  password?: string;
  topic: string; // Direct topic pattern like "msh/US/KY/#"
}

function connectMQTT(config: MQTTConfig) {
  if (mqttClient?.connected) {
    return mqttClient;
  }

  console.log(`[MQTT Server] Connecting to: ${config.broker}`);

  mqttClient = mqtt.connect(config.broker, {
    username: config.username,
    password: config.password,
    clientId: `namm_server_${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    keepalive: 60,
    reconnectPeriod: 5000,
  });

  mqttClient.on("connect", () => {
    console.log("[MQTT Server] ✅ Connected to MQTT broker");

    // Subscribe to the specified topic
    console.log(`[MQTT Server] Subscribing to: ${config.topic}`);

    mqttClient?.subscribe(config.topic, (err) => {
      if (err) {
        console.error(`[MQTT Server] Failed to subscribe to ${config.topic}:`, err);
      } else {
        console.log(`[MQTT Server] ✅ Subscribed to: ${config.topic}`);
      }
    });
  });

  mqttClient.on("message", (topic, payload) => {
    // Check if this is an encrypted message (binary protobuf)
    const isEncrypted = topic.includes("/e/");
    const isMapReport = topic.includes("/map/");

    // Process messages server-side (crypto module not available in browser)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let processedResult: any = null;
    if (isEncrypted) {
      processedResult = processEncryptedMessage(topic, payload);
    } else if (isMapReport) {
      processedResult = processMapReportMessage(topic, payload);
    }

    // For binary messages, send as base64 to preserve binary data
    // For JSON messages, send as string
    const isBinary = isEncrypted || isMapReport;
    const payloadData = isBinary
      ? payload.toString("base64")
      : payload.toString("utf8");

    console.log(`[MQTT Server] 📨 Message on ${topic}${isEncrypted ? " (encrypted)" : isMapReport ? " (mapreport)" : ""}`);

    // Broadcast to all connected clients
    const event = {
      type: "mqtt.message",
      topic,
      payload: payloadData,
      isBase64: isBinary, // Flag to indicate payload encoding
      timestamp: Date.now(),
      // Include server-side processed result for binary messages
      processed: processedResult,
    };

    subscribers.forEach((controller) => {
      try {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      } catch (error) {
        // Controller is closed, remove it from subscribers
        subscribers.delete(controller);
        console.error("[MQTT Server] Removed closed client from subscribers");
      }
    });
  });

  mqttClient.on("error", (error) => {
    console.error("[MQTT Server] ❌ Error:", error);
  });

  mqttClient.on("close", () => {
    console.log("[MQTT Server] Connection closed");
  });

  return mqttClient;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Prefer server-side env vars, fall back to query params
  const config: MQTTConfig = {
    broker: process.env.MQTT_BROKER || searchParams.get("broker") || "",
    username: process.env.MQTT_USERNAME || searchParams.get("username") || undefined,
    password: process.env.MQTT_PASSWORD || searchParams.get("password") || undefined,
    topic: process.env.MQTT_TOPIC || searchParams.get("topic") || "",
  };

  // Don't connect if no broker is configured
  if (!config.broker) {
    return new Response(
      JSON.stringify({ error: "No MQTT broker configured" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Connect to MQTT if not already connected
  connectMQTT(config);

  // Create Server-Sent Events stream
  const stream = new ReadableStream({
    start(controller) {
      // Add this client to subscribers
      subscribers.add(controller);

      // Send initial connection event
      controller.enqueue(`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`);

      console.log(`[MQTT Server] Client connected (${subscribers.size} total clients)`);
    },
    cancel() {
      // Remove this client from subscribers
      subscribers.forEach((sub) => {
        if (sub === this) {
          subscribers.delete(sub);
        }
      });
      console.log(`[MQTT Server] Client disconnected (${subscribers.size} remaining)`);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.action === "disconnect") {
    if (mqttClient) {
      mqttClient.end();
      mqttClient = null;
      subscribers.clear();
    }
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
