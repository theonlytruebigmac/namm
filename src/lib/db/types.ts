/**
 * Database Type Definitions
 *
 * TypeScript interfaces for database entities
 */

export interface DBNode {
  id: string;
  node_num: number;
  short_name: string;
  long_name: string;
  hw_model: string;
  role: number;
  last_heard: number;
  snr: number | null;
  rssi: number | null;
  hops_away: number | null;
  battery_level: number | null;
  voltage: number | null;
  created_at: number;
  updated_at: number;
}

export interface DBPosition {
  id: number;
  node_id: string;
  node_num: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  precision_bits: number | null;
  timestamp: number;
  snr: number | null;
  rssi: number | null;
}

export interface DBTelemetry {
  id: number;
  node_id: string;
  node_num: number;
  timestamp: number;
  battery_level: number | null;
  voltage: number | null;
  channel_utilization: number | null;
  air_util_tx: number | null;
  uptime: number | null;
  temperature: number | null;
  snr: number | null;
  rssi: number | null;
}

export interface DBMessage {
  id: number;
  from_id: string;
  to_id: string;
  channel: number;
  text: string | null;
  timestamp: number;
  snr: number | null;
  rssi: number | null;
  hops_away: number | null;
  reply_to: number | null;
  read_at: number | null;
}

export interface DBReaction {
  id: number;
  message_id: number;
  from_node: string;
  emoji: string;
  timestamp: number;
}

export interface DBTraceroute {
  id: number;
  from_id: string;
  to_id: string;
  timestamp: number;
  route: string; // JSON array of node numbers
  route_back: string | null;
  snr_towards: string | null; // JSON array of SNR values
  snr_back: string | null;
  hops: number;
  success: number; // 0 or 1
  latency_ms: number | null;
}

export interface DBSetting {
  key: string;
  value: string;
  updated_at: number;
}

export interface DBMetadata {
  key: string;
  value: string;
}

// Query filter types
export interface NodeFilter {
  activeWithin?: number; // milliseconds
  hasPosition?: boolean;
  minBatteryLevel?: number;
}

export interface PositionFilter {
  nodeId?: string;
  since?: number;
  bounds?: BoundingBox;
}

export interface TelemetryFilter {
  nodeId?: string;
  since?: number;
}

export interface MessageFilter {
  fromId?: string;
  toId?: string;
  since?: number;
  channel?: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Pagination types
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
