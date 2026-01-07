/**
 * WebSocket API Route
 *
 * Handles WebSocket upgrade requests
 */

import { NextRequest } from 'next/server';
import { getWebSocketStats } from '@/lib/websocket';

export async function GET(request: NextRequest) {
  // Return WebSocket status
  const stats = getWebSocketStats();

  return Response.json({
    success: true,
    data: stats
  });
}
