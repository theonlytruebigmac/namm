/**
 * Serial Message API
 *
 * Receives messages from Web Serial (browser) and stores them in the database.
 * Also broadcasts updates via WebSocket like MQTT does.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { NodeRepository } from '@/lib/db/repositories/nodes';
import { MessageRepository } from '@/lib/db/repositories/messages';
import { PositionRepository } from '@/lib/db/repositories/positions';
import { TelemetryRepository } from '@/lib/db/repositories/telemetry';
import type { ProcessedNodeInfo, ProcessedPosition, ProcessedTelemetry, ProcessedMessage } from '@/lib/mqtt-processor';
import { getBroadcaster } from '@/lib/websocket';

// Lazy-loaded repositories
let nodeRepo: NodeRepository | null = null;
let msgRepo: MessageRepository | null = null;
let posRepo: PositionRepository | null = null;
let telRepo: TelemetryRepository | null = null;

function getRepos() {
  if (!nodeRepo) {
    const db = getDatabase();
    nodeRepo = new NodeRepository(db);
    msgRepo = new MessageRepository(db);
    posRepo = new PositionRepository(db);
    telRepo = new TelemetryRepository(db);
  }
  return { nodeRepo, msgRepo: msgRepo!, posRepo: posRepo!, telRepo: telRepo! };
}

/**
 * Convert JSON-serialized Uint8Array back to Uint8Array
 * When Uint8Array is sent via JSON, it becomes {0: x, 1: y, ...} or an array
 */
function toUint8Array(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (Array.isArray(data)) {
    return new Uint8Array(data);
  }
  if (data && typeof data === 'object') {
    // Handle {0: x, 1: y, ...} format
    const values = Object.values(data as Record<string, number>);
    return new Uint8Array(values);
  }
  return new Uint8Array(0);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    console.log(`[Serial API] Received ${type} message`);

    switch (type) {
      case 'nodeInfo':
        await handleNodeInfo(data.nodeInfo);
        break;

      case 'packet':
        await handlePacket(data.packet);
        break;

      default:
        // Ignore other message types
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Serial API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}

async function handleNodeInfo(nodeInfo: Record<string, unknown>) {
  if (!nodeInfo?.num) return;

  const { nodeRepo } = getRepos();
  const num = nodeInfo.num as number;
  const user = nodeInfo.user as Record<string, unknown> | undefined;

  const nodeId = `!${num.toString(16).padStart(8, '0')}`;

  const nodeData: ProcessedNodeInfo = {
    id: nodeId,
    nodeNum: num,
    longName: (user?.longName as string) || '',
    shortName: (user?.shortName as string) || '',
    hwModel: String(user?.hwModel || 0),
    role: (user?.role as number) ?? 0,
    lastHeard: Date.now(),
  };

  nodeRepo.upsert(nodeData);

  // Broadcast to WebSocket clients
  const broadcaster = getBroadcaster();
  if (broadcaster) {
    broadcaster.queueNodeUpdate({
      id: nodeId,
      nodeNum: num,
      shortName: nodeData.shortName,
      longName: nodeData.longName,
      hwModel: nodeData.hwModel,
      role: nodeData.role,
      lastHeard: nodeData.lastHeard,
    });
  }

  console.log(`[Serial API] Stored node: ${nodeId}`);
}

async function handlePacket(packet: Record<string, unknown>) {
  if (!packet?.from) return;

  const from = packet.from as number;
  const nodeId = `!${from.toString(16).padStart(8, '0')}`;
  const decoded = packet.decoded as Record<string, unknown> | undefined;

  if (!decoded) return;

  const portnum = decoded.portnum as number;

  switch (portnum) {
    case 1: // TEXT_MESSAGE_APP
      await handleTextMessage(nodeId, packet, decoded);
      break;

    case 3: // POSITION_APP
      await handlePosition(nodeId, packet, decoded);
      break;

    case 67: // TELEMETRY_APP
      await handleTelemetry(nodeId, packet, decoded);
      break;
  }
}

async function handleTextMessage(
  nodeId: string,
  packet: Record<string, unknown>,
  decoded: Record<string, unknown>
) {
  const { msgRepo } = getRepos();
  const rawPayload = decoded.payload;

  if (!rawPayload) return;

  const payload = toUint8Array(rawPayload);
  const text = new TextDecoder().decode(payload);
  const to = packet.to as number;
  const toNodeId = to === 0xffffffff ? 'broadcast' : `!${to.toString(16).padStart(8, '0')}`;

  const msgData: ProcessedMessage = {
    id: packet.id as number,
    from: nodeId,
    to: toNodeId,
    channel: (packet.channel as number) || 0,
    text,
    timestamp: Date.now(),
    snr: packet.rxSnr as number | undefined,
    rssi: packet.rxRssi as number | undefined,
  };

  msgRepo.insert(msgData);

  // Broadcast to WebSocket clients
  const broadcaster = getBroadcaster();
  if (broadcaster) {
    broadcaster.queueMessage({
      id: msgData.id,
      fromId: msgData.from,
      toId: msgData.to,
      channel: msgData.channel,
      text: msgData.text,
      timestamp: msgData.timestamp,
      snr: msgData.snr,
      rssi: msgData.rssi,
    });
  }

  console.log(`[Serial API] Stored message from ${nodeId}: ${text.substring(0, 50)}`);
}

async function handlePosition(
  nodeId: string,
  packet: Record<string, unknown>,
  decoded: Record<string, unknown>
) {
  const { posRepo } = getRepos();
  const rawPayload = decoded.payload;

  if (!rawPayload) return;

  // Decode position from payload (simplified)
  const payload = toUint8Array(rawPayload);
  const position = decodePosition(payload);
  if (!position.latitude || !position.longitude) return;

  const from = packet.from as number;
  const posData: ProcessedPosition = {
    nodeId,
    nodeNum: from,
    position: {
      latitude: position.latitude,
      longitude: position.longitude,
      altitude: position.altitude,
    },
    timestamp: Date.now(),
    snr: packet.rxSnr as number | undefined,
    rssi: packet.rxRssi as number | undefined,
  };

  posRepo.insert(posData);

  // Broadcast to WebSocket clients
  const broadcaster = getBroadcaster();
  if (broadcaster) {
    broadcaster.queuePositionUpdate({
      id: 0, // Will be assigned by DB
      nodeId,
      latitude: position.latitude,
      longitude: position.longitude,
      altitude: position.altitude,
      timestamp: posData.timestamp,
    });
  }

  console.log(`[Serial API] Stored position for ${nodeId}`);
}

async function handleTelemetry(
  nodeId: string,
  packet: Record<string, unknown>,
  decoded: Record<string, unknown>
) {
  const { telRepo } = getRepos();
  const rawPayload = decoded.payload;

  if (!rawPayload) return;

  // Decode telemetry from payload (simplified)
  const payload = toUint8Array(rawPayload);
  const telemetry = decodeTelemetry(payload);
  const from = packet.from as number;

  const telData: ProcessedTelemetry = {
    nodeId,
    nodeNum: from,
    timestamp: Date.now(),
    batteryLevel: telemetry.batteryLevel,
    voltage: telemetry.voltage,
    channelUtilization: telemetry.channelUtilization,
    airUtilTx: telemetry.airUtilTx,
    uptime: telemetry.uptimeSeconds,
    snr: packet.rxSnr as number | undefined,
    rssi: packet.rxRssi as number | undefined,
  };

  telRepo.insert(telData);

  // Broadcast to WebSocket clients
  const broadcaster = getBroadcaster();
  if (broadcaster) {
    broadcaster.queueTelemetryUpdate({
      id: 0, // Will be assigned by DB
      nodeId,
      timestamp: telData.timestamp,
      batteryLevel: telData.batteryLevel,
      voltage: telData.voltage,
      channelUtilization: telData.channelUtilization,
      airUtilTx: telData.airUtilTx,
      uptime: telData.uptime,
    });
  }

  console.log(`[Serial API] Stored telemetry for ${nodeId}`);
}

function decodePosition(data: Uint8Array): { latitude?: number; longitude?: number; altitude?: number } {
  const result: { latitude?: number; longitude?: number; altitude?: number } = {};
  let offset = 0;

  while (offset < data.length) {
    const tag = data[offset++];
    const fieldNum = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 5) {
      // sfixed32
      if (offset + 4 <= data.length) {
        const value = data[offset] | (data[offset + 1] << 8) |
                     (data[offset + 2] << 16) | (data[offset + 3] << 24);
        offset += 4;

        if (fieldNum === 1) result.latitude = value / 1e7;
        if (fieldNum === 2) result.longitude = value / 1e7;
        if (fieldNum === 3) result.altitude = value;
      }
    } else if (wireType === 0) {
      // varint - skip
      while (offset < data.length && (data[offset++] & 0x80)) {}
    } else if (wireType === 2) {
      // length-delimited - skip
      let len = 0;
      let shift = 0;
      while (offset < data.length) {
        const byte = data[offset++];
        len |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
      }
      offset += len;
    } else {
      break;
    }
  }

  return result;
}

function decodeTelemetry(data: Uint8Array): {
  batteryLevel?: number;
  voltage?: number;
  channelUtilization?: number;
  airUtilTx?: number;
  uptimeSeconds?: number;
} {
  const result: {
    batteryLevel?: number;
    voltage?: number;
    channelUtilization?: number;
    airUtilTx?: number;
    uptimeSeconds?: number;
  } = {};

  let offset = 0;

  while (offset < data.length) {
    const tag = data[offset++];
    const fieldNum = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 0) {
      // varint
      let value = 0;
      let shift = 0;
      while (offset < data.length) {
        const byte = data[offset++];
        value |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
      }

      // Device metrics are in a sub-message, but simplified here
      if (fieldNum === 1) result.batteryLevel = value;
      if (fieldNum === 4) result.uptimeSeconds = value;
    } else if (wireType === 5) {
      // float
      if (offset + 4 <= data.length) {
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        view.setUint8(0, data[offset]);
        view.setUint8(1, data[offset + 1]);
        view.setUint8(2, data[offset + 2]);
        view.setUint8(3, data[offset + 3]);
        const value = view.getFloat32(0, true);
        offset += 4;

        if (fieldNum === 2) result.voltage = value;
        if (fieldNum === 3) result.channelUtilization = value;
        if (fieldNum === 5) result.airUtilTx = value;
      }
    } else if (wireType === 2) {
      // length-delimited - this contains the actual device metrics
      let len = 0;
      let shift = 0;
      while (offset < data.length) {
        const byte = data[offset++];
        len |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
      }

      // Recursively decode sub-message for device metrics
      if (fieldNum === 2) {
        const subResult = decodeTelemetry(data.slice(offset, offset + len));
        Object.assign(result, subResult);
      }
      offset += len;
    } else {
      break;
    }
  }

  return result;
}
