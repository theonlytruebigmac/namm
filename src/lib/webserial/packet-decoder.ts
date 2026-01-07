/**
 * Serial Packet Payload Decoder
 *
 * Decodes the inner payload of Meshtastic packets received via serial.
 * Works with Uint8Array payloads in the browser environment.
 *
 * This handles the decoded.payload field which contains protobuf-encoded
 * Position, Telemetry, NodeInfo, etc. based on the portnum.
 */

// Meshtastic port numbers
export const PORTNUM = {
  UNKNOWN_APP: 0,
  TEXT_MESSAGE_APP: 1,
  REMOTE_HARDWARE_APP: 2,
  POSITION_APP: 3,
  NODEINFO_APP: 4,
  ROUTING_APP: 5,
  ADMIN_APP: 6,
  TEXT_MESSAGE_COMPRESSED_APP: 7,
  WAYPOINT_APP: 8,
  AUDIO_APP: 9,
  DETECTION_SENSOR_APP: 10,
  REPLY_APP: 32,
  IP_TUNNEL_APP: 33,
  PAXCOUNTER_APP: 34,
  SERIAL_APP: 64,
  STORE_FORWARD_APP: 65,
  RANGE_TEST_APP: 66,
  TELEMETRY_APP: 67,
  ZPS_APP: 68,
  SIMULATOR_APP: 69,
  TRACEROUTE_APP: 70,
  NEIGHBORINFO_APP: 71,
  ATAK_PLUGIN: 72,
  MAP_REPORT_APP: 73,
  PRIVATE_APP: 256,
  ATAK_FORWARDER: 257,
  MAX: 511,
} as const;

// Hardware model names
const HARDWARE_MODELS: Record<number, string> = {
  0: 'UNSET',
  1: 'TLORA_V2',
  2: 'TLORA_V1',
  3: 'TLORA_V2_1_1P6',
  4: 'TBEAM',
  5: 'HELTEC_V2_0',
  6: 'TBEAM_V0P7',
  7: 'T_ECHO',
  8: 'TLORA_V1_1P3',
  9: 'RAK4631',
  10: 'HELTEC_V2_1',
  11: 'HELTEC_V1',
  12: 'LILYGO_TBEAM_S3_CORE',
  13: 'RAK11200',
  14: 'NANO_G1',
  15: 'TLORA_V2_1_1P8',
  16: 'TLORA_T3_S3',
  17: 'NANO_G1_EXPLORER',
  18: 'NANO_G2_ULTRA',
  25: 'STATION_G1',
  26: 'RAK11310',
  31: 'STATION_G2',
  37: 'PORTDUINO',
  38: 'ANDROID_SIM',
  39: 'DIY_V1',
  42: 'M5STACK',
  43: 'HELTEC_V3',
  44: 'HELTEC_WSL_V3',
  47: 'RPI_PICO',
  48: 'HELTEC_WIRELESS_TRACKER',
  49: 'HELTEC_WIRELESS_PAPER',
  50: 'T_DECK',
  51: 'T_WATCH_S3',
  52: 'PICOMPUTER_S3',
  53: 'HELTEC_HT62',
  65: 'HELTEC_CAPSULE_SENSOR_V3',
  66: 'HELTEC_VISION_MASTER_T190',
  67: 'HELTEC_VISION_MASTER_E213',
  68: 'HELTEC_VISION_MASTER_E290',
  69: 'HELTEC_MESH_NODE_T114',
  70: 'SENSECAP_INDICATOR',
  71: 'TRACKER_T1000_E',
  72: 'RAK3172',
  73: 'WIO_E5',
  77: 'M5STACK_COREBASIC',
  78: 'M5STACK_CORE2',
};

// Port number names
export function getPortnumName(portnum: number): string {
  const names: Record<number, string> = {
    0: 'UNKNOWN_APP',
    1: 'TEXT_MESSAGE_APP',
    2: 'REMOTE_HARDWARE_APP',
    3: 'POSITION_APP',
    4: 'NODEINFO_APP',
    5: 'ROUTING_APP',
    6: 'ADMIN_APP',
    7: 'TEXT_MESSAGE_COMPRESSED_APP',
    8: 'WAYPOINT_APP',
    9: 'AUDIO_APP',
    10: 'DETECTION_SENSOR_APP',
    32: 'REPLY_APP',
    33: 'IP_TUNNEL_APP',
    34: 'PAXCOUNTER_APP',
    64: 'SERIAL_APP',
    65: 'STORE_FORWARD_APP',
    66: 'RANGE_TEST_APP',
    67: 'TELEMETRY_APP',
    68: 'ZPS_APP',
    69: 'SIMULATOR_APP',
    70: 'TRACEROUTE_APP',
    71: 'NEIGHBORINFO_APP',
    72: 'ATAK_PLUGIN',
    73: 'MAP_REPORT_APP',
    256: 'PRIVATE_APP',
    257: 'ATAK_FORWARDER',
  };
  return names[portnum] || `UNKNOWN(${portnum})`;
}

export function getHardwareModelName(model: number): string {
  return HARDWARE_MODELS[model] || `UNKNOWN(${model})`;
}

// Wire type constants
const WIRE_TYPE_VARINT = 0;
const WIRE_TYPE_FIXED64 = 1;
const WIRE_TYPE_LENGTH_DELIMITED = 2;
const WIRE_TYPE_FIXED32 = 5;

/**
 * Read a varint from Uint8Array
 */
function readVarint(data: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let bytesRead = 0;

  while (offset + bytesRead < data.length) {
    const byte = data[offset + bytesRead];
    bytesRead++;

    if (shift < 28) {
      result |= (byte & 0x7f) << shift;
    } else if (shift === 28) {
      result |= (byte & 0x0f) << shift;
    }

    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (bytesRead > 10) break;
  }

  return [result >>> 0, bytesRead];
}

/**
 * Read a signed varint
 */
function readSignedVarint(data: Uint8Array, offset: number): [number, number] {
  const [value, bytesRead] = readVarint(data, offset);
  if (value > 0x7fffffff) {
    return [value - 0x100000000, bytesRead];
  }
  return [value, bytesRead];
}

/**
 * Parse field header
 */
function parseFieldHeader(data: Uint8Array, offset: number): [number, number, number] {
  const [tag, bytesRead] = readVarint(data, offset);
  const fieldNum = tag >>> 3;
  const wireType = tag & 0x07;
  return [fieldNum, wireType, bytesRead];
}

/**
 * Skip a field
 */
function skipField(data: Uint8Array, offset: number, wireType: number): number {
  switch (wireType) {
    case WIRE_TYPE_VARINT: {
      const [, bytesRead] = readVarint(data, offset);
      return bytesRead;
    }
    case WIRE_TYPE_FIXED64:
      return 8;
    case WIRE_TYPE_LENGTH_DELIMITED: {
      const [length, bytesRead] = readVarint(data, offset);
      return bytesRead + length;
    }
    case WIRE_TYPE_FIXED32:
      return 4;
    default:
      return 1;
  }
}

/**
 * Read a float from Uint8Array (little-endian)
 */
function readFloatLE(data: Uint8Array, offset: number): number {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  for (let i = 0; i < 4; i++) {
    view.setUint8(i, data[offset + i]);
  }
  return view.getFloat32(0, true);
}

/**
 * Read int32 from Uint8Array (little-endian)
 */
function readInt32LE(data: Uint8Array, offset: number): number {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  );
}

/**
 * Read uint32 from Uint8Array (little-endian)
 */
function readUint32LE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)) >>> 0
  );
}

// ============= Decoded Types =============

export interface DecodedPosition {
  latitudeI?: number;
  longitudeI?: number;
  altitude?: number;
  time?: number;
  timestamp?: number;
  precisionBits?: number;
  // Computed values
  latitude?: number;
  longitude?: number;
}

export interface DecodedUser {
  id?: string;
  longName?: string;
  shortName?: string;
  macaddr?: Uint8Array;
  hwModel?: number;
  hwModelName?: string;
  isLicensed?: boolean;
  role?: number;
  publicKey?: Uint8Array;
}

export interface DecodedDeviceMetrics {
  batteryLevel?: number;
  voltage?: number;
  channelUtilization?: number;
  airUtilTx?: number;
  uptimeSeconds?: number;
}

export interface DecodedEnvironmentMetrics {
  temperature?: number;
  relativeHumidity?: number;
  barometricPressure?: number;
  gasResistance?: number;
  voltage?: number;
  current?: number;
  iaq?: number;
  distance?: number;
  lux?: number;
  whiteLux?: number;
  irLux?: number;
  uvLux?: number;
  windDirection?: number;
  windSpeed?: number;
  weight?: number;
}

export interface DecodedTelemetry {
  time?: number;
  deviceMetrics?: DecodedDeviceMetrics;
  environmentMetrics?: DecodedEnvironmentMetrics;
}

export interface DecodedNeighborInfo {
  nodeId?: number;
  lastSentById?: number;
  nodeBroadcastIntervalSecs?: number;
  neighbors?: Array<{
    nodeId: number;
    snr?: number;
    lastRxTime?: number;
    nodeBroadcastIntervalSecs?: number;
  }>;
}

export interface DecodedRouting {
  errorReason?: number;
  errorReasonName?: string;
}

export interface DecodedTraceroute {
  route?: number[];
  routeBack?: number[];
  snrTowards?: number[];
  snrBack?: number[];
}

export interface DecodedPayload {
  portnum: number;
  portnumName: string;
  text?: string;
  position?: DecodedPosition;
  user?: DecodedUser;
  telemetry?: DecodedTelemetry;
  neighborInfo?: DecodedNeighborInfo;
  routing?: DecodedRouting;
  traceroute?: DecodedTraceroute;
  rawPayload?: Record<string, number>;
}

// ============= Payload Decoders =============

/**
 * Decode a Position payload
 */
export function decodePosition(data: Uint8Array): DecodedPosition | null {
  try {
    const result: DecodedPosition = {};
    let offset = 0;

    while (offset < data.length) {
      const [fieldNum, wireType, headerBytes] = parseFieldHeader(data, offset);
      offset += headerBytes;

      switch (fieldNum) {
        case 1: // latitude_i (sfixed32 or varint)
          if (wireType === WIRE_TYPE_FIXED32) {
            result.latitudeI = readInt32LE(data, offset);
            offset += 4;
          } else if (wireType === WIRE_TYPE_VARINT) {
            const [value, bytes] = readSignedVarint(data, offset);
            result.latitudeI = value;
            offset += bytes;
          }
          break;
        case 2: // longitude_i (sfixed32 or varint)
          if (wireType === WIRE_TYPE_FIXED32) {
            result.longitudeI = readInt32LE(data, offset);
            offset += 4;
          } else if (wireType === WIRE_TYPE_VARINT) {
            const [value, bytes] = readSignedVarint(data, offset);
            result.longitudeI = value;
            offset += bytes;
          }
          break;
        case 3: // altitude (int32)
          if (wireType === WIRE_TYPE_VARINT) {
            const [value, bytes] = readSignedVarint(data, offset);
            result.altitude = value;
            offset += bytes;
          }
          break;
        case 4: // time (fixed32)
          if (wireType === WIRE_TYPE_FIXED32) {
            result.time = readUint32LE(data, offset);
            offset += 4;
          } else if (wireType === WIRE_TYPE_VARINT) {
            const [value, bytes] = readVarint(data, offset);
            result.time = value;
            offset += bytes;
          }
          break;
        case 9: // timestamp
          if (wireType === WIRE_TYPE_FIXED32) {
            result.timestamp = readUint32LE(data, offset);
            offset += 4;
          } else if (wireType === WIRE_TYPE_VARINT) {
            const [value, bytes] = readVarint(data, offset);
            result.timestamp = value;
            offset += bytes;
          }
          break;
        case 14: // precision_bits
          if (wireType === WIRE_TYPE_VARINT) {
            const [value, bytes] = readVarint(data, offset);
            result.precisionBits = value;
            offset += bytes;
          }
          break;
        default:
          offset += skipField(data, offset, wireType);
      }
    }

    // Compute lat/lon from integer values
    if (result.latitudeI !== undefined) {
      result.latitude = result.latitudeI / 1e7;
    }
    if (result.longitudeI !== undefined) {
      result.longitude = result.longitudeI / 1e7;
    }

    return result;
  } catch (error) {
    console.error('[PacketDecoder] Failed to decode Position:', error);
    return null;
  }
}

/**
 * Decode a User (NodeInfo) payload
 */
export function decodeUser(data: Uint8Array): DecodedUser | null {
  try {
    const result: DecodedUser = {};
    let offset = 0;

    while (offset < data.length) {
      const [fieldNum, wireType, headerBytes] = parseFieldHeader(data, offset);
      offset += headerBytes;

      switch (fieldNum) {
        case 1: // id (string)
          if (wireType === WIRE_TYPE_LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(data, offset);
            offset += bytes;
            result.id = new TextDecoder().decode(data.slice(offset, offset + length));
            offset += length;
          }
          break;
        case 2: // long_name (string)
          if (wireType === WIRE_TYPE_LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(data, offset);
            offset += bytes;
            result.longName = new TextDecoder().decode(data.slice(offset, offset + length));
            offset += length;
          }
          break;
        case 3: // short_name (string)
          if (wireType === WIRE_TYPE_LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(data, offset);
            offset += bytes;
            result.shortName = new TextDecoder().decode(data.slice(offset, offset + length));
            offset += length;
          }
          break;
        case 4: // macaddr (bytes)
          if (wireType === WIRE_TYPE_LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(data, offset);
            offset += bytes;
            result.macaddr = data.slice(offset, offset + length);
            offset += length;
          }
          break;
        case 5: // hw_model (enum)
          if (wireType === WIRE_TYPE_VARINT) {
            const [value, bytes] = readVarint(data, offset);
            result.hwModel = value;
            result.hwModelName = getHardwareModelName(value);
            offset += bytes;
          }
          break;
        case 6: // is_licensed (bool)
          if (wireType === WIRE_TYPE_VARINT) {
            const [value, bytes] = readVarint(data, offset);
            result.isLicensed = value !== 0;
            offset += bytes;
          }
          break;
        case 7: // role (enum)
          if (wireType === WIRE_TYPE_VARINT) {
            const [value, bytes] = readVarint(data, offset);
            result.role = value;
            offset += bytes;
          }
          break;
        case 8: // public_key (bytes)
          if (wireType === WIRE_TYPE_LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(data, offset);
            offset += bytes;
            result.publicKey = data.slice(offset, offset + length);
            offset += length;
          }
          break;
        default:
          offset += skipField(data, offset, wireType);
      }
    }

    return result;
  } catch (error) {
    console.error('[PacketDecoder] Failed to decode User:', error);
    return null;
  }
}

/**
 * Decode DeviceMetrics embedded message
 */
function decodeDeviceMetrics(data: Uint8Array): DecodedDeviceMetrics {
  const result: DecodedDeviceMetrics = {};
  let offset = 0;

  while (offset < data.length) {
    const [fieldNum, wireType, headerBytes] = parseFieldHeader(data, offset);
    offset += headerBytes;

    switch (fieldNum) {
      case 1: // battery_level (uint32)
        if (wireType === WIRE_TYPE_VARINT) {
          const [value, bytes] = readVarint(data, offset);
          result.batteryLevel = value;
          offset += bytes;
        }
        break;
      case 2: // voltage (float)
        if (wireType === WIRE_TYPE_FIXED32) {
          result.voltage = readFloatLE(data, offset);
          offset += 4;
        }
        break;
      case 3: // channel_utilization (float)
        if (wireType === WIRE_TYPE_FIXED32) {
          result.channelUtilization = readFloatLE(data, offset);
          offset += 4;
        }
        break;
      case 4: // air_util_tx (float)
        if (wireType === WIRE_TYPE_FIXED32) {
          result.airUtilTx = readFloatLE(data, offset);
          offset += 4;
        }
        break;
      case 5: // uptime_seconds (uint32)
        if (wireType === WIRE_TYPE_VARINT) {
          const [value, bytes] = readVarint(data, offset);
          result.uptimeSeconds = value;
          offset += bytes;
        }
        break;
      default:
        offset += skipField(data, offset, wireType);
    }
  }

  return result;
}

/**
 * Decode EnvironmentMetrics embedded message
 */
function decodeEnvironmentMetrics(data: Uint8Array): DecodedEnvironmentMetrics {
  const result: DecodedEnvironmentMetrics = {};
  let offset = 0;

  while (offset < data.length) {
    const [fieldNum, wireType, headerBytes] = parseFieldHeader(data, offset);
    offset += headerBytes;

    switch (fieldNum) {
      case 1: // temperature (float)
        if (wireType === WIRE_TYPE_FIXED32) {
          result.temperature = readFloatLE(data, offset);
          offset += 4;
        }
        break;
      case 2: // relative_humidity (float)
        if (wireType === WIRE_TYPE_FIXED32) {
          result.relativeHumidity = readFloatLE(data, offset);
          offset += 4;
        }
        break;
      case 3: // barometric_pressure (float)
        if (wireType === WIRE_TYPE_FIXED32) {
          result.barometricPressure = readFloatLE(data, offset);
          offset += 4;
        }
        break;
      case 4: // gas_resistance (float)
        if (wireType === WIRE_TYPE_FIXED32) {
          result.gasResistance = readFloatLE(data, offset);
          offset += 4;
        }
        break;
      case 5: // voltage (float)
        if (wireType === WIRE_TYPE_FIXED32) {
          result.voltage = readFloatLE(data, offset);
          offset += 4;
        }
        break;
      case 6: // current (float)
        if (wireType === WIRE_TYPE_FIXED32) {
          result.current = readFloatLE(data, offset);
          offset += 4;
        }
        break;
      case 7: // iaq (uint32)
        if (wireType === WIRE_TYPE_VARINT) {
          const [value, bytes] = readVarint(data, offset);
          result.iaq = value;
          offset += bytes;
        }
        break;
      case 8: // distance (float)
        if (wireType === WIRE_TYPE_FIXED32) {
          result.distance = readFloatLE(data, offset);
          offset += 4;
        }
        break;
      case 9: // lux (float)
        if (wireType === WIRE_TYPE_FIXED32) {
          result.lux = readFloatLE(data, offset);
          offset += 4;
        }
        break;
      default:
        offset += skipField(data, offset, wireType);
    }
  }

  return result;
}

/**
 * Decode a Telemetry payload
 */
export function decodeTelemetry(data: Uint8Array): DecodedTelemetry | null {
  try {
    const result: DecodedTelemetry = {};
    let offset = 0;

    while (offset < data.length) {
      const [fieldNum, wireType, headerBytes] = parseFieldHeader(data, offset);
      offset += headerBytes;

      switch (fieldNum) {
        case 1: // time (fixed32)
          if (wireType === WIRE_TYPE_FIXED32) {
            result.time = readUint32LE(data, offset);
            offset += 4;
          } else if (wireType === WIRE_TYPE_VARINT) {
            const [value, bytes] = readVarint(data, offset);
            result.time = value;
            offset += bytes;
          }
          break;
        case 2: // device_metrics
          if (wireType === WIRE_TYPE_LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(data, offset);
            offset += bytes;
            result.deviceMetrics = decodeDeviceMetrics(data.slice(offset, offset + length));
            offset += length;
          }
          break;
        case 3: // environment_metrics
          if (wireType === WIRE_TYPE_LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(data, offset);
            offset += bytes;
            result.environmentMetrics = decodeEnvironmentMetrics(data.slice(offset, offset + length));
            offset += length;
          }
          break;
        default:
          offset += skipField(data, offset, wireType);
      }
    }

    return result;
  } catch (error) {
    console.error('[PacketDecoder] Failed to decode Telemetry:', error);
    return null;
  }
}

/**
 * Decode a NeighborInfo payload
 */
export function decodeNeighborInfo(data: Uint8Array): DecodedNeighborInfo | null {
  try {
    const result: DecodedNeighborInfo = { neighbors: [] };
    let offset = 0;

    while (offset < data.length) {
      const [fieldNum, wireType, headerBytes] = parseFieldHeader(data, offset);
      offset += headerBytes;

      switch (fieldNum) {
        case 1: // node_id (uint32)
          if (wireType === WIRE_TYPE_VARINT) {
            const [value, bytes] = readVarint(data, offset);
            result.nodeId = value;
            offset += bytes;
          }
          break;
        case 2: // last_sent_by_id (uint32)
          if (wireType === WIRE_TYPE_VARINT) {
            const [value, bytes] = readVarint(data, offset);
            result.lastSentById = value;
            offset += bytes;
          }
          break;
        case 3: // node_broadcast_interval_secs (uint32)
          if (wireType === WIRE_TYPE_VARINT) {
            const [value, bytes] = readVarint(data, offset);
            result.nodeBroadcastIntervalSecs = value;
            offset += bytes;
          }
          break;
        case 4: // neighbors (repeated Neighbor)
          if (wireType === WIRE_TYPE_LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(data, offset);
            offset += bytes;
            const neighborData = data.slice(offset, offset + length);
            const neighbor = decodeNeighbor(neighborData);
            if (neighbor) {
              result.neighbors!.push(neighbor);
            }
            offset += length;
          }
          break;
        default:
          offset += skipField(data, offset, wireType);
      }
    }

    return result;
  } catch (error) {
    console.error('[PacketDecoder] Failed to decode NeighborInfo:', error);
    return null;
  }
}

/**
 * Decode a single Neighbor entry
 */
function decodeNeighbor(data: Uint8Array): { nodeId: number; snr?: number; lastRxTime?: number } | null {
  try {
    const result: { nodeId: number; snr?: number; lastRxTime?: number } = { nodeId: 0 };
    let offset = 0;

    while (offset < data.length) {
      const [fieldNum, wireType, headerBytes] = parseFieldHeader(data, offset);
      offset += headerBytes;

      switch (fieldNum) {
        case 1: // node_id (uint32)
          if (wireType === WIRE_TYPE_VARINT) {
            const [value, bytes] = readVarint(data, offset);
            result.nodeId = value;
            offset += bytes;
          }
          break;
        case 2: // snr (float)
          if (wireType === WIRE_TYPE_FIXED32) {
            result.snr = readFloatLE(data, offset);
            offset += 4;
          }
          break;
        case 3: // last_rx_time (fixed32)
          if (wireType === WIRE_TYPE_FIXED32) {
            result.lastRxTime = readUint32LE(data, offset);
            offset += 4;
          }
          break;
        default:
          offset += skipField(data, offset, wireType);
      }
    }

    return result;
  } catch (error) {
    return null;
  }
}

/**
 * Decode Routing payload
 */
export function decodeRouting(data: Uint8Array): DecodedRouting | null {
  try {
    const result: DecodedRouting = {};
    let offset = 0;

    const errorReasons: Record<number, string> = {
      0: 'NONE',
      1: 'NO_ROUTE',
      2: 'GOT_NAK',
      3: 'TIMEOUT',
      4: 'NO_INTERFACE',
      5: 'MAX_RETRANSMIT',
      6: 'NO_CHANNEL',
      7: 'TOO_LARGE',
      8: 'NO_RESPONSE',
      9: 'DUTY_CYCLE_LIMIT',
      32: 'BAD_REQUEST',
      33: 'NOT_AUTHORIZED',
    };

    while (offset < data.length) {
      const [fieldNum, wireType, headerBytes] = parseFieldHeader(data, offset);
      offset += headerBytes;

      switch (fieldNum) {
        case 2: // error_reason (enum)
          if (wireType === WIRE_TYPE_VARINT) {
            const [value, bytes] = readVarint(data, offset);
            result.errorReason = value;
            result.errorReasonName = errorReasons[value] || `UNKNOWN(${value})`;
            offset += bytes;
          }
          break;
        default:
          offset += skipField(data, offset, wireType);
      }
    }

    return result;
  } catch (error) {
    console.error('[PacketDecoder] Failed to decode Routing:', error);
    return null;
  }
}

/**
 * Decode Traceroute payload
 */
export function decodeTraceroute(data: Uint8Array): DecodedTraceroute | null {
  try {
    const result: DecodedTraceroute = { route: [], routeBack: [], snrTowards: [], snrBack: [] };
    let offset = 0;

    while (offset < data.length) {
      const [fieldNum, wireType, headerBytes] = parseFieldHeader(data, offset);
      offset += headerBytes;

      switch (fieldNum) {
        case 1: // route (repeated fixed32)
          if (wireType === WIRE_TYPE_FIXED32) {
            result.route!.push(readUint32LE(data, offset));
            offset += 4;
          } else if (wireType === WIRE_TYPE_LENGTH_DELIMITED) {
            // Packed repeated
            const [length, bytes] = readVarint(data, offset);
            offset += bytes;
            for (let i = 0; i < length; i += 4) {
              result.route!.push(readUint32LE(data, offset + i));
            }
            offset += length;
          }
          break;
        case 2: // route_back (repeated fixed32)
          if (wireType === WIRE_TYPE_FIXED32) {
            result.routeBack!.push(readUint32LE(data, offset));
            offset += 4;
          } else if (wireType === WIRE_TYPE_LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(data, offset);
            offset += bytes;
            for (let i = 0; i < length; i += 4) {
              result.routeBack!.push(readUint32LE(data, offset + i));
            }
            offset += length;
          }
          break;
        case 3: // snr_towards (repeated float)
          if (wireType === WIRE_TYPE_FIXED32) {
            result.snrTowards!.push(readFloatLE(data, offset));
            offset += 4;
          } else if (wireType === WIRE_TYPE_LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(data, offset);
            offset += bytes;
            for (let i = 0; i < length; i += 4) {
              result.snrTowards!.push(readFloatLE(data, offset + i));
            }
            offset += length;
          }
          break;
        case 4: // snr_back (repeated float)
          if (wireType === WIRE_TYPE_FIXED32) {
            result.snrBack!.push(readFloatLE(data, offset));
            offset += 4;
          } else if (wireType === WIRE_TYPE_LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(data, offset);
            offset += bytes;
            for (let i = 0; i < length; i += 4) {
              result.snrBack!.push(readFloatLE(data, offset + i));
            }
            offset += length;
          }
          break;
        default:
          offset += skipField(data, offset, wireType);
      }
    }

    return result;
  } catch (error) {
    console.error('[PacketDecoder] Failed to decode Traceroute:', error);
    return null;
  }
}

/**
 * Convert a payload object (with numeric keys) to Uint8Array
 */
export function payloadToUint8Array(payload: Record<string, number> | Uint8Array): Uint8Array {
  if (payload instanceof Uint8Array) {
    return payload;
  }

  // Get numeric keys and sort them
  const keys = Object.keys(payload)
    .map(k => parseInt(k, 10))
    .filter(k => !isNaN(k))
    .sort((a, b) => a - b);

  const result = new Uint8Array(keys.length);
  keys.forEach((key, idx) => {
    result[idx] = payload[key.toString()];
  });

  return result;
}

/**
 * Convert node number to hex ID
 */
export function nodeNumToId(num: number): string {
  return `!${num.toString(16).padStart(8, '0')}`;
}

/**
 * Main function to decode a packet payload based on portnum
 */
export function decodePacketPayload(
  portnum: number,
  payload: Record<string, number> | Uint8Array
): DecodedPayload {
  const data = payloadToUint8Array(payload);
  const result: DecodedPayload = {
    portnum,
    portnumName: getPortnumName(portnum),
  };

  // Keep raw payload for reference
  if (!(payload instanceof Uint8Array)) {
    result.rawPayload = payload;
  }

  switch (portnum) {
    case PORTNUM.TEXT_MESSAGE_APP:
      result.text = new TextDecoder().decode(data);
      break;

    case PORTNUM.POSITION_APP:
      result.position = decodePosition(data) || undefined;
      break;

    case PORTNUM.NODEINFO_APP:
      result.user = decodeUser(data) || undefined;
      break;

    case PORTNUM.TELEMETRY_APP:
      result.telemetry = decodeTelemetry(data) || undefined;
      break;

    case PORTNUM.NEIGHBORINFO_APP:
      result.neighborInfo = decodeNeighborInfo(data) || undefined;
      break;

    case PORTNUM.ROUTING_APP:
      result.routing = decodeRouting(data) || undefined;
      break;

    case PORTNUM.TRACEROUTE_APP:
      result.traceroute = decodeTraceroute(data) || undefined;
      break;

    default:
      // Keep raw payload for unknown types
      break;
  }

  return result;
}
