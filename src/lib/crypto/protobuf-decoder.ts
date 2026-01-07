/**
 * Meshtastic Protobuf Decoder
 *
 * Lightweight manual decoder for Meshtastic protobuf messages.
 * Handles ServiceEnvelope, MeshPacket, and Data message types.
 *
 * This avoids the need for protobuf.js or generated code while
 * supporting the specific message types used in MQTT.
 */

// Protobuf wire types
const WIRE_TYPE = {
  VARINT: 0,
  FIXED64: 1,
  LENGTH_DELIMITED: 2,
  START_GROUP: 3, // deprecated
  END_GROUP: 4,   // deprecated
  FIXED32: 5,
} as const;

// Meshtastic port numbers (from portnums.proto)
export const MESHTASTIC_PORTNUM = {
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

export type PortNum = typeof MESHTASTIC_PORTNUM[keyof typeof MESHTASTIC_PORTNUM];

// Hardware model enum (partial, most common)
export const HARDWARE_MODEL = {
  UNSET: 0,
  TLORA_V2: 1,
  TLORA_V1: 2,
  TLORA_V2_1_1P6: 3,
  TBEAM: 4,
  HELTEC_V2_0: 5,
  TBEAM_V0P7: 6,
  T_ECHO: 7,
  TLORA_V1_1P3: 8,
  RAK4631: 9,
  HELTEC_V2_1: 10,
  HELTEC_V1: 11,
  LILYGO_TBEAM_S3_CORE: 12,
  RAK11200: 13,
  NANO_G1: 14,
  TLORA_V2_1_1P8: 15,
  TLORA_T3_S3: 16,
  NANO_G1_EXPLORER: 17,
  NANO_G2_ULTRA: 18,
  LORA_TYPE: 19,
  WIPHONE: 20,
  WIO_WM1110: 21,
  RAK2560: 22,
  HELTEC_HRU_3601: 23,
  STATION_G1: 25,
  RAK11310: 26,
  SENSELORA_RP2040: 27,
  SENSELORA_S3: 28,
  CANARYONE: 29,
  RP2040_LORA: 30,
  STATION_G2: 31,
  LORA_RELAY_V1: 32,
  NRF52840DK: 33,
  PPR: 34,
  GENIEBLOCKS: 35,
  NRF52_UNKNOWN: 36,
  PORTDUINO: 37,
  ANDROID_SIM: 38,
  DIY_V1: 39,
  NRF52840_PCA10059: 40,
  DR_DEV: 41,
  M5STACK: 42,
  HELTEC_V3: 43,
  HELTEC_WSL_V3: 44,
  BETAFPV_2400_TX: 45,
  BETAFPV_900_NANO_TX: 46,
  RPI_PICO: 47,
  HELTEC_WIRELESS_TRACKER: 48,
  HELTEC_WIRELESS_PAPER: 49,
  T_DECK: 50,
  T_WATCH_S3: 51,
  PICOMPUTER_S3: 52,
  HELTEC_HT62: 53,
  EBYTE_ESP32_S3: 54,
  ESP32_S3_PICO: 55,
  CHATTER_2: 56,
  HELTEC_WIRELESS_PAPER_V1_0: 57,
  HELTEC_WIRELESS_TRACKER_V1_0: 58,
  UNPHONE: 59,
  TD_LORAC: 60,
  CDEBYTE_EORA_S3: 61,
  TWC_MESH_V4: 62,
  NRF52_PROMICRO_DIY: 63,
  RADIOMASTER_900_BANDIT_NANO: 64,
  HELTEC_CAPSULE_SENSOR_V3: 65,
  HELTEC_VISION_MASTER_T190: 66,
  HELTEC_VISION_MASTER_E213: 67,
  HELTEC_VISION_MASTER_E290: 68,
  HELTEC_MESH_NODE_T114: 69,
  SENSECAP_INDICATOR: 70,
  TRACKER_T1000_E: 71,
  RAK3172: 72,
  WIO_E5: 73,
  RADIOMASTER_900_BANDIT: 74,
  ME25LS01_4Y10TD: 75,
  RP2040_FEATHER_RFM95: 76,
  M5STACK_COREBASIC: 77,
  M5STACK_CORE2: 78,
} as const;

/**
 * Read a varint from buffer at given offset
 * Returns [value, bytesRead]
 */
function readVarint(buf: Buffer, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let bytesRead = 0;

  while (offset + bytesRead < buf.length) {
    const byte = buf[offset + bytesRead];
    bytesRead++;

    if (shift < 28) {
      // Normal case: accumulate 7 bits at a time
      result |= (byte & 0x7f) << shift;
    } else if (shift === 28) {
      // For the 5th byte, only use 4 bits (32-bit value)
      result |= (byte & 0x0f) << shift;
    }
    // For bytes 6-10, we just consume them to handle sign extension
    // of negative int32 values encoded as int64

    if ((byte & 0x80) === 0) {
      break;
    }
    shift += 7;

    // Allow up to 10 bytes for varint (handles negative int32 encoded as int64)
    if (bytesRead > 10) {
      throw new Error('Varint too large');
    }
  }

  // Return as unsigned 32-bit
  return [result >>> 0, bytesRead];
}

/**
 * Read a signed varint (NOT zigzag encoded - raw two's complement)
 * This is for int32/int64 fields that can be negative
 */
function readSignedVarint(buf: Buffer, offset: number): [number, number] {
  const [value, bytesRead] = readVarint(buf, offset);
  // Convert to signed 32-bit if high bit is set
  if (value > 0x7fffffff) {
    return [value - 0x100000000, bytesRead];
  }
  return [value, bytesRead];
}

/**
 * Parse protobuf field header
 * Returns [fieldNumber, wireType, bytesRead]
 */
function parseFieldHeader(buf: Buffer, offset: number): [number, number, number] {
  const [tag, bytesRead] = readVarint(buf, offset);
  const fieldNumber = tag >>> 3;
  const wireType = tag & 0x07;
  return [fieldNumber, wireType, bytesRead];
}

/**
 * Skip a field based on its wire type
 * Returns bytes to skip
 */
function skipField(buf: Buffer, offset: number, wireType: number): number {
  switch (wireType) {
    case WIRE_TYPE.VARINT: {
      const [, bytesRead] = readVarint(buf, offset);
      return bytesRead;
    }
    case WIRE_TYPE.FIXED64:
      return 8;
    case WIRE_TYPE.LENGTH_DELIMITED: {
      const [length, bytesRead] = readVarint(buf, offset);
      return bytesRead + length;
    }
    case WIRE_TYPE.FIXED32:
      return 4;
    case 3: // Start group (deprecated) - skip to end group
    case 4: // End group (deprecated) - nothing to skip
      return 0;
    case 6: // Reserved wire type - try to skip as varint
    case 7: // Reserved wire type - try to skip as varint
      // These shouldn't appear, but if they do, try to skip past them
      console.warn(`[Protobuf] Encountered reserved wire type ${wireType} at offset ${offset}`);
      try {
        const [, bytesRead] = readVarint(buf, offset);
        return bytesRead;
      } catch {
        return 1; // Skip single byte as fallback
      }
    default:
      console.warn(`[Protobuf] Unknown wire type: ${wireType} at offset ${offset}`);
      return 1; // Skip single byte as fallback
  }
}

// ============= Message Types =============

/**
 * Decoded MeshPacket.Data payload
 */
export interface DecodedData {
  portnum: PortNum;
  payload: Buffer;
  wantResponse?: boolean;
  dest?: number;
  source?: number;
  requestId?: number;
  replyId?: number;
  emoji?: number;
}

/**
 * Decoded MeshPacket (either decoded or encrypted)
 */
export interface DecodedMeshPacket {
  from: number;
  to: number;
  channel: number;
  id: number;
  rxTime?: number;
  rxSnr?: number;
  rxRssi?: number;
  hopLimit?: number;
  hopStart?: number;
  wantAck?: boolean;
  priority?: number;
  viaMqtt?: boolean;
  delayed?: number;
  publicKey?: Buffer;
  pkiEncrypted?: boolean;

  // Payload variant - either decoded or encrypted
  decoded?: DecodedData;
  encrypted?: Buffer;
}

/**
 * Decoded ServiceEnvelope (MQTT wrapper)
 */
export interface DecodedServiceEnvelope {
  packet?: DecodedMeshPacket;
  channelId?: string;
  gatewayId?: string;
}

/**
 * Decoded Position
 */
export interface DecodedPosition {
  latitudeI?: number;  // latitude * 1e7
  longitudeI?: number; // longitude * 1e7
  altitude?: number;
  time?: number;
  locationSource?: number;
  altitudeSource?: number;
  timestamp?: number;
  timestampMillisAdjust?: number;
  altitudeHae?: number;
  altitudeGeoidalSeparation?: number;
  pdop?: number;
  hdop?: number;
  vdop?: number;
  gpsAccuracy?: number;
  groundSpeed?: number;
  groundTrack?: number;
  fixQuality?: number;
  fixType?: number;
  satsInView?: number;
  sensorId?: number;
  nextUpdate?: number;
  seqNumber?: number;
  precisionBits?: number;
}

/**
 * Decoded User (NodeInfo)
 */
export interface DecodedUser {
  id?: string;
  longName?: string;
  shortName?: string;
  macaddr?: Buffer;
  hwModel?: number;
  isLicensed?: boolean;
  role?: number;
  publicKey?: Buffer;
}

/**
 * Decoded Telemetry
 */
export interface DecodedTelemetry {
  time?: number;
  deviceMetrics?: {
    batteryLevel?: number;
    voltage?: number;
    channelUtilization?: number;
    airUtilTx?: number;
    uptimeSeconds?: number;
  };
  environmentMetrics?: {
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
    windGust?: number;
    windLull?: number;
  };
}

// ============= Decoders =============

/**
 * Decode Data (inner payload of MeshPacket)
 */
export function decodeData(buf: Buffer): DecodedData | null {
  try {
    const result: DecodedData = {
      portnum: 0,
      payload: Buffer.alloc(0),
    };

    let offset = 0;
    while (offset < buf.length) {
      const [fieldNum, wireType, headerBytes] = parseFieldHeader(buf, offset);
      offset += headerBytes;

      switch (fieldNum) {
        case 1: // portnum (varint)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.portnum = value as PortNum;
            offset += bytes;
          }
          break;
        case 2: // payload (bytes)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            result.payload = buf.subarray(offset, offset + length);
            offset += length;
          }
          break;
        case 3: // want_response (bool)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.wantResponse = value !== 0;
            offset += bytes;
          }
          break;
        case 4: // dest (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.dest = value;
            offset += bytes;
          }
          break;
        case 5: // source (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.source = value;
            offset += bytes;
          }
          break;
        case 6: // request_id (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.requestId = value;
            offset += bytes;
          }
          break;
        case 7: // reply_id (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.replyId = value;
            offset += bytes;
          }
          break;
        case 8: // emoji (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.emoji = value;
            offset += bytes;
          }
          break;
        default:
          offset += skipField(buf, offset, wireType);
      }
    }

    return result;
  } catch (error) {
    console.error('[Protobuf] Failed to decode Data:', error);
    return null;
  }
}

/**
 * Decode MeshPacket
 */
export function decodeMeshPacket(buf: Buffer): DecodedMeshPacket | null {
  try {
    const result: DecodedMeshPacket = {
      from: 0,
      to: 0,
      channel: 0,
      id: 0,
    };

    console.log(`[Protobuf] Decoding MeshPacket (${buf.length} bytes): ${buf.subarray(0, 30).toString('hex')}...`);

    let offset = 0;
    while (offset < buf.length) {
      const [fieldNum, wireType, headerBytes] = parseFieldHeader(buf, offset);
      console.log(`[Protobuf] Field ${fieldNum}, wireType ${wireType} at offset ${offset}`);
      offset += headerBytes;

      switch (fieldNum) {
        case 1: // from (fixed32 per proto)
          if (wireType === WIRE_TYPE.FIXED32) {
            result.from = buf.readUInt32LE(offset);
            offset += 4;
          } else if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.from = value;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 2: // to (fixed32 per proto)
          if (wireType === WIRE_TYPE.FIXED32) {
            result.to = buf.readUInt32LE(offset);
            offset += 4;
          } else if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.to = value;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 3: // channel (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.channel = value;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 4: // decoded (Data message)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            const dataPayload = buf.subarray(offset, offset + length);
            result.decoded = decodeData(dataPayload) || undefined;
            offset += length;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 5: // encrypted (bytes)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            result.encrypted = buf.subarray(offset, offset + length);
            offset += length;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 6: // id (fixed32 per proto)
          if (wireType === WIRE_TYPE.FIXED32) {
            result.id = buf.readUInt32LE(offset);
            offset += 4;
          } else if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.id = value;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 7: // rx_time (fixed32 per proto)
          if (wireType === WIRE_TYPE.FIXED32) {
            result.rxTime = buf.readUInt32LE(offset);
            offset += 4;
          } else if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.rxTime = value;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 8: // rx_snr (float)
          if (wireType === WIRE_TYPE.FIXED32) {
            result.rxSnr = buf.readFloatLE(offset);
            offset += 4;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 9: // hop_limit (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.hopLimit = value;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 10: // want_ack (bool)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.wantAck = value !== 0;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 11: // priority (enum)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.priority = value;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 12: // rx_rssi (int32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readSignedVarint(buf, offset);
            result.rxRssi = value;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 13: // delayed (enum)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.delayed = value;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 14: // via_mqtt (bool)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.viaMqtt = value !== 0;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 15: // hop_start (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.hopStart = value;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 16: // public_key (bytes)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            result.publicKey = buf.subarray(offset, offset + length);
            offset += length;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 17: // pki_encrypted (bool)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.pkiEncrypted = value !== 0;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        default:
          offset += skipField(buf, offset, wireType);
      }
    }

    return result;
  } catch (error) {
    console.error('[Protobuf] Failed to decode MeshPacket:', error);
    return null;
  }
}

/**
 * Decode ServiceEnvelope (MQTT wrapper message)
 */
export function decodeServiceEnvelope(buf: Buffer): DecodedServiceEnvelope | null {
  try {
    const result: DecodedServiceEnvelope = {};

    let offset = 0;
    while (offset < buf.length) {
      const [fieldNum, wireType, headerBytes] = parseFieldHeader(buf, offset);
      offset += headerBytes;

      switch (fieldNum) {
        case 1: // packet (MeshPacket)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            const packetData = buf.subarray(offset, offset + length);
            result.packet = decodeMeshPacket(packetData) || undefined;
            offset += length;
          }
          break;
        case 2: // channel_id (string)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            result.channelId = buf.subarray(offset, offset + length).toString('utf8');
            offset += length;
          }
          break;
        case 3: // gateway_id (string)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            result.gatewayId = buf.subarray(offset, offset + length).toString('utf8');
            offset += length;
          }
          break;
        default:
          offset += skipField(buf, offset, wireType);
      }
    }

    return result;
  } catch (error) {
    console.error('[Protobuf] Failed to decode ServiceEnvelope:', error);
    return null;
  }
}

/**
 * Decode Position message
 */
export function decodePosition(buf: Buffer): DecodedPosition | null {
  try {
    const result: DecodedPosition = {};

    let offset = 0;
    while (offset < buf.length) {
      const [fieldNum, wireType, headerBytes] = parseFieldHeader(buf, offset);
      offset += headerBytes;

      switch (fieldNum) {
        case 1: // latitude_i (sfixed32)
          if (wireType === WIRE_TYPE.FIXED32) {
            result.latitudeI = buf.readInt32LE(offset);
            offset += 4;
          } else if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readSignedVarint(buf, offset);
            result.latitudeI = value;
            offset += bytes;
          }
          break;
        case 2: // longitude_i (sfixed32)
          if (wireType === WIRE_TYPE.FIXED32) {
            result.longitudeI = buf.readInt32LE(offset);
            offset += 4;
          } else if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readSignedVarint(buf, offset);
            result.longitudeI = value;
            offset += bytes;
          }
          break;
        case 3: // altitude (int32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readSignedVarint(buf, offset);
            result.altitude = value;
            offset += bytes;
          }
          break;
        case 4: // time (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.time = value;
            offset += bytes;
          } else if (wireType === WIRE_TYPE.FIXED32) {
            result.time = buf.readUInt32LE(offset);
            offset += 4;
          }
          break;
        case 9: // timestamp (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.timestamp = value;
            offset += bytes;
          } else if (wireType === WIRE_TYPE.FIXED32) {
            result.timestamp = buf.readUInt32LE(offset);
            offset += 4;
          }
          break;
        case 14: // precision_bits (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.precisionBits = value;
            offset += bytes;
          }
          break;
        default:
          offset += skipField(buf, offset, wireType);
      }
    }

    return result;
  } catch (error) {
    console.error('[Protobuf] Failed to decode Position:', error);
    return null;
  }
}

/**
 * Decode User (NodeInfo) message
 */
export function decodeUser(buf: Buffer): DecodedUser | null {
  try {
    const result: DecodedUser = {};

    let offset = 0;
    while (offset < buf.length) {
      const [fieldNum, wireType, headerBytes] = parseFieldHeader(buf, offset);
      offset += headerBytes;

      switch (fieldNum) {
        case 1: // id (string)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            result.id = buf.subarray(offset, offset + length).toString('utf8');
            offset += length;
          }
          break;
        case 2: // long_name (string)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            result.longName = buf.subarray(offset, offset + length).toString('utf8');
            offset += length;
          }
          break;
        case 3: // short_name (string)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            result.shortName = buf.subarray(offset, offset + length).toString('utf8');
            offset += length;
          }
          break;
        case 4: // macaddr (bytes)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            result.macaddr = buf.subarray(offset, offset + length);
            offset += length;
          }
          break;
        case 5: // hw_model (enum)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.hwModel = value;
            offset += bytes;
          }
          break;
        case 6: // is_licensed (bool)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.isLicensed = value !== 0;
            offset += bytes;
          }
          break;
        case 7: // role (enum)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.role = value;
            offset += bytes;
          }
          break;
        case 8: // public_key (bytes)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            result.publicKey = buf.subarray(offset, offset + length);
            offset += length;
          }
          break;
        default:
          offset += skipField(buf, offset, wireType);
      }
    }

    return result;
  } catch (error) {
    console.error('[Protobuf] Failed to decode User:', error);
    return null;
  }
}

/**
 * Decode Telemetry message (partial - device metrics)
 */
export function decodeTelemetry(buf: Buffer): DecodedTelemetry | null {
  try {
    const result: DecodedTelemetry = {};

    let offset = 0;
    while (offset < buf.length) {
      const [fieldNum, wireType, headerBytes] = parseFieldHeader(buf, offset);
      offset += headerBytes;

      switch (fieldNum) {
        case 1: // time (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.time = value;
            offset += bytes;
          } else if (wireType === WIRE_TYPE.FIXED32) {
            result.time = buf.readUInt32LE(offset);
            offset += 4;
          }
          break;
        case 2: // device_metrics (embedded message)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            const metricsData = buf.subarray(offset, offset + length);
            result.deviceMetrics = decodeDeviceMetrics(metricsData);
            offset += length;
          }
          break;
        case 3: // environment_metrics (embedded message)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            // Skip for now - can add later if needed
            offset += length;
          }
          break;
        default:
          offset += skipField(buf, offset, wireType);
      }
    }

    return result;
  } catch (error) {
    console.error('[Protobuf] Failed to decode Telemetry:', error);
    return null;
  }
}

/**
 * Decode DeviceMetrics embedded message
 */
function decodeDeviceMetrics(buf: Buffer): DecodedTelemetry['deviceMetrics'] {
  const result: NonNullable<DecodedTelemetry['deviceMetrics']> = {};

  let offset = 0;
  while (offset < buf.length) {
    const [fieldNum, wireType, headerBytes] = parseFieldHeader(buf, offset);
    offset += headerBytes;

    switch (fieldNum) {
      case 1: // battery_level (uint32)
        if (wireType === WIRE_TYPE.VARINT) {
          const [value, bytes] = readVarint(buf, offset);
          result.batteryLevel = value;
          offset += bytes;
        }
        break;
      case 2: // voltage (float)
        if (wireType === WIRE_TYPE.FIXED32) {
          result.voltage = buf.readFloatLE(offset);
          offset += 4;
        }
        break;
      case 3: // channel_utilization (float)
        if (wireType === WIRE_TYPE.FIXED32) {
          result.channelUtilization = buf.readFloatLE(offset);
          offset += 4;
        }
        break;
      case 4: // air_util_tx (float)
        if (wireType === WIRE_TYPE.FIXED32) {
          result.airUtilTx = buf.readFloatLE(offset);
          offset += 4;
        }
        break;
      case 5: // uptime_seconds (uint32)
        if (wireType === WIRE_TYPE.VARINT) {
          const [value, bytes] = readVarint(buf, offset);
          result.uptimeSeconds = value;
          offset += bytes;
        }
        break;
      default:
        offset += skipField(buf, offset, wireType);
    }
  }

  return result;
}

/**
 * Get port number name
 */
export function getPortNumName(portnum: PortNum): string {
  const entries = Object.entries(MESHTASTIC_PORTNUM);
  const found = entries.find(([, value]) => value === portnum);
  return found ? found[0] : `UNKNOWN_${portnum}`;
}

/**
 * Get hardware model name
 */
export function getHardwareModelName(model: number): string {
  const entries = Object.entries(HARDWARE_MODEL);
  const found = entries.find(([, value]) => value === model);
  return found ? found[0] : `UNKNOWN_${model}`;
}

/**
 * Decoded MapReport message
 * Sent on /map/ topics for unencrypted position reports
 */
export interface DecodedMapReport {
  longName?: string;
  shortName?: string;
  role?: number;
  hwModel?: number;
  firmwareVersion?: string;
  region?: number;
  modemPreset?: number;
  hasDefaultChannel?: boolean;
  latitudeI?: number;
  longitudeI?: number;
  altitude?: number;
  positionPrecision?: number;
  numOnlineLocalNodes?: number;
  hasOptedReportLocation?: boolean;
}

/**
 * Decode MapReport protobuf message
 * MapReport is sent raw (not in ServiceEnvelope) on /map/ topics
 */
export function decodeMapReport(buf: Buffer): DecodedMapReport | null {
  try {
    const result: DecodedMapReport = {};

    let offset = 0;
    while (offset < buf.length) {
      const [fieldNum, wireType, headerBytes] = parseFieldHeader(buf, offset);
      offset += headerBytes;

      switch (fieldNum) {
        case 1: // long_name (string)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            result.longName = buf.subarray(offset, offset + length).toString('utf8');
            offset += length;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 2: // short_name (string)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            result.shortName = buf.subarray(offset, offset + length).toString('utf8');
            offset += length;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 3: // role (enum)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.role = value;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 4: // hw_model (enum)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.hwModel = value;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 5: // firmware_version (string)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            result.firmwareVersion = buf.subarray(offset, offset + length).toString('utf8');
            offset += length;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 6: // region (enum)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.region = value;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 7: // modem_preset (enum)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.modemPreset = value;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 8: // has_default_channel (bool)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.hasDefaultChannel = value !== 0;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 9: // latitude_i (sfixed32)
          if (wireType === WIRE_TYPE.FIXED32) {
            result.latitudeI = buf.readInt32LE(offset);
            offset += 4;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 10: // longitude_i (sfixed32)
          if (wireType === WIRE_TYPE.FIXED32) {
            result.longitudeI = buf.readInt32LE(offset);
            offset += 4;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 11: // altitude (int32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readSignedVarint(buf, offset);
            result.altitude = value;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 12: // position_precision (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.positionPrecision = value;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 13: // num_online_local_nodes (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.numOnlineLocalNodes = value;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        case 14: // has_opted_report_location (bool)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.hasOptedReportLocation = value !== 0;
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;
        default:
          offset += skipField(buf, offset, wireType);
      }
    }

    return result;
  } catch (error) {
    console.error('[Protobuf] Failed to decode MapReport:', error);
    return null;
  }
}

/**
 * Decoded RouteDiscovery (Traceroute) message structure
 */
export interface DecodedRouteDiscovery {
  route: number[];       // Node IDs traversed towards destination
  snrTowards?: number[]; // SNR values for each hop towards destination
  routeBack?: number[];  // Node IDs traversed on return path
  snrBack?: number[];    // SNR values for each hop on return
}

/**
 * Decode RouteDiscovery (Traceroute) protobuf message
 * Meshtastic proto: RouteDiscovery
 */
export function decodeRouteDiscovery(buf: Buffer): DecodedRouteDiscovery | null {
  try {
    const route: number[] = [];
    const snrTowards: number[] = [];
    const routeBack: number[] = [];
    const snrBack: number[] = [];

    let offset = 0;
    while (offset < buf.length) {
      const [fieldNum, wireType, headerBytes] = parseFieldHeader(buf, offset);
      offset += headerBytes;

      switch (fieldNum) {
        case 1: // route - repeated fixed32 (can be packed or unpacked)
          if (wireType === WIRE_TYPE.FIXED32) {
            // Unpacked fixed32
            route.push(buf.readUInt32LE(offset));
            offset += 4;
          } else if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            // Packed repeated fixed32
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            const endOffset = offset + length;
            while (offset < endOffset) {
              route.push(buf.readUInt32LE(offset));
              offset += 4;
            }
          } else if (wireType === WIRE_TYPE.VARINT) {
            // Some implementations use varint for uint32
            const [value, bytes] = readVarint(buf, offset);
            route.push(value);
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;

        case 2: // snr_towards - repeated int8 (as sint32/varint)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readSignedVarint(buf, offset);
            snrTowards.push(value);
            offset += bytes;
          } else if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            // Packed repeated
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            const endOffset = offset + length;
            while (offset < endOffset) {
              const [value, valBytes] = readSignedVarint(buf, offset);
              snrTowards.push(value);
              offset += valBytes;
            }
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;

        case 3: // route_back - repeated fixed32
          if (wireType === WIRE_TYPE.FIXED32) {
            routeBack.push(buf.readUInt32LE(offset));
            offset += 4;
          } else if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            const endOffset = offset + length;
            while (offset < endOffset) {
              routeBack.push(buf.readUInt32LE(offset));
              offset += 4;
            }
          } else if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            routeBack.push(value);
            offset += bytes;
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;

        case 4: // snr_back - repeated int8 (as sint32/varint)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readSignedVarint(buf, offset);
            snrBack.push(value);
            offset += bytes;
          } else if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            const endOffset = offset + length;
            while (offset < endOffset) {
              const [value, valBytes] = readSignedVarint(buf, offset);
              snrBack.push(value);
              offset += valBytes;
            }
          } else {
            offset += skipField(buf, offset, wireType);
          }
          break;

        default:
          offset += skipField(buf, offset, wireType);
      }
    }

    // Must have at least a route to be valid
    if (route.length === 0) {
      return null;
    }

    return {
      route,
      snrTowards: snrTowards.length > 0 ? snrTowards : undefined,
      routeBack: routeBack.length > 0 ? routeBack : undefined,
      snrBack: snrBack.length > 0 ? snrBack : undefined,
    };
  } catch (error) {
    console.error('[Protobuf] Failed to decode RouteDiscovery:', error);
    return null;
  }
}
