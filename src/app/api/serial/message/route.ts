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
import { TracerouteRepository } from '@/lib/db/repositories/traceroutes';
import { WaypointRepository, type ProcessedWaypoint } from '@/lib/db/repositories/waypoints';
import { NeighborRepository } from '@/lib/db/repositories/neighbors';
import { RoutingRepository } from '@/lib/db/repositories/routing';
import type { ProcessedNodeInfo, ProcessedPosition, ProcessedTelemetry, ProcessedMessage } from '@/lib/mqtt-processor';
import type { ProcessedTraceroute } from '@/types/extended-packets';
import { getSSEBroadcaster } from '@/lib/sse';

// Port numbers for Meshtastic apps
const PORTNUM = {
  TEXT_MESSAGE_APP: 1,
  POSITION_APP: 3,
  NODEINFO_APP: 4,
  ROUTING_APP: 5,
  WAYPOINT_APP: 8,
  TELEMETRY_APP: 67,
  TRACEROUTE_APP: 70,
  NEIGHBORINFO_APP: 71,
} as const;

// Lazy-loaded repositories
let nodeRepo: NodeRepository | null = null;
let msgRepo: MessageRepository | null = null;
let posRepo: PositionRepository | null = null;
let telRepo: TelemetryRepository | null = null;
let traceRepo: TracerouteRepository | null = null;
let waypointRepo: WaypointRepository | null = null;
let neighborRepo: NeighborRepository | null = null;
let routingRepo: RoutingRepository | null = null;

function getRepos() {
  if (!nodeRepo) {
    const db = getDatabase();
    nodeRepo = new NodeRepository(db);
    msgRepo = new MessageRepository(db);
    posRepo = new PositionRepository(db);
    telRepo = new TelemetryRepository(db);
    traceRepo = new TracerouteRepository(db);
    waypointRepo = new WaypointRepository(db);
    neighborRepo = new NeighborRepository(db);
    routingRepo = new RoutingRepository(db);
  }
  return {
    nodeRepo,
    msgRepo: msgRepo!,
    posRepo: posRepo!,
    telRepo: telRepo!,
    traceRepo: traceRepo!,
    waypointRepo: waypointRepo!,
    neighborRepo: neighborRepo!,
    routingRepo: routingRepo!,
  };
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
      case 'myInfo':
        await handleMyInfo(data.myInfo);
        break;

      case 'nodeInfo':
        await handleNodeInfo(data.nodeInfo);
        break;

      case 'metadata':
        await handleMetadata(data.metadata);
        break;

      case 'packet':
        await handlePacket(data.packet);
        break;

      default:
        // Log but don't error on unknown types
        console.log(`[Serial API] Ignoring ${type} message`);
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

async function handleMyInfo(myInfo: Record<string, unknown>) {
  if (!myInfo?.myNodeNum) return;

  const { nodeRepo } = getRepos();
  const num = myInfo.myNodeNum as number;
  const nodeId = `!${(num >>> 0).toString(16).padStart(8, '0')}`;

  // Create or update our own node entry
  const nodeData: ProcessedNodeInfo = {
    id: nodeId,
    nodeNum: num,
    longName: '',
    shortName: '',
    hwModel: '0',
    role: 0,
    lastHeard: Date.now(),
  };

  nodeRepo.upsert(nodeData);

  console.log(`[Serial API] My node: ${nodeId}`);
}

async function handleMetadata(metadata: Record<string, unknown>) {
  if (!metadata) return;

  // Log device metadata for debugging
  console.log(`[Serial API] Device metadata:`, {
    firmware: metadata.firmwareVersionString,
    hasWifi: metadata.hasWifi,
    hasBluetooth: metadata.hasBluetooth,
    role: metadata.role,
    hwModel: metadata.hwModel,
  });

  // In the future, this could be stored in a device_info table or settings
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
  const broadcaster = getSSEBroadcaster();
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
    case PORTNUM.TEXT_MESSAGE_APP:
      await handleTextMessage(nodeId, packet, decoded);
      break;

    case PORTNUM.POSITION_APP:
      await handlePosition(nodeId, packet, decoded);
      break;

    case PORTNUM.NODEINFO_APP:
      await handleNodeInfoPacket(nodeId, packet, decoded);
      break;

    case PORTNUM.ROUTING_APP:
      await handleRouting(nodeId, packet, decoded);
      break;

    case PORTNUM.TELEMETRY_APP:
      await handleTelemetry(nodeId, packet, decoded);
      break;

    case PORTNUM.TRACEROUTE_APP:
      await handleTraceroute(nodeId, packet, decoded);
      break;

    case PORTNUM.NEIGHBORINFO_APP:
      await handleNeighborInfo(nodeId, packet, decoded);
      break;

    case PORTNUM.WAYPOINT_APP:
      await handleWaypoint(nodeId, packet, decoded);
      break;

    default:
      console.log(`[Serial API] Unhandled portnum ${portnum} from ${nodeId}`);
      break;
  }
}

async function handleTextMessage(
  nodeId: string,
  packet: Record<string, unknown>,
  decoded: Record<string, unknown>
) {
  const { nodeRepo, msgRepo } = getRepos();
  const rawPayload = decoded.payload;

  if (!rawPayload) return;

  const payload = toUint8Array(rawPayload);
  const text = new TextDecoder().decode(payload);
  const from = packet.from as number;
  const to = packet.to as number;
  const toNodeId = to === 0xffffffff ? 'broadcast' : `!${to.toString(16).padStart(8, '0')}`;

  // Ensure sender node exists before inserting message (foreign key constraint)
  nodeRepo.upsert({
    id: nodeId,
    nodeNum: from,
    longName: '',
    shortName: '',
    hwModel: '0',
    role: 0,
    lastHeard: Date.now(),
  });

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
  const broadcaster = getSSEBroadcaster();
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
  const { nodeRepo, posRepo } = getRepos();
  const rawPayload = decoded.payload;

  if (!rawPayload) return;

  // Decode position from payload (simplified)
  const payload = toUint8Array(rawPayload);
  const position = decodePosition(payload);
  if (!position.latitude || !position.longitude) return;

  const from = packet.from as number;

  // Ensure node exists before inserting position (foreign key constraint)
  nodeRepo.upsert({
    id: nodeId,
    nodeNum: from,
    longName: '',
    shortName: '',
    hwModel: '0',
    role: 0,
    lastHeard: Date.now(),
  });

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
  const broadcaster = getSSEBroadcaster();
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
  const { nodeRepo, telRepo } = getRepos();
  const rawPayload = decoded.payload;

  if (!rawPayload) return;

  // Decode telemetry from payload (simplified)
  const payload = toUint8Array(rawPayload);
  const telemetry = decodeTelemetry(payload);
  const from = packet.from as number;

  // Ensure node exists before inserting telemetry (foreign key constraint)
  nodeRepo.upsert({
    id: nodeId,
    nodeNum: from,
    longName: '',
    shortName: '',
    hwModel: '0',
    role: 0,
    lastHeard: Date.now(),
  });

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
  const broadcaster = getSSEBroadcaster();
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

      // Top-level: field 1 = time (fixed32 typically, but can be varint)
      // Device metrics fields (when decoded recursively):
      if (fieldNum === 1) result.batteryLevel = value;
      if (fieldNum === 5) result.uptimeSeconds = value;
    } else if (wireType === 5) {
      // float (fixed32)
      if (offset + 4 <= data.length) {
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        view.setUint8(0, data[offset]);
        view.setUint8(1, data[offset + 1]);
        view.setUint8(2, data[offset + 2]);
        view.setUint8(3, data[offset + 3]);
        const value = view.getFloat32(0, true);
        offset += 4;

        // Device metrics fields:
        // field 2 = voltage, field 3 = channelUtilization, field 4 = airUtilTx
        if (fieldNum === 2) result.voltage = value;
        if (fieldNum === 3) result.channelUtilization = value;
        if (fieldNum === 4) result.airUtilTx = value;
      }
    } else if (wireType === 2) {
      // length-delimited - contains embedded messages
      let len = 0;
      let shift = 0;
      while (offset < data.length) {
        const byte = data[offset++];
        len |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
      }

      // Field 2 = deviceMetrics, Field 3 = environmentMetrics
      // Recursively decode the device metrics sub-message
      if (fieldNum === 2) {
        const subResult = decodeDeviceMetrics(data.slice(offset, offset + len));
        Object.assign(result, subResult);
      }
      offset += len;
    } else {
      break;
    }
  }

  return result;
}

/**
 * Decode DeviceMetrics sub-message
 * Field mapping:
 *   1: batteryLevel (uint32)
 *   2: voltage (float)
 *   3: channelUtilization (float)
 *   4: airUtilTx (float)
 *   5: uptimeSeconds (uint32)
 */
function decodeDeviceMetrics(data: Uint8Array): {
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

      if (fieldNum === 1) result.batteryLevel = value;
      if (fieldNum === 5) result.uptimeSeconds = value;
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
        if (fieldNum === 4) result.airUtilTx = value;
      }
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

/**
 * Handle NodeInfo packet (portnum 4)
 * This is when a node broadcasts its user info via a mesh packet
 */
async function handleNodeInfoPacket(
  nodeId: string,
  packet: Record<string, unknown>,
  decoded: Record<string, unknown>
) {
  const { nodeRepo } = getRepos();
  const rawPayload = decoded.payload;

  if (!rawPayload) return;

  const payload = toUint8Array(rawPayload);
  const user = decodeUser(payload);
  const from = packet.from as number;

  const nodeData: ProcessedNodeInfo = {
    id: nodeId,
    nodeNum: from,
    longName: user.longName || '',
    shortName: user.shortName || '',
    hwModel: String(user.hwModel || 0),
    role: user.role ?? 0,
    lastHeard: Date.now(),
  };

  nodeRepo.upsert(nodeData);

  // Broadcast to WebSocket clients
  const broadcaster = getSSEBroadcaster();
  if (broadcaster) {
    broadcaster.queueNodeUpdate({
      id: nodeId,
      nodeNum: from,
      shortName: nodeData.shortName,
      longName: nodeData.longName,
      hwModel: nodeData.hwModel,
      role: nodeData.role,
      lastHeard: nodeData.lastHeard,
    });
  }

  console.log(`[Serial API] Stored nodeinfo packet from ${nodeId}: ${user.longName}`);
}

/**
 * Decode User protobuf from NodeInfo packet payload
 */
function decodeUser(data: Uint8Array): {
  id?: string;
  longName?: string;
  shortName?: string;
  hwModel?: number;
  role?: number;
} {
  const result: {
    id?: string;
    longName?: string;
    shortName?: string;
    hwModel?: number;
    role?: number;
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

      if (fieldNum === 5) result.hwModel = value;
      if (fieldNum === 7) result.role = value;
    } else if (wireType === 2) {
      // length-delimited (string or bytes)
      let len = 0;
      let shift = 0;
      while (offset < data.length) {
        const byte = data[offset++];
        len |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
      }

      const strData = data.slice(offset, offset + len);
      offset += len;

      if (fieldNum === 1) result.id = new TextDecoder().decode(strData);
      if (fieldNum === 2) result.longName = new TextDecoder().decode(strData);
      if (fieldNum === 3) result.shortName = new TextDecoder().decode(strData);
    } else if (wireType === 5) {
      // fixed32 - skip
      offset += 4;
    } else {
      break;
    }
  }

  return result;
}

/**
 * Handle Traceroute packet (portnum 70)
 */
async function handleTraceroute(
  nodeId: string,
  packet: Record<string, unknown>,
  decoded: Record<string, unknown>
) {
  const { nodeRepo, traceRepo } = getRepos();
  const rawPayload = decoded.payload;

  if (!rawPayload) return;

  const payload = toUint8Array(rawPayload);
  const traceroute = decodeTraceroutePayload(payload);
  const from = packet.from as number;
  const to = packet.to as number;
  const toId = to === 0xffffffff ? 'broadcast' : `!${(to >>> 0).toString(16).padStart(8, '0')}`;

  // Ensure source node exists
  nodeRepo.upsert({
    id: nodeId,
    nodeNum: from,
    longName: '',
    shortName: '',
    hwModel: '0',
    role: 0,
    lastHeard: Date.now(),
  });

  const traceData: ProcessedTraceroute = {
    fromId: nodeId,
    toId: toId,
    timestamp: Date.now(),
    route: traceroute.route || [],
    routeBack: traceroute.routeBack,
    snrTowards: traceroute.snrTowards,
    snrBack: traceroute.snrBack,
    hops: (traceroute.route || []).length,
    success: true,
  };

  traceRepo.insert(traceData);

  console.log(`[Serial API] Stored traceroute from ${nodeId} with ${traceData.hops} hops`);
}

/**
 * Decode Traceroute payload
 */
function decodeTraceroutePayload(data: Uint8Array): {
  route?: number[];
  routeBack?: number[];
  snrTowards?: number[];
  snrBack?: number[];
} {
  const result: {
    route?: number[];
    routeBack?: number[];
    snrTowards?: number[];
    snrBack?: number[];
  } = {};

  let offset = 0;

  while (offset < data.length) {
    const tag = data[offset++];
    const fieldNum = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 2) {
      // packed repeated - decode as array of fixed32
      let len = 0;
      let shift = 0;
      while (offset < data.length) {
        const byte = data[offset++];
        len |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
      }

      const values: number[] = [];
      const end = offset + len;
      while (offset + 4 <= end) {
        const value = (data[offset] | (data[offset + 1] << 8) |
                      (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
        values.push(value);
        offset += 4;
      }
      offset = end;

      if (fieldNum === 1) result.route = values;
      if (fieldNum === 2) result.routeBack = values;
    } else if (wireType === 5) {
      // single fixed32 (non-packed, repeated)
      if (offset + 4 <= data.length) {
        const value = (data[offset] | (data[offset + 1] << 8) |
                      (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
        offset += 4;

        if (fieldNum === 1) {
          if (!result.route) result.route = [];
          result.route.push(value);
        }
        if (fieldNum === 2) {
          if (!result.routeBack) result.routeBack = [];
          result.routeBack.push(value);
        }
      }
    } else if (wireType === 0) {
      // varint - skip
      while (offset < data.length && (data[offset++] & 0x80)) {}
    } else {
      break;
    }
  }

  return result;
}

/**
 * Handle NeighborInfo packet (portnum 71)
 * These are stored as node relationships/last seen data
 */
async function handleNeighborInfo(
  nodeId: string,
  packet: Record<string, unknown>,
  decoded: Record<string, unknown>
) {
  const { nodeRepo, neighborRepo } = getRepos();
  const rawPayload = decoded.payload;

  if (!rawPayload) return;

  const payload = toUint8Array(rawPayload);
  const neighborInfo = decodeNeighborInfoPayload(payload);
  const from = packet.from as number;

  // Update the source node's lastHeard
  nodeRepo.upsert({
    id: nodeId,
    nodeNum: from,
    longName: '',
    shortName: '',
    hwModel: '0',
    role: 0,
    lastHeard: Date.now(),
  });

  // Store neighbor relationships in the database
  if (neighborInfo.neighbors && neighborInfo.neighbors.length > 0) {
    const neighborData = neighborInfo.neighbors.map(neighbor => ({
      neighborId: `!${(neighbor.nodeId >>> 0).toString(16).padStart(8, '0')}`,
      snr: neighbor.snr || 0,
    }));

    neighborRepo.upsertMany(nodeId, neighborData, Math.floor(Date.now() / 1000));

    // Also update lastHeard for all neighbors seen
    for (const neighbor of neighborInfo.neighbors) {
      const neighborNodeId = `!${(neighbor.nodeId >>> 0).toString(16).padStart(8, '0')}`;
      // Don't overwrite existing node data, just touch lastHeard
      try {
        const existing = nodeRepo.getById(neighborNodeId);
        if (existing) {
          nodeRepo.upsert({
            id: existing.id,
            nodeNum: existing.node_num,
            shortName: existing.short_name,
            longName: existing.long_name,
            hwModel: existing.hw_model,
            role: existing.role,
            lastHeard: Date.now(),
          });
        }
      } catch {
        // Node doesn't exist yet, that's fine
      }
    }
  }

  // Log neighbor info for debugging/analytics
  const neighborCount = neighborInfo.neighbors?.length || 0;
  console.log(`[Serial API] NeighborInfo from ${nodeId}: ${neighborCount} neighbors stored`);
}

/**
 * Decode NeighborInfo payload
 */
function decodeNeighborInfoPayload(data: Uint8Array): {
  nodeId?: number;
  neighbors?: Array<{ nodeId: number; snr?: number }>;
} {
  const result: {
    nodeId?: number;
    neighbors?: Array<{ nodeId: number; snr?: number }>;
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

      if (fieldNum === 1) result.nodeId = value;
    } else if (wireType === 2) {
      // length-delimited - neighbor sub-message
      let len = 0;
      let shift = 0;
      while (offset < data.length) {
        const byte = data[offset++];
        len |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
      }

      if (fieldNum === 3) {
        // neighbors repeated message
        const neighbor = decodeNeighbor(data.slice(offset, offset + len));
        if (neighbor.nodeId !== undefined) {
          if (!result.neighbors) result.neighbors = [];
          result.neighbors.push(neighbor);
        }
      }
      offset += len;
    } else if (wireType === 5) {
      // fixed32
      if (offset + 4 <= data.length) {
        const value = (data[offset] | (data[offset + 1] << 8) |
                      (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
        offset += 4;

        if (fieldNum === 1) result.nodeId = value;
      }
    } else {
      break;
    }
  }

  return result;
}

/**
 * Decode a single Neighbor entry
 */
function decodeNeighbor(data: Uint8Array): { nodeId: number; snr?: number } {
  const result: { nodeId: number; snr?: number } = { nodeId: 0 };

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

      if (fieldNum === 1) result.nodeId = value >>> 0;
      if (fieldNum === 2) result.snr = value;
    } else if (wireType === 5) {
      // fixed32
      if (offset + 4 <= data.length) {
        const value = (data[offset] | (data[offset + 1] << 8) |
                      (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
        offset += 4;

        if (fieldNum === 1) result.nodeId = value;
      }
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

/**
 * Handle Routing packet (portnum 5)
 * Stores ACK/NAK delivery information
 */
async function handleRouting(
  nodeId: string,
  packet: Record<string, unknown>,
  decoded: Record<string, unknown>
) {
  const { routingRepo } = getRepos();
  const rawPayload = decoded.payload;

  if (!rawPayload) return;

  const payload = toUint8Array(rawPayload);
  const routingInfo = decodeRoutingPayload(payload);
  const to = packet.to as number;
  const toNodeId = to === 0xffffffff ? 'broadcast' : `!${to.toString(16).padStart(8, '0')}`;

  // Store the routing entry
  routingRepo.insert({
    fromId: nodeId,
    toId: toNodeId,
    packetId: routingInfo.requestId || (packet.id as number) || 0,
    errorReason: routingInfo.errorReason || 0,
    timestamp: Math.floor(Date.now() / 1000),
  });

  const errorName = routingInfo.errorReason === 0 ? 'ACK' : `NAK(${routingInfo.errorReason})`;
  console.log(`[Serial API] Routing from ${nodeId}: ${errorName}`);
}

/**
 * Decode Routing payload
 */
function decodeRoutingPayload(data: Uint8Array): {
  errorReason?: number;
  requestId?: number;
} {
  const result: { errorReason?: number; requestId?: number } = {};
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

      // errorReason is field 1
      if (fieldNum === 1) result.errorReason = value;
    } else if (wireType === 5) {
      // fixed32 - requestId is field 2
      if (offset + 4 <= data.length) {
        const value = (data[offset] | (data[offset + 1] << 8) |
                      (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
        offset += 4;

        if (fieldNum === 2) result.requestId = value;
      }
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

/**
 * Handle Waypoint packet (portnum 8)
 * Stores map pins/markers
 */
async function handleWaypoint(
  nodeId: string,
  packet: Record<string, unknown>,
  decoded: Record<string, unknown>
) {
  const { waypointRepo } = getRepos();
  const rawPayload = decoded.payload;

  if (!rawPayload) return;

  const payload = toUint8Array(rawPayload);
  const waypoint = decodeWaypointPayload(payload);

  if (!waypoint.id || !waypoint.latitude || !waypoint.longitude) {
    console.log(`[Serial API] Waypoint from ${nodeId}: incomplete data`);
    return;
  }

  const waypointData: ProcessedWaypoint = {
    id: waypoint.id,
    name: waypoint.name || '',
    description: waypoint.description,
    latitude: waypoint.latitude,
    longitude: waypoint.longitude,
    icon: waypoint.icon,
    expire: waypoint.expire,
    lockedTo: waypoint.lockedTo,
    fromId: nodeId,
    timestamp: Math.floor(Date.now() / 1000),
  };

  waypointRepo.upsert(waypointData);

  console.log(`[Serial API] Waypoint from ${nodeId}: "${waypoint.name}" stored`);
}

/**
 * Decode Waypoint payload
 */
function decodeWaypointPayload(data: Uint8Array): {
  id?: number;
  latitude?: number;
  longitude?: number;
  expire?: number;
  lockedTo?: number;
  name?: string;
  description?: string;
  icon?: number;
} {
  const result: {
    id?: number;
    latitude?: number;
    longitude?: number;
    expire?: number;
    lockedTo?: number;
    name?: string;
    description?: string;
    icon?: number;
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

      if (fieldNum === 1) result.id = value >>> 0;
      if (fieldNum === 4) result.expire = value >>> 0;
      if (fieldNum === 5) result.lockedTo = value >>> 0;
      if (fieldNum === 7) result.icon = value;
    } else if (wireType === 5) {
      // sfixed32
      if (offset + 4 <= data.length) {
        const value = data[offset] | (data[offset + 1] << 8) |
                     (data[offset + 2] << 16) | (data[offset + 3] << 24);
        offset += 4;

        if (fieldNum === 2) result.latitude = value / 1e7;
        if (fieldNum === 3) result.longitude = value / 1e7;
      }
    } else if (wireType === 2) {
      // length-delimited (strings)
      let len = 0;
      let shift = 0;
      while (offset < data.length) {
        const byte = data[offset++];
        len |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
      }

      if (offset + len <= data.length) {
        const bytes = data.slice(offset, offset + len);
        const str = new TextDecoder().decode(bytes);

        if (fieldNum === 6) result.name = str;
        if (fieldNum === 8) result.description = str;
      }
      offset += len;
    } else {
      break;
    }
  }

  return result;
}
