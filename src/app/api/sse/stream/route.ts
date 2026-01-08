/**
 * SSE Stream Endpoint
 *
 * Provides a Server-Sent Events stream for real-time updates
 * Replaces WebSocket with simpler, more reliable SSE approach
 *
 * GET /api/sse/stream - Connect to SSE stream
 */

import { NextRequest } from 'next/server';
import { getSSEBroadcaster } from '@/lib/sse';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const clientId = randomUUID();

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      const broadcaster = getSSEBroadcaster();

      // Add client to broadcaster
      broadcaster.addClient(clientId, controller);

      // Send connected event
      const connectEvent = {
        type: 'connected',
        data: { clientId },
        timestamp: Date.now()
      };
      controller.enqueue(`data: ${JSON.stringify(connectEvent)}\n\n`);

      // Send initial snapshot
      broadcaster.sendSnapshot(clientId);
    },
    cancel() {
      // Remove client from broadcaster
      const broadcaster = getSSEBroadcaster();
      broadcaster.removeClient(clientId);
    }
  });

  // Handle client disconnect via AbortSignal
  request.signal.addEventListener('abort', () => {
    const broadcaster = getSSEBroadcaster();
    broadcaster.removeClient(clientId);
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
