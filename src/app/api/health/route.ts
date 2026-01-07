/**
 * Health Check API
 *
 * Provides service health status for monitoring and container orchestration
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { getMQTTWorker } from '@/lib/worker/mqtt-worker';
import { getWebSocketStats } from '@/lib/websocket';
import '@/lib/worker/auto-start'; // Trigger MQTT auto-start

export async function GET() {
  const checks = {
    timestamp: Date.now(),
    status: 'healthy',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    checks: {} as Record<string, { status: string; message?: string }>
  };

  // Check database
  try {
    const db = getDatabase();
    const result = db.prepare('SELECT 1 as test').get() as { test: number };
    checks.checks.database = {
      status: result.test === 1 ? 'healthy' : 'unhealthy',
      message: 'Database connection OK'
    };
  } catch (error) {
    checks.checks.database = {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Database error'
    };
    checks.status = 'unhealthy';
  }

  // Check MQTT worker
  try {
    const worker = getMQTTWorker();
    const health = worker.getHealth();
    checks.checks.mqtt = {
      status: health.status,
      message: health.issues.length > 0 ? health.issues.join(', ') : 'MQTT worker OK'
    };

    if (health.status === 'unhealthy') {
      checks.status = 'unhealthy';
    } else if (health.status === 'degraded' && checks.status === 'healthy') {
      checks.status = 'degraded';
    }
  } catch (error) {
    checks.checks.mqtt = {
      status: 'unknown',
      message: 'MQTT worker not initialized'
    };
    // Don't mark as unhealthy if worker isn't started yet
  }

  // Check WebSocket
  try {
    const wsStats = getWebSocketStats();
    checks.checks.websocket = {
      status: wsStats.initialized ? 'healthy' : 'not_initialized',
      message: wsStats.initialized
        ? `${wsStats.connections} active connections`
        : 'WebSocket not initialized'
    };
  } catch (error) {
    checks.checks.websocket = {
      status: 'unknown',
      message: 'WebSocket status unavailable'
    };
  }

  // Check memory
  const memUsage = process.memoryUsage();
  const memUsedMB = memUsage.heapUsed / 1024 / 1024;
  const memTotalMB = memUsage.heapTotal / 1024 / 1024;
  const memPercent = (memUsedMB / memTotalMB) * 100;

  checks.checks.memory = {
    status: memPercent > 95 ? 'critical' : memPercent > 85 ? 'warning' : 'healthy',
    message: `${memUsedMB.toFixed(0)}MB / ${memTotalMB.toFixed(0)}MB (${memPercent.toFixed(1)}%)`
  };

  if (checks.checks.memory.status === 'critical') {
    checks.status = 'degraded';
  }

  // Return appropriate status code
  const statusCode = checks.status === 'healthy' ? 200 :
                     checks.status === 'degraded' ? 200 : 503;

  return NextResponse.json(checks, { status: statusCode });
}
