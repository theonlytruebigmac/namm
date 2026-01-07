/**
 * Performance Metrics API
 *
 * Provides real-time performance metrics and statistics
 */

import { NextResponse } from 'next/server';
import { getMQTTWorker } from '@/lib/worker/mqtt-worker';
import { getWebSocketStats } from '@/lib/websocket';
import { getDatabaseStats } from '@/lib/db';
import { getCacheStats } from '@/lib/cache/hot-cache';

export async function GET() {
  try {
    // Get worker stats (if running)
    let workerStats = null;
    let workerHealth = null;
    try {
      const worker = getMQTTWorker();
      workerStats = worker.getStats();
      workerHealth = worker.getHealth();
    } catch (error) {
      // Worker not initialized
    }

    // Get WebSocket stats
    const wsStats = getWebSocketStats();

    // Get database stats
    const dbStats = getDatabaseStats();

    // Get cache stats
    const cacheStats = getCacheStats();

    // Calculate performance metrics
    const metrics = {
      timestamp: Date.now(),
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        total: process.memoryUsage().heapTotal / 1024 / 1024, // MB
        external: process.memoryUsage().external / 1024 / 1024, // MB
        rss: process.memoryUsage().rss / 1024 / 1024 // MB
      },
      worker: workerStats ? {
        connected: workerStats.connected,
        uptime: workerStats.uptime,
        messagesReceived: workerStats.messagesReceived,
        messagesProcessed: workerStats.messagesProcessed,
        messagesFailed: workerStats.messagesFailed,
        messagesDeduplicated: workerStats.messagesDeduplicated,
        messagesRateLimited: workerStats.messagesRateLimited,
        queueDepth: workerStats.queueDepth,
        queueUtilization: workerStats.queueDepth / workerStats.queueSize,
        avgProcessingTimeMs: workerStats.avgProcessingTimeMs,
        throughput: workerStats.uptime > 0
          ? workerStats.messagesProcessed / (workerStats.uptime / 1000)
          : 0, // msgs/sec
        health: workerHealth?.status || 'unknown'
      } : null,
      websocket: wsStats.initialized ? {
        connections: wsStats.connections,
        stats: wsStats.connectionStats,
        broadcaster: wsStats.broadcasterStats
      } : null,
      database: {
        size: dbStats.size,
        pageSize: dbStats.pageSize,
        pageCount: dbStats.pageCount,
        nodeCount: dbStats.nodeCount,
        positionCount: dbStats.positionCount,
        telemetryCount: dbStats.telemetryCount,
        messageCount: dbStats.messageCount
      },
      cache: {
        nodes: {
          size: cacheStats.nodes.size,
          max: cacheStats.nodes.max,
          utilization: cacheStats.nodes.size / cacheStats.nodes.max
        },
        positions: {
          size: cacheStats.positions.size,
          max: cacheStats.positions.max,
          utilization: cacheStats.positions.size / cacheStats.positions.max
        },
        positionHistory: {
          size: cacheStats.positionHistory.size,
          max: cacheStats.positionHistory.max,
          utilization: cacheStats.positionHistory.size / cacheStats.positionHistory.max
        }
      }
    };

    return NextResponse.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch metrics'
      },
      { status: 500 }
    );
  }
}
