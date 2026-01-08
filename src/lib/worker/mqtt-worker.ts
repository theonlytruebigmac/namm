/**
 * MQTT Worker
 *
 * Long-running worker that subscribes to MQTT broker,
 * processes messages, and writes to database
 */

import mqtt from 'mqtt';
import { getDatabase } from '@/lib/db';
import { processMQTTMessage, setChannelPersistCallback, loadChannelMappings } from '@/lib/mqtt-processor';
import { MessageQueue } from './message-queue';
import { BatchWriter } from './batch-writer';
import { Deduplicator } from './deduplicator';
import { RateLimiter } from './rate-limiter';
import { getSSEBroadcaster } from '@/lib/sse';
import { ChannelRepository } from '@/lib/db/repositories/channels';
import { TracerouteRepository } from '@/lib/db/repositories/traceroutes';
import { getPCAPWriter, type PacketMetadata } from '@/lib/pcap/pcap-writer';
import type {
  NodeUpdate,
  PositionUpdate,
  TelemetryUpdate,
  MessageUpdate
} from '@/lib/websocket/protocol';
import type {
  WorkerConfig,
  WorkerStats,
  WorkerHealth,
  ProcessedData
} from './types';

export class MQTTWorker {
  private client: mqtt.MqttClient | null = null;
  private queue: MessageQueue;
  private writer: BatchWriter;
  private rateLimiter: RateLimiter;
  private channelRepo: ChannelRepository;
  private tracerouteRepo: TracerouteRepository;
  private isShuttingDown = false;
  private startTime = Date.now();

  // Processing intervals
  private queueProcessorInterval: NodeJS.Timeout | null = null;

  // Statistics
  private stats = {
    messagesReceived: 0,
    messagesProcessed: 0,
    messagesFailed: 0,
    messagesDeduplicated: 0,
    messagesRateLimited: 0,
    lastMessageTime: null as number | null,
    processingTimes: [] as number[]
  };

  constructor(private config: WorkerConfig) {
    // Initialize queue with deduplication
    this.queue = new MessageQueue({
      maxSize: 10000,
      dedupeWindowMs: 60000
    });

    // Initialize batch writer
    const db = getDatabase();
    this.writer = new BatchWriter(db, {
      maxBatchSize: 100,
      maxWaitMs: 500
    });

    // Initialize rate limiter (1 update per node per second)
    this.rateLimiter = new RateLimiter({
      maxUpdatesPerSecond: 1,
      windowMs: 1000
    });

    // Initialize channel repository and set up persistence callback
    this.channelRepo = new ChannelRepository(db);

    // Initialize traceroute repository
    this.tracerouteRepo = new TracerouteRepository(db);

    // Load existing channel mappings from database
    const existingChannels = this.channelRepo.getAll();
    if (existingChannels.length > 0) {
      loadChannelMappings(existingChannels.map(c => ({ name: c.name, index: c.id })));
    }

    // Set up callback to persist new channel mappings
    setChannelPersistCallback((name: string, index: number) => {
      this.channelRepo.upsert(index, name);
    });
  }

  /**
   * Start the MQTT worker
   */
  async start(): Promise<void> {
    console.log('Starting MQTT Worker...');
    console.log('Broker:', this.config.broker);
    console.log('Topic:', this.config.topic);

    // Connect to MQTT broker
    this.client = mqtt.connect(this.config.broker, {
      username: this.config.username,
      password: this.config.password,
      clientId: this.config.clientId || `namm-worker-${Date.now()}`,
      clean: true,
      reconnectPeriod: this.config.reconnectPeriod || 5000,
      connectTimeout: 30000
    });

    // Set up event handlers
    this.client.on('connect', () => {
      console.log('✓ MQTT Worker connected');
      this.subscribeToTopic();
    });

    this.client.on('reconnect', () => {
      console.log('MQTT Worker reconnecting...');
    });

    this.client.on('error', (error) => {
      console.error('MQTT Worker error:', error);
    });

    this.client.on('offline', () => {
      console.log('MQTT Worker offline');
    });

    this.client.on('message', (topic, payload) => {
      this.handleMessage(topic, payload);
    });

    // Start queue processor
    this.startQueueProcessor();
  }

  /**
   * Subscribe to MQTT topic
   */
  private subscribeToTopic(): void {
    if (!this.client) return;

    this.client.subscribe(this.config.topic, (err) => {
      if (err) {
        console.error('Failed to subscribe to topic:', err);
      } else {
        console.log('✓ Subscribed to:', this.config.topic);
      }
    });
  }

  /**
   * Handle incoming MQTT message
   */
  private handleMessage(topic: string, payload: Buffer): void {
    if (this.isShuttingDown) return;

    const startTime = Date.now();
    this.stats.messagesReceived++;
    this.stats.lastMessageTime = Date.now();

    try {
      // Write to PCAP if capture is active
      this.writeToPCAP(topic, payload);

      // For encrypted messages (/e/ topic), pass raw Buffer to preserve binary data
      // For other messages (JSON), convert to string
      const isEncrypted = topic.includes('/e/');
      const messagePayload = isEncrypted ? payload : payload.toString();

      // Parse MQTT message
      const result = processMQTTMessage(topic, messagePayload);
      if (!result) {
        // Unknown or unparseable message
        return;
      }

      // Broadcast raw MQTT packet for live stream view
      // Do this early so all packets show in the stream regardless of processing
      const broadcaster = getSSEBroadcaster();
      if (broadcaster) {
        // Extract nodeId for the packet
        let nodeId: string | undefined;
        if ('data' in result && result.data) {
          const d = result.data as Record<string, unknown>;
          nodeId = (d.id as string) || (d.nodeId as string) || (d.from as string);
        }
        broadcaster.queueMQTTRaw(
          topic,
          payload.toString('base64'),
          result.type,
          nodeId,
          'data' in result ? result.data : undefined
        );
      }

      // Extract processed data - only process messages with data
      if (!('data' in result) || !result.data) {
        // Log unsupported message types for debugging (sample every 10th)
        if (result.type !== 'encrypted' && this.stats.messagesReceived % 10 === 0) {
          console.log(`[MQTT Worker] Skipping ${result.type} message from ${topic}`);
        }
        return;
      }

      // Log message type for debugging (first 10 of each type)
      if (this.stats.messagesProcessed < 10 || this.stats.messagesProcessed % 100 === 0) {
        console.log(`[MQTT Worker] Processing ${result.type} message`);
      }

      // At this point, result has the shape of ProcessedData
      const data = result as ProcessedData;

      // Check for duplicates
      const queueId = Deduplicator.generateQueueId(data);
      if (this.queue.isDuplicate(queueId)) {
        this.stats.messagesDeduplicated++;
        return;
      }

      // Check rate limit
      const rateLimit = this.rateLimiter.checkLimit(data);
      if (!rateLimit.allowed) {
        this.stats.messagesRateLimited++;
        return;
      }

      // Enqueue message
      const enqueued = this.queue.enqueue(queueId, data);
      if (!enqueued) {
        this.stats.messagesFailed++;
        console.warn('Queue full, message dropped');
      }

      // Track processing time
      const processingTime = Date.now() - startTime;
      this.stats.processingTimes.push(processingTime);
      if (this.stats.processingTimes.length > 1000) {
        this.stats.processingTimes.shift(); // Keep last 1000
      }
    } catch (error) {
      this.stats.messagesFailed++;
      console.error('Error handling MQTT message:', error);
    }
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    this.queueProcessorInterval = setInterval(() => {
      if (this.isShuttingDown) return;

      const depth = this.queue.getDepth();
      if (depth === 0) return;

      // Dequeue batch
      const batchSize = Math.min(100, depth);
      const batch = this.queue.dequeue(batchSize);

      // Write to database via batch writer and broadcast to WebSocket clients
      for (const message of batch) {
        this.writer.add(message.data);
        this.stats.messagesProcessed++;

        // Broadcast to WebSocket clients
        this.broadcastUpdate(message.data);
      }
    }, 500); // Process every 500ms
  }

  /**
   * Stop queue processor
   */
  private stopQueueProcessor(): void {
    if (this.queueProcessorInterval) {
      clearInterval(this.queueProcessorInterval);
      this.queueProcessorInterval = null;
    }
  }

  /**
   * Broadcast update to WebSocket clients
   */
  private broadcastUpdate(data: ProcessedData): void {
    const broadcaster = getSSEBroadcaster();
    if (!broadcaster) return;

    try {
      switch (data.type) {
        case 'nodeinfo': {
          const nodeUpdate: NodeUpdate = {
            id: data.data.id,
            nodeNum: data.data.nodeNum,
            shortName: data.data.shortName,
            longName: data.data.longName,
            hwModel: data.data.hwModel,
            role: data.data.role,
            lastHeard: data.data.lastHeard,
            hopsAway: data.data.hopsAway
          };
          broadcaster.queueNodeUpdate(nodeUpdate);
          break;
        }
        case 'position': {
          const posUpdate: PositionUpdate = {
            id: 0, // Will be assigned by DB
            nodeId: data.data.nodeId,
            latitude: data.data.position.latitude,
            longitude: data.data.position.longitude,
            altitude: data.data.position.altitude,
            timestamp: data.data.timestamp,
            snr: data.data.snr,
            rssi: data.data.rssi
          };
          broadcaster.queuePositionUpdate(posUpdate);
          break;
        }
        case 'telemetry': {
          const telUpdate: TelemetryUpdate = {
            id: 0, // Will be assigned by DB
            nodeId: data.data.nodeId,
            timestamp: data.data.timestamp,
            batteryLevel: data.data.batteryLevel,
            voltage: data.data.voltage,
            channelUtilization: data.data.channelUtilization,
            airUtilTx: data.data.airUtilTx,
            uptime: data.data.uptime
          };
          broadcaster.queueTelemetryUpdate(telUpdate);
          break;
        }
        case 'message': {
          const msgUpdate: MessageUpdate = {
            id: 0, // Will be assigned by DB
            fromId: data.data.from,
            toId: data.data.to,
            channel: data.data.channel,
            text: data.data.text,
            timestamp: data.data.timestamp,
            snr: data.data.snr,
            rssi: data.data.rssi
          };
          broadcaster.queueMessage(msgUpdate);
          break;
        }
        case 'traceroute': {
          // Save traceroute to database
          const tracerouteData = data.data;
          if (tracerouteData && tracerouteData.route && tracerouteData.route.length > 0) {
            try {
              this.tracerouteRepo.insert({
                fromId: tracerouteData.fromId,
                toId: tracerouteData.toId,
                timestamp: tracerouteData.timestamp,
                route: tracerouteData.route,
                routeBack: tracerouteData.routeBack,
                snrTowards: tracerouteData.snrTowards,
                snrBack: tracerouteData.snrBack,
                hops: tracerouteData.hops,
                success: tracerouteData.success,
                latencyMs: tracerouteData.latencyMs
              });
              console.log(`[MQTT Worker] Saved traceroute: ${tracerouteData.fromId} -> ${tracerouteData.toId} (${tracerouteData.hops} hops)`);
            } catch (err) {
              console.error('[MQTT Worker] Failed to save traceroute:', err);
            }
          }
          break;
        }
      }
    } catch (error) {
      console.error('Error broadcasting update:', error);
    }
  }

  /**
   * Publish a message to the MQTT broker
   *
   * @param topic - The MQTT topic to publish to
   * @param payload - The message payload (Buffer)
   * @returns Promise that resolves when publish is acknowledged
   */
  async publish(topic: string, payload: Buffer): Promise<boolean> {
    if (!this.client || !this.client.connected) {
      console.error('[MQTT Worker] Cannot publish: not connected');
      return false;
    }

    return new Promise((resolve) => {
      this.client!.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) {
          console.error('[MQTT Worker] Publish error:', err);
          resolve(false);
        } else {
          console.log(`[MQTT Worker] Published ${payload.length} bytes to ${topic}`);
          resolve(true);
        }
      });
    });
  }

  /**
   * Get MQTT client for direct access (use with caution)
   */
  getClient(): mqtt.MqttClient | null {
    return this.client;
  }

  /**
   * Shutdown the worker gracefully
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    console.log('Shutting down MQTT Worker...');
    this.isShuttingDown = true;

    // Stop processing new messages
    this.stopQueueProcessor();

    // Process remaining queue
    const remaining = this.queue.getDepth();
    if (remaining > 0) {
      console.log(`Processing ${remaining} remaining messages...`);
      const batch = this.queue.dequeue(remaining);
      for (const message of batch) {
        this.writer.add(message.data);
      }
    }

    // Flush writer
    await this.writer.shutdown();

    // Disconnect MQTT
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }

    console.log('✓ MQTT Worker shutdown complete');
  }

  /**
   * Get worker statistics
   */
  getStats(): WorkerStats {
    const uptime = Date.now() - this.startTime;
    const avgProcessingTime =
      this.stats.processingTimes.length > 0
        ? this.stats.processingTimes.reduce((a, b) => a + b, 0) /
          this.stats.processingTimes.length
        : 0;

    return {
      connected: this.client?.connected || false,
      uptime,
      messagesReceived: this.stats.messagesReceived,
      messagesProcessed: this.stats.messagesProcessed,
      messagesFailed: this.stats.messagesFailed,
      messagesDeduplicated: this.stats.messagesDeduplicated,
      messagesRateLimited: this.stats.messagesRateLimited,
      queueDepth: this.queue.getDepth(),
      queueSize: this.queue.getStats().maxSize,
      batchesWritten: this.writer.getStats().batchesWritten,
      lastMessageTime: this.stats.lastMessageTime,
      avgProcessingTimeMs: avgProcessingTime
    };
  }

  /**
   * Get worker health status
   */
  getHealth(): WorkerHealth {
    const stats = this.getStats();
    const queueUtilization = this.queue.getUtilization();
    const issues: string[] = [];

    // Check connection
    if (!stats.connected) {
      issues.push('Not connected to MQTT broker');
    }

    // Check queue depth
    if (queueUtilization > 0.9) {
      issues.push(`Queue at ${(queueUtilization * 100).toFixed(1)}% capacity`);
    }

    // Check message age
    const lastMessageAge = stats.lastMessageTime
      ? Date.now() - stats.lastMessageTime
      : null;
    if (lastMessageAge && lastMessageAge > 300000) {
      // 5 minutes
      issues.push('No messages received in 5+ minutes');
    }

    // Check batch writer
    if (!this.writer.isHealthy()) {
      issues.push('Batch writer degraded');
    }

    // Determine status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (issues.length === 0) {
      status = 'healthy';
    } else if (issues.length === 1 || stats.connected) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      connected: stats.connected,
      queueDepth: stats.queueDepth,
      queueUtilization,
      lastMessageAge,
      issues
    };
  }

  /**
   * Check if worker is connected
   */
  isConnected(): boolean {
    return this.client?.connected || false;
  }

  /**
   * Write packet to PCAP capture if active
   */
  private writeToPCAP(topic: string, payload: Buffer): void {
    try {
      const pcapWriter = getPCAPWriter();
      const session = pcapWriter.getSession();

      if (!session || session.status !== 'active') {
        return;
      }

      // Extract metadata from topic: msh/US/KY/2/e/LongFast/!abcd1234
      const parts = topic.split('/');
      const nodeId = parts[parts.length - 1] || 'unknown';
      const channelName = parts[parts.length - 2] || 'unknown';

      // Create packet metadata
      // We don't know the exact portnum until decoded, so use 0
      const metadata: PacketMetadata = {
        timestamp: Date.now(),
        nodeId,
        channel: 0, // Channel index not directly available from topic
        portnum: 0, // Will be decoded later
      };

      pcapWriter.writePacket(payload, metadata);
    } catch {
      // Silently fail PCAP writes to not affect message processing
    }
  }
}

// Singleton instance
let worker: MQTTWorker | null = null;

/**
 * Get or create MQTT worker instance
 */
export function getMQTTWorker(config?: WorkerConfig): MQTTWorker {
  if (!worker && config) {
    worker = new MQTTWorker(config);
  }
  if (!worker) {
    throw new Error('MQTT Worker not initialized. Provide config on first call.');
  }
  return worker;
}

/**
 * Shutdown and reset worker singleton
 */
export async function shutdownMQTTWorker(): Promise<void> {
  if (worker) {
    await worker.shutdown();
    worker = null;
  }
}
