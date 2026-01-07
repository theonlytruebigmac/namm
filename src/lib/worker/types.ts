/**
 * Worker Type Definitions
 *
 * Types for MQTT worker, message queue, and batch processing
 */

import type {
  ProcessedNodeInfo,
  ProcessedPosition,
  ProcessedTelemetry,
  ProcessedMessage,
  ProcessedTraceroute
} from '@/lib/mqtt-processor';

/**
 * Union type for all processed message types
 */
export type ProcessedData =
  | { type: 'nodeinfo'; data: ProcessedNodeInfo }
  | { type: 'position'; data: ProcessedPosition }
  | { type: 'telemetry'; data: ProcessedTelemetry }
  | { type: 'message'; data: ProcessedMessage }
  | { type: 'text'; data: ProcessedMessage }
  | { type: 'traceroute'; data: ProcessedTraceroute };

/**
 * Message queue item with metadata
 */
export interface QueuedMessage {
  id: string; // Unique ID for deduplication
  data: ProcessedData;
  timestamp: number;
  retries: number;
}

/**
 * Worker configuration
 */
export interface WorkerConfig {
  broker: string;
  username?: string;
  password?: string;
  topic: string;
  useTLS?: boolean;
  clientId?: string;
  reconnectPeriod?: number;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  maxSize: number;
  dedupeWindowMs: number;
}

/**
 * Batch writer configuration
 */
export interface BatchWriterConfig {
  maxBatchSize: number;
  maxWaitMs: number;
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  maxUpdatesPerSecond: number;
  windowMs: number;
}

/**
 * Worker statistics
 */
export interface WorkerStats {
  connected: boolean;
  uptime: number;
  messagesReceived: number;
  messagesProcessed: number;
  messagesFailed: number;
  messagesDeduplicated: number;
  messagesRateLimited: number;
  queueDepth: number;
  queueSize: number;
  batchesWritten: number;
  lastMessageTime: number | null;
  avgProcessingTimeMs: number;
}

/**
 * Worker health status
 */
export interface WorkerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connected: boolean;
  queueDepth: number;
  queueUtilization: number; // 0-1
  lastMessageAge: number | null; // ms since last message
  issues: string[];
}

/**
 * Deduplication result
 */
export interface DedupeResult {
  isDuplicate: boolean;
  hash: string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  nodeId: string;
  timeUntilNext: number; // ms until next allowed
}

/**
 * Batch write result
 */
export interface BatchWriteResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: Error[];
}
