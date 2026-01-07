/**
 * Worker Status API Route
 *
 * GET /api/worker/status - Get worker status and health
 */

import { NextResponse } from 'next/server';
import { getWorkerHealth, getWorkerStats, isWorkerRunning } from '@/lib/worker';

export async function GET() {
  try {
    const running = isWorkerRunning();
    const health = getWorkerHealth();
    const stats = getWorkerStats();

    return NextResponse.json({
      running,
      health,
      stats
    });
  } catch (error) {
    console.error('Error getting worker status:', error);
    return NextResponse.json(
      {
        error: 'Failed to get worker status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
