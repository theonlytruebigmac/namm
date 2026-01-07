import { NextResponse } from "next/server";

/**
 * GET /api/events
 * Server-Sent Events endpoint for real-time updates
 */
export async function GET() {
  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection message
      const send = (data: any) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      send({ type: "connected", timestamp: Date.now() });

      // Send periodic heartbeat
      const heartbeatInterval = setInterval(() => {
        send({ type: "heartbeat", timestamp: Date.now() });
      }, 30000);

      // Simulate real-time updates (in production, would listen to actual events)
      const updateInterval = setInterval(() => {
        // Randomly generate events
        const eventType = Math.random();

        if (eventType < 0.3) {
          // Node update
          send({
            type: "nodeUpdate",
            timestamp: Date.now(),
            data: {
              nodeId: `node-${Math.floor(Math.random() * 25) + 1}`,
              batteryLevel: Math.floor(Math.random() * 100),
              lastHeard: Date.now(),
            },
          });
        } else if (eventType < 0.6) {
          // New message
          send({
            type: "newMessage",
            timestamp: Date.now(),
            data: {
              id: `msg-${Date.now()}`,
              fromNode: `node-${Math.floor(Math.random() * 25) + 1}`,
              channel: 0,
              text: "Real-time message update",
            },
          });
        } else {
          // Position update
          send({
            type: "positionUpdate",
            timestamp: Date.now(),
            data: {
              nodeId: `node-${Math.floor(Math.random() * 25) + 1}`,
              latitude: 37.7749 + (Math.random() - 0.5) * 0.1,
              longitude: -122.4194 + (Math.random() - 0.5) * 0.1,
            },
          });
        }
      }, 5000); // Update every 5 seconds

      // Cleanup on close
      return () => {
        clearInterval(heartbeatInterval);
        clearInterval(updateInterval);
      };
    },
  });

  // Return response with SSE headers
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
