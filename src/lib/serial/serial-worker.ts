/**
 * Serial Worker
 *
 * Connects to a Meshtastic device via serial port,
 * receives FromRadio messages, and processes them
 * similar to how MQTT worker processes MQTT messages.
 */

import { SerialPort } from 'serialport';
import { getDatabase } from '@/lib/db';
import { BatchWriter } from '@/lib/worker/batch-writer';
import { getSSEBroadcaster } from '@/lib/sse';
import { SerialFrameAccumulator } from './serial-protocol';
import { decodeFromRadio, processFromRadioPacket, nodeNumToId } from './fromradio-decoder';
import type {
  NodeUpdate,
  PositionUpdate,
  TelemetryUpdate,
  MessageUpdate
} from '@/lib/websocket/protocol';
import type { ProcessedData } from '@/lib/worker/types';

export interface SerialWorkerConfig {
  port: string;
  baudRate?: number;
}

export interface SerialWorkerStats {
  messagesReceived: number;
  messagesProcessed: number;
  messagesFailed: number;
  lastMessageTime: number | null;
  myNodeNum: number | null;
  myNodeId: string | null;
  isConnected: boolean;
}

export class SerialWorker {
  private serialPort: SerialPort | null = null;
  private frameAccumulator: SerialFrameAccumulator;
  private writer: BatchWriter;
  private isShuttingDown = false;

  // Device info
  private myNodeNum: number | null = null;
  private myNodeId: string | null = null;
  private configComplete = false;

  // Statistics
  private stats: SerialWorkerStats = {
    messagesReceived: 0,
    messagesProcessed: 0,
    messagesFailed: 0,
    lastMessageTime: null,
    myNodeNum: null,
    myNodeId: null,
    isConnected: false,
  };

  constructor(private config: SerialWorkerConfig) {
    this.frameAccumulator = new SerialFrameAccumulator();

    const db = getDatabase();
    this.writer = new BatchWriter(db, {
      maxBatchSize: 100,
      maxWaitMs: 500,
    });
  }

  /**
   * Start the serial worker
   */
  async start(): Promise<void> {
    console.log('[Serial Worker] Starting...');
    console.log(`[Serial Worker] Port: ${this.config.port}`);
    console.log(`[Serial Worker] Baud Rate: ${this.config.baudRate || 115200}`);

    try {
      this.serialPort = new SerialPort({
        path: this.config.port,
        baudRate: this.config.baudRate || 115200,
        autoOpen: false,
      });

      // Set up event handlers
      this.serialPort.on('open', () => {
        console.log('[Serial Worker] ✅ Serial port opened');
        this.stats.isConnected = true;

        // Request config from device
        this.requestConfig();
      });

      this.serialPort.on('data', (data: Buffer) => {
        this.handleData(data);
      });

      this.serialPort.on('error', (error) => {
        console.error('[Serial Worker] ❌ Serial port error:', error);
        this.stats.isConnected = false;
      });

      this.serialPort.on('close', () => {
        console.log('[Serial Worker] Serial port closed');
        this.stats.isConnected = false;
      });

      // Open the port
      await new Promise<void>((resolve, reject) => {
        this.serialPort!.open((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

    } catch (error) {
      console.error('[Serial Worker] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop the serial worker
   */
  async stop(): Promise<void> {
    console.log('[Serial Worker] Stopping...');
    this.isShuttingDown = true;

    // Flush remaining data
    await this.writer.flush();

    // Close serial port
    if (this.serialPort?.isOpen) {
      await new Promise<void>((resolve) => {
        this.serialPort!.close(() => resolve());
      });
    }

    console.log('[Serial Worker] Stopped');
  }

  /**
   * Get worker statistics
   */
  getStats(): SerialWorkerStats {
    return {
      ...this.stats,
      myNodeNum: this.myNodeNum,
      myNodeId: this.myNodeId,
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.serialPort?.isOpen ?? false;
  }

  /**
   * Request config from device (sends want_config)
   */
  private requestConfig(): void {
    // Create ToRadio message with want_config_id
    // Field 3 = want_config_id (uint32)
    // Using a random nonce so we can match the response
    const nonce = Math.floor(Math.random() * 0xffffffff);

    // Simple protobuf encoding: field 3, varint
    // Tag = (3 << 3) | 0 = 24 = 0x18
    const payload = Buffer.alloc(5);
    payload[0] = 0x18; // field 3, varint

    // Encode nonce as varint
    let value = nonce;
    let pos = 1;
    while (value >= 0x80) {
      payload[pos++] = (value & 0x7f) | 0x80;
      value >>>= 7;
    }
    payload[pos++] = value;

    const toSend = payload.subarray(0, pos);

    // Frame it
    const frame = Buffer.alloc(4 + toSend.length);
    frame[0] = 0x94;
    frame[1] = 0xc3;
    frame[2] = (toSend.length >> 8) & 0xff;
    frame[3] = toSend.length & 0xff;
    toSend.copy(frame, 4);

    console.log(`[Serial Worker] Requesting config (nonce: ${nonce})`);
    this.serialPort?.write(frame);
  }

  /**
   * Handle incoming serial data
   */
  private handleData(data: Buffer): void {
    if (this.isShuttingDown) return;

    // Add data to frame accumulator
    const frames = this.frameAccumulator.addData(data);

    // Process complete frames
    for (const frame of frames) {
      this.stats.messagesReceived++;
      this.stats.lastMessageTime = Date.now();

      try {
        this.processFrame(frame);
      } catch (error) {
        console.error('[Serial Worker] Error processing frame:', error);
        this.stats.messagesFailed++;
      }
    }
  }

  /**
   * Process a complete protobuf frame
   */
  private processFrame(payload: Buffer): void {
    // Decode FromRadio message
    const fromRadio = decodeFromRadio(payload);

    if (!fromRadio) {
      console.log('[Serial Worker] Failed to decode FromRadio');
      return;
    }

    console.log(`[Serial Worker] FromRadio type: ${fromRadio.type}, id: ${fromRadio.id}`);

    // Handle special message types
    if (fromRadio.type === 'my_info' && fromRadio.myInfo) {
      this.myNodeNum = fromRadio.myInfo.myNodeNum;
      this.myNodeId = nodeNumToId(this.myNodeNum);
      console.log(`[Serial Worker] My node: ${this.myNodeId} (${this.myNodeNum})`);
    }

    if (fromRadio.type === 'config_complete') {
      this.configComplete = true;
      console.log('[Serial Worker] Config complete');
    }

    if (fromRadio.type === 'rebooted') {
      console.log('[Serial Worker] Device rebooted, requesting config...');
      this.configComplete = false;
      setTimeout(() => this.requestConfig(), 1000);
      return;
    }

    // Process the message into normalized format
    const processed = processFromRadioPacket(fromRadio);

    if (!processed) {
      return;
    }

    console.log(`[Serial Worker] Processing ${processed.type} message`);

    // Add to batch writer
    this.writer.add(processed as ProcessedData);
    this.stats.messagesProcessed++;

    // Broadcast to WebSocket clients
    this.broadcastUpdate(processed as ProcessedData);
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
            hopsAway: data.data.hopsAway,
          };
          broadcaster.queueNodeUpdate(nodeUpdate);
          break;
        }
        case 'position': {
          const posUpdate: PositionUpdate = {
            id: 0,
            nodeId: data.data.nodeId,
            latitude: data.data.position.latitude,
            longitude: data.data.position.longitude,
            altitude: data.data.position.altitude,
            timestamp: data.data.timestamp,
            snr: data.data.snr,
            rssi: data.data.rssi,
          };
          broadcaster.queuePositionUpdate(posUpdate);
          break;
        }
        case 'telemetry': {
          const telUpdate: TelemetryUpdate = {
            id: 0,
            nodeId: data.data.nodeId,
            timestamp: data.data.timestamp,
            batteryLevel: data.data.batteryLevel,
            voltage: data.data.voltage,
            channelUtilization: data.data.channelUtilization,
            airUtilTx: data.data.airUtilTx,
            uptime: data.data.uptime,
          };
          broadcaster.queueTelemetryUpdate(telUpdate);
          break;
        }
        case 'text':
        case 'message': {
          const msgUpdate: MessageUpdate = {
            id: 0,
            fromId: data.data.from,
            toId: data.data.to,
            channel: data.data.channel,
            text: data.data.text,
            timestamp: data.data.timestamp,
            snr: data.data.snr,
            rssi: data.data.rssi,
          };
          broadcaster.queueMessage(msgUpdate);
          break;
        }
      }
    } catch (error) {
      console.error('[Serial Worker] Error broadcasting update:', error);
    }
  }
}

// Singleton instance
let serialWorker: SerialWorker | null = null;

/**
 * Get or create the serial worker
 */
export function getSerialWorker(): SerialWorker | null {
  return serialWorker;
}

/**
 * Start the serial worker with given config
 */
export async function startSerialWorker(config: SerialWorkerConfig): Promise<SerialWorker> {
  if (serialWorker) {
    await serialWorker.stop();
  }

  serialWorker = new SerialWorker(config);
  await serialWorker.start();
  return serialWorker;
}

/**
 * Stop the serial worker
 */
export async function stopSerialWorker(): Promise<void> {
  if (serialWorker) {
    await serialWorker.stop();
    serialWorker = null;
  }
}

/**
 * List available serial ports
 */
export async function listSerialPorts(): Promise<Array<{
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  vendorId?: string;
  productId?: string;
}>> {
  const { SerialPort } = await import('serialport');
  const ports = await SerialPort.list();

  // Filter for likely Meshtastic devices (ESP32, nRF52, etc.)
  // Common vendor IDs:
  // - 0x10c4 (Silicon Labs CP210x - used by many ESP32 boards)
  // - 0x1a86 (CH340/CH341 - common USB-serial chips)
  // - 0x0403 (FTDI)
  // - 0x239a (Adafruit)
  // - 0x303a (Espressif ESP32-S2/S3)
  // - 0x1915 (Nordic Semiconductor - nRF52840)

  return ports.map(port => ({
    path: port.path,
    manufacturer: port.manufacturer,
    serialNumber: port.serialNumber,
    pnpId: port.pnpId,
    vendorId: port.vendorId,
    productId: port.productId,
  }));
}
