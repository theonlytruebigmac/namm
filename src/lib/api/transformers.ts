/**
 * Data Transformers
 *
 * Converts backend Meshtastic API responses to frontend types
 */

import type {
  Node,
  NodeRole,
  HardwareModel,
  Position,
  Message,
  Channel,
} from "@/types";

// ============================================================================
// API Types (Backend Response Formats)
// ============================================================================

export interface APINode {
  nodeNum: number;
  user: {
    id: string; // "!df6ab854"
    longName: string;
    shortName: string;
    hwModel: number;
    role?: number;
  };
  position?: {
    latitudeI: number; // Latitude * 1e7
    longitudeI: number; // Longitude * 1e7
    altitude: number;
    time?: number; // Unix timestamp
  };
  deviceMetrics?: {
    batteryLevel?: number;
    voltage?: number;
    channelUtilization?: number;
    airUtilTx?: number;
    uptimeSeconds?: number;
  };
  lastHeard?: number; // Unix timestamp (seconds)
  snr?: number;
  rssi?: number;
  hopsAway?: number;
}

export interface APIMessage {
  id: number;
  from: number; // Node number
  to: number; // Node number
  channel: number;
  payload?: {
    text?: string;
  };
  rxTime: number; // Unix timestamp (seconds)
  hopStart?: number;
  hopLimit?: number;
}

export interface APIChannel {
  index: number;
  settings: {
    name?: string;
    psk?: Uint8Array | string;
    uplinkEnabled?: boolean;
    downlinkEnabled?: boolean;
  };
  role: number; // 1 = primary, 2 = secondary, etc.
}

export interface APIDeviceInfo {
  nodeNum: number;
  user: {
    id: string;
    longName: string;
    shortName: string;
    hwModel: number;
  };
  myNodeNum?: number;
}

// ============================================================================
// Hardware Model Mappings
// ============================================================================

const HW_MODEL_MAP: Record<number, HardwareModel> = {
  0: "UNSET",
  1: "TLORA_V2",
  2: "TLORA_V1",
  3: "TLORA_V2_1_1P6",
  4: "TBEAM",
  5: "HELTEC_V2_0",
  6: "TBEAM_V0P7",
  7: "T_ECHO",
  8: "TLORA_V1_1P3",
  9: "RAK4631",
  10: "HELTEC_V2_1",
  11: "HELTEC_V1",
  12: "LILYGO_TBEAM_S3_CORE",
  13: "RAK11200",
  14: "NANO_G1",
  15: "TLORA_V2_1_1P8",
  16: "TLORA_T3_S3",
  17: "NANO_G1_EXPLORER",
  18: "NANO_G2_ULTRA",
  19: "LORA_TYPE",
  20: "WIPHONE",
  21: "WIO_WM1110",
  22: "RAK2560",
  23: "HELTEC_HRU_3601",
  24: "STATION_G1",
  25: "RAK11310",
  26: "SENSELORA_RP2040",
  27: "SENSELORA_S3",
  28: "CANARYONE",
  29: "RP2040_LORA",
  30: "STATION_G2",
  31: "LORA_RELAY_V1",
  32: "NRF52840DK",
  33: "PPR",
  34: "GENIEBLOCKS",
  35: "NRF52_UNKNOWN",
  36: "PORTDUINO",
  37: "ANDROID_SIM",
  38: "DIY_V1",
  39: "NRF52840_PCA10059",
  40: "DR_DEV",
  41: "M5STACK",
  42: "HELTEC_V3",
  43: "HELTEC_WSL_V3",
  44: "BETAFPV_2400_TX",
  45: "BETAFPV_900_NANO_TX",
  46: "RPI_PICO",
  47: "HELTEC_WIRELESS_TRACKER",
  48: "HELTEC_WIRELESS_PAPER",
  49: "T_DECK",
  50: "T_WATCH_S3",
  51: "PICOMPUTER_S3",
  52: "HELTEC_HT62",
  53: "EBYTE_ESP32_S3",
  54: "ESP32_S3_PICO",
  55: "CHATTER_2",
  56: "HELTEC_WIRELESS_PAPER_V1_0",
  57: "HELTEC_WIRELESS_TRACKER_V1_0",
  58: "UNPHONE",
  59: "TD_LORAC",
  60: "CDEBYTE_EORA_S3",
  61: "TWC_MESH_V4",
  62: "NRF52_PROMICRO_DIY",
  63: "RADIOMASTER_900_BANDIT_NANO",
  64: "HELTEC_CAPSULE_SENSOR_V3",
  65: "HELTEC_VISION_MASTER_T190",
  66: "HELTEC_VISION_MASTER_E213",
  67: "HELTEC_VISION_MASTER_E290",
  68: "HELTEC_MESH_NODE_T114",
  69: "SENSECAP_INDICATOR",
  70: "TRACKER_T1000_E",
  71: "RAK3172",
  72: "WIO_E5",
  73: "RADIOMASTER_900_BANDIT",
  74: "ME25LS01_4Y10TD",
  75: "RP2040_FEATHER_RFM95",
  76: "M5STACK_COREBASIC",
  77: "M5STACK_CORE2",
};

function getHWModelName(hwModel: number): HardwareModel {
  return HW_MODEL_MAP[hwModel] || "UNSET";
}

// ============================================================================
// Role Mappings
// ============================================================================

const ROLE_MAP: Record<number, NodeRole> = {
  0: "CLIENT",
  1: "CLIENT_MUTE",
  2: "ROUTER",
  3: "ROUTER_CLIENT",
  4: "REPEATER",
  5: "TRACKER",
  6: "SENSOR",
  7: "TAK",
  8: "CLIENT_HIDDEN",
  9: "LOST_AND_FOUND",
  10: "TAK_TRACKER",
  11: "ROUTER",        // ROUTER_LATE - treat as ROUTER
  12: "ROUTER_CLIENT", // Additional router role
};

function getNodeRole(role?: number): NodeRole {
  if (role === undefined) return "CLIENT";
  return ROLE_MAP[role] || "CLIENT";
}

// ============================================================================
// Node Transformers
// ============================================================================

/**
 * Transform database node to frontend Node type
 */
export function transformDBNode(dbNode: any): Node {
  // Transform position if present
  const position = dbNode.position
    ? {
        latitude: dbNode.position.latitude,
        longitude: dbNode.position.longitude,
        altitude: dbNode.position.altitude,
        timestamp: dbNode.position.timestamp,
      }
    : undefined;

  return {
    id: dbNode.id,
    nodeNum: dbNode.node_num,
    shortName: dbNode.short_name || "Unknown",
    longName: dbNode.long_name || "Unknown Node",
    hwModel: getHWModelName(parseInt(dbNode.hw_model)),
    role: getNodeRole(dbNode.role),
    batteryLevel: dbNode.battery_level ?? undefined,
    voltage: dbNode.voltage ?? undefined,
    lastHeard: dbNode.last_heard,
    snr: dbNode.snr ?? undefined,
    rssi: dbNode.rssi ?? undefined,
    hopsAway: dbNode.hops_away ?? undefined,
    position,
    isFavorite: false,
  };
}

/**
 * Transform API node to frontend Node type
 */
export function transformNode(apiNode: APINode): Node {
  const position = apiNode.position
    ? transformPosition(apiNode.position)
    : undefined;

  return {
    id: apiNode.user.id,
    nodeNum: apiNode.nodeNum,
    shortName: apiNode.user.shortName || "Unknown",
    longName: apiNode.user.longName || "Unknown Node",
    hwModel: getHWModelName(apiNode.user.hwModel),
    role: getNodeRole(apiNode.user.role),
    batteryLevel: apiNode.deviceMetrics?.batteryLevel,
    voltage: apiNode.deviceMetrics?.voltage,
    channelUtilization: apiNode.deviceMetrics?.channelUtilization,
    airUtilTx: apiNode.deviceMetrics?.airUtilTx,
    uptime: apiNode.deviceMetrics?.uptimeSeconds,
    lastHeard: apiNode.lastHeard
      ? apiNode.lastHeard * 1000 // Convert to milliseconds
      : Date.now(),
    snr: apiNode.snr,
    rssi: apiNode.rssi,
    position,
    hopsAway: apiNode.hopsAway,
    isFavorite: false, // Set by frontend
  };
}

/**
 * Transform multiple nodes
 */
export function transformNodes(apiNodes: APINode[]): Node[] {
  return apiNodes.map(transformNode);
}

/**
 * Transform API position to frontend Position type
 */
function transformPosition(apiPosition: {
  latitudeI: number;
  longitudeI: number;
  altitude?: number;
  time?: number;
}): Position {
  return {
    latitude: apiPosition.latitudeI / 1e7, // Convert from integer format
    longitude: apiPosition.longitudeI / 1e7,
    altitude: apiPosition.altitude,
    timestamp: apiPosition.time ? apiPosition.time * 1000 : undefined,
  };
}

// ============================================================================
// Message Transformers
// ============================================================================

/**
 * Transform API message to frontend Message type
 */
export function transformMessage(
  apiMessage: APIMessage,
  nodeIdMap: Map<number, string> = new Map()
): Message {
  const fromId = nodeIdMap.get(apiMessage.from) || `!${apiMessage.from.toString(16).padStart(8, "0")}`;
  const toId = apiMessage.to === 0xffffffff
    ? "broadcast"
    : nodeIdMap.get(apiMessage.to) || `!${apiMessage.to.toString(16).padStart(8, "0")}`;

  return {
    id: `${apiMessage.id}`,
    fromNode: fromId,
    toNode: toId,
    text: apiMessage.payload?.text || "",
    channel: apiMessage.channel,
    timestamp: apiMessage.rxTime * 1000, // Convert to milliseconds
    hopStart: apiMessage.hopStart,
    hopLimit: apiMessage.hopLimit,
    status: "delivered",
  };
}

/**
 * Transform multiple messages
 */
export function transformMessages(
  apiMessages: APIMessage[],
  nodeIdMap?: Map<number, string>
): Message[] {
  return apiMessages.map((msg) => transformMessage(msg, nodeIdMap));
}

// ============================================================================
// Channel Transformers
// ============================================================================

/**
 * Transform API channel to frontend Channel type
 * Handles both full APIChannel format and simplified database format
 */
export function transformChannel(apiChannel: APIChannel | any): Channel {
  // Handle simplified format from database API
  if (!apiChannel.settings) {
    return {
      id: `channel-${apiChannel.index}`,
      index: apiChannel.index,
      name: apiChannel.name || `Channel ${apiChannel.index}`,
      isEncrypted: false,
      uplinkEnabled: true,
      downlinkEnabled: true,
      unreadCount: 0,
    };
  }

  // Handle full APIChannel format
  const name = apiChannel.settings.name || `Channel ${apiChannel.index}`;
  const isEncrypted = !!(apiChannel.settings.psk && apiChannel.settings.psk.length > 0);

  return {
    id: `channel-${apiChannel.index}`,
    index: apiChannel.index,
    name,
    psk: typeof apiChannel.settings.psk === "string"
      ? apiChannel.settings.psk
      : undefined,
    isEncrypted,
    uplinkEnabled: apiChannel.settings.uplinkEnabled ?? true,
    downlinkEnabled: apiChannel.settings.downlinkEnabled ?? true,
    unreadCount: 0, // Managed by frontend
  };
}

/**
 * Transform multiple channels
 */
export function transformChannels(apiChannels: APIChannel[]): Channel[] {
  return apiChannels.map(transformChannel);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a map of node numbers to node IDs
 * Useful for message transformation
 */
export function createNodeIdMap(nodes: Node[]): Map<number, string> {
  const map = new Map<number, string>();
  nodes.forEach((node) => {
    map.set(node.nodeNum, node.id);
  });
  return map;
}

/**
 * Parse node ID from hex string
 * Examples: "!df6ab854", "!a1b2c3d4"
 */
export function parseNodeId(id: string): number {
  const hex = id.startsWith("!") ? id.slice(1) : id;
  return parseInt(hex, 16);
}

/**
 * Format node number as hex ID
 * Example: 3748821076 -> "!df6ab854"
 */
export function formatNodeId(nodeNum: number): string {
  return `!${nodeNum.toString(16).padStart(8, "0")}`;
}
