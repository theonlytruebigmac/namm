/**
 * SSE Status API Route
 *
 * Returns SSE broadcaster status
 * (Kept as /api/ws for backwards compatibility)
 */

import { NextRequest } from 'next/server';
import { getSSEStats } from '@/lib/sse';

export async function GET(request: NextRequest) {
  // Return SSE status
  const stats = getSSEStats();

  return Response.json({
    success: true,
    data: stats
  });
}
