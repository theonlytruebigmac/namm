/**
 * Worker Control API Route
 *
 * POST /api/worker/start - Start the MQTT worker
 * POST /api/worker/stop - Stop the MQTT worker
 */

import { NextRequest, NextResponse } from 'next/server';
import { startWorker, stopWorker, isWorkerRunning } from '@/lib/worker';
import type { WorkerConfig } from '@/lib/worker';

export async function POST(request: NextRequest) {
  try {
    const { action, config } = await request.json();

    if (action === 'start') {
      if (isWorkerRunning()) {
        return NextResponse.json(
          { error: 'Worker already running' },
          { status: 400 }
        );
      }

      if (!config) {
        return NextResponse.json(
          { error: 'Worker configuration required' },
          { status: 400 }
        );
      }

      const workerConfig: WorkerConfig = {
        broker: config.broker || process.env.MQTT_BROKER || '',
        username: config.username || process.env.MQTT_USERNAME,
        password: config.password || process.env.MQTT_PASSWORD,
        topic: config.topic || process.env.MQTT_TOPIC || '',
        useTLS: config.useTLS || process.env.MQTT_USE_TLS === 'true',
        clientId: config.clientId,
        reconnectPeriod: config.reconnectPeriod || 5000
      };

      await startWorker(workerConfig);

      return NextResponse.json({
        success: true,
        message: 'Worker started'
      });
    }

    if (action === 'stop') {
      if (!isWorkerRunning()) {
        return NextResponse.json(
          { error: 'Worker not running' },
          { status: 400 }
        );
      }

      await stopWorker();

      return NextResponse.json({
        success: true,
        message: 'Worker stopped'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "start" or "stop"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error controlling worker:', error);
    return NextResponse.json(
      {
        error: 'Failed to control worker',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
