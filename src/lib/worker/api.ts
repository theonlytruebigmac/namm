/**
 * MQTT Worker API Route
 *
 * Manages the MQTT worker lifecycle from Next.js API
 */

import { getMQTTWorker, shutdownMQTTWorker } from '@/lib/worker/mqtt-worker';
import type { WorkerConfig } from '@/lib/worker/types';

/**
 * Start the MQTT worker
 */
export async function startWorker(config: WorkerConfig): Promise<void> {
  try {
    const worker = getMQTTWorker(config);
    await worker.start();
  } catch (error) {
    console.error('Failed to start MQTT worker:', error);
    throw error;
  }
}

/**
 * Stop the MQTT worker
 */
export async function stopWorker(): Promise<void> {
  try {
    await shutdownMQTTWorker();
  } catch (error) {
    console.error('Failed to stop MQTT worker:', error);
    throw error;
  }
}

/**
 * Get worker stats
 */
export function getWorkerStats() {
  try {
    const worker = getMQTTWorker();
    return worker.getStats();
  } catch (error) {
    return null;
  }
}

/**
 * Get worker health
 */
export function getWorkerHealth() {
  try {
    const worker = getMQTTWorker();
    return worker.getHealth();
  } catch (error) {
    return {
      status: 'unhealthy' as const,
      connected: false,
      queueDepth: 0,
      queueUtilization: 0,
      lastMessageAge: null,
      issues: ['Worker not initialized']
    };
  }
}

/**
 * Check if worker is running
 */
export function isWorkerRunning(): boolean {
  try {
    const worker = getMQTTWorker();
    return worker.isConnected();
  } catch (error) {
    return false;
  }
}
