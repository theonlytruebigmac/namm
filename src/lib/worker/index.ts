/**
 * Worker Module Exports
 *
 * Central export point for MQTT worker functionality
 */

// Core worker
export {
  MQTTWorker,
  getMQTTWorker,
  shutdownMQTTWorker
} from './mqtt-worker';

// Components
export { MessageQueue } from './message-queue';
export { BatchWriter } from './batch-writer';
export { Deduplicator } from './deduplicator';
export { RateLimiter } from './rate-limiter';

// API
export {
  startWorker,
  stopWorker,
  getWorkerStats,
  getWorkerHealth,
  isWorkerRunning
} from './api';

// Types
export type {
  ProcessedData,
  QueuedMessage,
  WorkerConfig,
  QueueConfig,
  BatchWriterConfig,
  RateLimiterConfig,
  WorkerStats,
  WorkerHealth,
  DedupeResult,
  RateLimitResult,
  BatchWriteResult
} from './types';
