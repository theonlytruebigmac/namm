/**
 * WebSocket Protocol Definitions
 *
 * Message types and protocol for real-time updates
 */

import type { DBNode, DBPosition, DBTelemetry, DBMessage } from '@/lib/db/types';

/**
 * Client -> Server messages
 */
export type WSClientMessage =
  | { type: 'ping' }
  | { type: 'subscribe'; filter?: SubscriptionFilter }
  | { type: 'unsubscribe' }
  | { type: 'request_snapshot' };

/**
 * Server -> Client messages
 */
export type WSServerMessage =
  | { type: 'pong'; timestamp: number }
  | { type: 'snapshot'; data: SnapshotData }
  | { type: 'node_update'; nodes: NodeUpdate[] }
  | { type: 'position_update'; positions: PositionUpdate[] }
  | { type: 'telemetry_update'; telemetry: TelemetryUpdate[] }
  | { type: 'message'; messages: MessageUpdate[] }
  | { type: 'node_status'; nodeId: string; online: boolean }
  | { type: 'error'; error: string; code?: string };

/**
 * Subscription filter
 */
export interface SubscriptionFilter {
  nodeIds?: string[]; // Only updates for specific nodes
  bounds?: BoundingBox; // Geographic filter
  messageTypes?: Array<'node' | 'position' | 'telemetry' | 'message'>; // Message type filter
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Initial snapshot data sent to new clients
 */
export interface SnapshotData {
  nodes: NodeUpdate[];
  positions: PositionUpdate[];
  recentMessages: MessageUpdate[];
  timestamp: number;
}

/**
 * Differential updates (only changed fields)
 */
export interface NodeUpdate {
  id: string;
  nodeNum?: number;
  shortName?: string;
  longName?: string;
  hwModel?: string;
  role?: number;
  lastHeard: number; // Always included for staleness check
  snr?: number;
  rssi?: number;
  hopsAway?: number;
  batteryLevel?: number;
  voltage?: number;
}

export interface PositionUpdate {
  id: number;
  nodeId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  timestamp: number;
  snr?: number;
  rssi?: number;
}

export interface TelemetryUpdate {
  id: number;
  nodeId: string;
  timestamp: number;
  batteryLevel?: number;
  voltage?: number;
  channelUtilization?: number;
  airUtilTx?: number;
  uptime?: number;
  temperature?: number;
}

export interface MessageUpdate {
  id: number;
  fromId: string;
  toId: string;
  channel: number;
  text?: string;
  timestamp: number;
  snr?: number;
  rssi?: number;
  hopsAway?: number;
}

/**
 * Connection state
 */
export interface ConnectionState {
  id: string;
  connectedAt: number;
  lastPing: number;
  filter?: SubscriptionFilter;
  messagesSent: number;
  bytesTransmitted: number;
}

/**
 * Broadcast options
 */
export interface BroadcastOptions {
  excludeConnection?: string; // Don't send to specific connection
  filter?: SubscriptionFilter; // Only send to connections matching filter
}

/**
 * Convert DB types to update types
 */
export function dbNodeToUpdate(node: DBNode): NodeUpdate {
  return {
    id: node.id,
    nodeNum: node.node_num,
    shortName: node.short_name,
    longName: node.long_name,
    hwModel: node.hw_model,
    role: node.role,
    lastHeard: node.last_heard,
    snr: node.snr ?? undefined,
    rssi: node.rssi ?? undefined,
    hopsAway: node.hops_away ?? undefined,
    batteryLevel: node.battery_level ?? undefined,
    voltage: node.voltage ?? undefined
  };
}

export function dbPositionToUpdate(position: DBPosition): PositionUpdate {
  return {
    id: position.id,
    nodeId: position.node_id,
    latitude: position.latitude,
    longitude: position.longitude,
    altitude: position.altitude ?? undefined,
    timestamp: position.timestamp,
    snr: position.snr ?? undefined,
    rssi: position.rssi ?? undefined
  };
}

export function dbTelemetryToUpdate(telemetry: DBTelemetry): TelemetryUpdate {
  return {
    id: telemetry.id,
    nodeId: telemetry.node_id,
    timestamp: telemetry.timestamp,
    batteryLevel: telemetry.battery_level ?? undefined,
    voltage: telemetry.voltage ?? undefined,
    channelUtilization: telemetry.channel_utilization ?? undefined,
    airUtilTx: telemetry.air_util_tx ?? undefined,
    uptime: telemetry.uptime ?? undefined,
    temperature: telemetry.temperature ?? undefined
  };
}

export function dbMessageToUpdate(message: DBMessage): MessageUpdate {
  return {
    id: message.id,
    fromId: message.from_id,
    toId: message.to_id,
    channel: message.channel,
    text: message.text ?? undefined,
    timestamp: message.timestamp,
    snr: message.snr ?? undefined,
    rssi: message.rssi ?? undefined,
    hopsAway: message.hops_away ?? undefined
  };
}

/**
 * Check if position is within bounds
 */
export function isWithinBounds(
  lat: number,
  lon: number,
  bounds: BoundingBox
): boolean {
  // Handle longitude wrapping around international date line
  const lonInBounds = bounds.west <= bounds.east
    ? lon >= bounds.west && lon <= bounds.east
    : lon >= bounds.west || lon <= bounds.east;

  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    lonInBounds
  );
}

/**
 * Check if update matches filter
 */
export function matchesFilter(
  nodeId: string,
  position: { latitude: number; longitude: number } | null,
  filter?: SubscriptionFilter
): boolean {
  if (!filter) return true;

  // Check node ID filter
  if (filter.nodeIds && !filter.nodeIds.includes(nodeId)) {
    return false;
  }

  // Check geographic filter
  if (filter.bounds && position) {
    if (!isWithinBounds(position.latitude, position.longitude, filter.bounds)) {
      return false;
    }
  }

  return true;
}
