/**
 * FromRadio Protobuf Decoder
 *
 * Decodes FromRadio messages from Meshtastic serial interface.
 * FromRadio contains various message types from the device:
 * - packet: MeshPacket (received mesh packets)
 * - my_info: MyNodeInfo (device's node info)
 * - node_info: NodeInfo (info about nodes in the mesh)
 * - config: Config (device configuration)
 * - config_complete_id: signals end of config dump
 * - rebooted: device just rebooted
 * - channel: Channel configuration
 * - metadata: Device metadata
 */

import {
  decodeMeshPacket,
  decodeData,
  decodePosition,
  decodeUser,
  decodeTelemetry,
  getPortNumName,
  getHardwareModelName,
  MESHTASTIC_PORTNUM,
  type DecodedMeshPacket,
} from '../crypto/protobuf-decoder';

// Wire types
const WIRE_TYPE = {
  VARINT: 0,
  FIXED64: 1,
  LENGTH_DELIMITED: 2,
  FIXED32: 5,
} as const;

/**
 * Read a varint from buffer
 */
function readVarint(buf: Buffer, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let bytesRead = 0;

  while (offset + bytesRead < buf.length) {
    const byte = buf[offset + bytesRead];
    bytesRead++;

    result |= (byte & 0x7f) << shift;

    if ((byte & 0x80) === 0) {
      break;
    }

    shift += 7;
    if (shift >= 64) {
      throw new Error('Varint too large');
    }
  }

  return [result >>> 0, bytesRead];
}

/**
 * Parse field header (field number + wire type)
 */
function parseFieldHeader(buf: Buffer, offset: number): [number, number, number] {
  const [tag, bytesRead] = readVarint(buf, offset);
  const fieldNum = tag >>> 3;
  const wireType = tag & 0x07;
  return [fieldNum, wireType, bytesRead];
}

/**
 * Skip a field based on wire type
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
    default:
      return 1;
  }
}

/**
 * Decoded MyNodeInfo
 */
export interface DecodedMyNodeInfo {
  myNodeNum: number;
  rebootCount?: number;
  minAppVersion?: number;
  deviceId?: Buffer;
  pioEnv?: string;
  firmwareEdition?: number;
  nodedbCount?: number;
}

/**
 * Decode MyNodeInfo protobuf
 */
function decodeMyNodeInfo(buf: Buffer): DecodedMyNodeInfo | null {
  try {
    const result: DecodedMyNodeInfo = { myNodeNum: 0 };
    let offset = 0;

    while (offset < buf.length) {
      const [fieldNum, wireType, headerBytes] = parseFieldHeader(buf, offset);
      offset += headerBytes;

      switch (fieldNum) {
        case 1: // my_node_num (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.myNodeNum = value;
            offset += bytes;
          }
          break;
        case 8: // reboot_count (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.rebootCount = value;
            offset += bytes;
          }
          break;
        case 11: // min_app_version (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.minAppVersion = value;
            offset += bytes;
          }
          break;
        case 12: // device_id (bytes)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            result.deviceId = buf.subarray(offset, offset + length);
            offset += length;
          }
          break;
        case 13: // pio_env (string)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            result.pioEnv = buf.subarray(offset, offset + length).toString('utf8');
            offset += length;
          }
          break;
        case 15: // nodedb_count (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.nodedbCount = value;
            offset += bytes;
          }
          break;
        default:
          offset += skipField(buf, offset, wireType);
      }
    }

    return result;
  } catch (error) {
    console.error('[Serial] Failed to decode MyNodeInfo:', error);
    return null;
  }
}

/**
 * Decoded NodeInfo
 */
export interface DecodedNodeInfo {
  num: number;
  user?: {
    id?: string;
    longName?: string;
    shortName?: string;
    hwModel?: number;
    role?: number;
    publicKey?: Buffer;
  };
  position?: {
    latitudeI?: number;
    longitudeI?: number;
    altitude?: number;
    time?: number;
  };
  snr?: number;
  lastHeard?: number;
  deviceMetrics?: {
    batteryLevel?: number;
    voltage?: number;
    channelUtilization?: number;
    airUtilTx?: number;
    uptimeSeconds?: number;
  };
  channel?: number;
  viaMqtt?: boolean;
  hopsAway?: number;
  isFavorite?: boolean;
}

/**
 * Decode NodeInfo protobuf
 */
function decodeNodeInfo(buf: Buffer): DecodedNodeInfo | null {
  try {
    const result: DecodedNodeInfo = { num: 0 };
    let offset = 0;

    while (offset < buf.length) {
      const [fieldNum, wireType, headerBytes] = parseFieldHeader(buf, offset);
      offset += headerBytes;

      switch (fieldNum) {
        case 1: // num (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.num = value;
            offset += bytes;
          }
          break;
        case 2: // user (User message)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            const userBuf = buf.subarray(offset, offset + length);
            result.user = decodeUser(userBuf) || undefined;
            offset += length;
          }
          break;
        case 3: // position (Position message)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            const posBuf = buf.subarray(offset, offset + length);
            result.position = decodePosition(posBuf) || undefined;
            offset += length;
          }
          break;
        case 4: // snr (float)
          if (wireType === WIRE_TYPE.FIXED32) {
            result.snr = buf.readFloatLE(offset);
            offset += 4;
          }
          break;
        case 5: // last_heard (fixed32)
          if (wireType === WIRE_TYPE.FIXED32) {
            result.lastHeard = buf.readUInt32LE(offset);
            offset += 4;
          } else if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.lastHeard = value;
            offset += bytes;
          }
          break;
        case 6: // device_metrics (DeviceMetrics)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            const metricsBuf = buf.subarray(offset, offset + length);
            result.deviceMetrics = decodeTelemetry(metricsBuf)?.deviceMetrics || undefined;
            offset += length;
          }
          break;
        case 7: // channel (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.channel = value;
            offset += bytes;
          }
          break;
        case 8: // via_mqtt (bool)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.viaMqtt = value !== 0;
            offset += bytes;
          }
          break;
        case 9: // hops_away (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.hopsAway = value;
            offset += bytes;
          }
          break;
        case 10: // is_favorite (bool)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.isFavorite = value !== 0;
            offset += bytes;
          }
          break;
        default:
          offset += skipField(buf, offset, wireType);
      }
    }

    return result;
  } catch (error) {
    console.error('[Serial] Failed to decode NodeInfo:', error);
    return null;
  }
}

/**
 * Decoded FromRadio message
 */
export interface DecodedFromRadio {
  id: number;
  type: 'packet' | 'my_info' | 'node_info' | 'config_complete' | 'rebooted' | 'channel' | 'metadata' | 'log' | 'unknown';
  packet?: DecodedMeshPacket;
  myInfo?: DecodedMyNodeInfo;
  nodeInfo?: DecodedNodeInfo;
  configCompleteId?: number;
  rebooted?: boolean;
  // Add more payload types as needed
}

/**
 * Decode FromRadio protobuf message
 */
export function decodeFromRadio(buf: Buffer): DecodedFromRadio | null {
  try {
    const result: DecodedFromRadio = {
      id: 0,
      type: 'unknown',
    };

    let offset = 0;

    while (offset < buf.length) {
      const [fieldNum, wireType, headerBytes] = parseFieldHeader(buf, offset);
      offset += headerBytes;

      switch (fieldNum) {
        case 1: // id (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.id = value;
            offset += bytes;
          }
          break;

        case 2: // packet (MeshPacket)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            const packetBuf = buf.subarray(offset, offset + length);
            result.type = 'packet';
            result.packet = decodeMeshPacket(packetBuf) || undefined;
            offset += length;
          }
          break;

        case 3: // my_info (MyNodeInfo)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            const infoBuf = buf.subarray(offset, offset + length);
            result.type = 'my_info';
            result.myInfo = decodeMyNodeInfo(infoBuf) || undefined;
            offset += length;
          }
          break;

        case 4: // node_info (NodeInfo)
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            const nodeBuf = buf.subarray(offset, offset + length);
            result.type = 'node_info';
            result.nodeInfo = decodeNodeInfo(nodeBuf) || undefined;
            offset += length;
          }
          break;

        case 5: // config (Config) - skip for now
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes + length;
          }
          break;

        case 6: // log_record (LogRecord) - skip for now
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            result.type = 'log';
            offset += length;
          }
          break;

        case 7: // config_complete_id (uint32)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.type = 'config_complete';
            result.configCompleteId = value;
            offset += bytes;
          }
          break;

        case 8: // rebooted (bool)
          if (wireType === WIRE_TYPE.VARINT) {
            const [value, bytes] = readVarint(buf, offset);
            result.type = 'rebooted';
            result.rebooted = value !== 0;
            offset += bytes;
          }
          break;

        case 10: // channel (Channel) - skip for now
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            result.type = 'channel';
            offset += length;
          }
          break;

        case 13: // metadata (DeviceMetadata) - skip for now
          if (wireType === WIRE_TYPE.LENGTH_DELIMITED) {
            const [length, bytes] = readVarint(buf, offset);
            offset += bytes;
            result.type = 'metadata';
            offset += length;
          }
          break;

        default:
          offset += skipField(buf, offset, wireType);
      }
    }

    return result;
  } catch (error) {
    console.error('[Serial] Failed to decode FromRadio:', error);
    return null;
  }
}

/**
 * Convert node number to hex ID string (e.g., !298a814d)
 */
export function nodeNumToId(num: number): string {
  return `!${num.toString(16).padStart(8, '0')}`;
}

/**
 * Process a decoded FromRadio packet into a normalized format
 * Returns same format as MQTT processor for consistency
 */
export function processFromRadioPacket(fromRadio: DecodedFromRadio) {
  if (fromRadio.type === 'packet' && fromRadio.packet) {
    const packet = fromRadio.packet;

    // If packet has decoded data, process it
    if (packet.decoded) {
      const data = packet.decoded;
      const fromId = nodeNumToId(packet.from);
      const toId = nodeNumToId(packet.to);
      const timestamp = (packet.rxTime || Math.floor(Date.now() / 1000)) * 1000;

      switch (data.portnum) {
        case MESHTASTIC_PORTNUM.TEXT_MESSAGE_APP: {
          const text = data.payload.toString('utf8');
          return {
            type: 'text',
            data: {
              id: packet.id,
              from: fromId,
              to: toId,
              channel: packet.channel,
              text,
              timestamp,
              snr: packet.rxSnr,
              rssi: packet.rxRssi,
            }
          };
        }

        case MESHTASTIC_PORTNUM.POSITION_APP: {
          const position = decodePosition(data.payload);
          if (!position) return null;

          const lat = position.latitudeI ? position.latitudeI / 1e7 : undefined;
          const lon = position.longitudeI ? position.longitudeI / 1e7 : undefined;

          if (!lat || !lon) return null;

          return {
            type: 'position',
            data: {
              nodeId: fromId,
              nodeNum: packet.from,
              position: {
                latitude: lat,
                longitude: lon,
                altitude: position.altitude,
                timestamp: (position.time || packet.rxTime || Math.floor(Date.now() / 1000)) * 1000,
              },
              timestamp,
              snr: packet.rxSnr,
              rssi: packet.rxRssi,
            }
          };
        }

        case MESHTASTIC_PORTNUM.NODEINFO_APP: {
          const user = decodeUser(data.payload);
          if (!user) return null;

          return {
            type: 'nodeinfo',
            data: {
              id: user.id || fromId,
              nodeNum: packet.from,
              shortName: user.shortName || 'UNK',
              longName: user.longName || 'Unknown Node',
              hwModel: user.hwModel !== undefined
                ? getHardwareModelName(user.hwModel)
                : 'UNSET',
              role: user.role || 0,
              lastHeard: timestamp,
              snr: packet.rxSnr,
              rssi: packet.rxRssi,
            }
          };
        }

        case MESHTASTIC_PORTNUM.TELEMETRY_APP: {
          const telemetry = decodeTelemetry(data.payload);
          if (!telemetry) return null;

          return {
            type: 'telemetry',
            data: {
              nodeId: fromId,
              nodeNum: packet.from,
              timestamp,
              batteryLevel: telemetry.deviceMetrics?.batteryLevel,
              voltage: telemetry.deviceMetrics?.voltage,
              channelUtilization: telemetry.deviceMetrics?.channelUtilization,
              airUtilTx: telemetry.deviceMetrics?.airUtilTx,
              uptime: telemetry.deviceMetrics?.uptimeSeconds,
              snr: packet.rxSnr,
              rssi: packet.rxRssi,
            }
          };
        }

        default:
          return {
            type: getPortNumName(data.portnum).toLowerCase().replace('_app', ''),
            data: {
              from: fromId,
              to: toId,
              portnum: data.portnum,
              payload: data.payload.toString('hex'),
            }
          };
      }
    }

    // Encrypted packet (shouldn't happen from direct serial, but handle it)
    if (packet.encrypted) {
      return {
        type: 'encrypted',
        data: {
          from: nodeNumToId(packet.from),
          to: nodeNumToId(packet.to),
          channel: packet.channel,
          encrypted: packet.encrypted.toString('hex'),
        }
      };
    }
  }

  // Handle node_info from device's nodedb
  if (fromRadio.type === 'node_info' && fromRadio.nodeInfo) {
    const info = fromRadio.nodeInfo;
    const nodeId = nodeNumToId(info.num);

    return {
      type: 'nodeinfo',
      data: {
        id: info.user?.id || nodeId,
        nodeNum: info.num,
        shortName: info.user?.shortName || 'UNK',
        longName: info.user?.longName || 'Unknown Node',
        hwModel: info.user?.hwModel !== undefined
          ? getHardwareModelName(info.user.hwModel)
          : 'UNSET',
        role: info.user?.role || 0,
        lastHeard: info.lastHeard ? info.lastHeard * 1000 : Date.now(),
        snr: info.snr,
        hopsAway: info.hopsAway,
        batteryLevel: info.deviceMetrics?.batteryLevel,
        voltage: info.deviceMetrics?.voltage,
        position: info.position ? {
          latitude: info.position.latitudeI ? info.position.latitudeI / 1e7 : undefined,
          longitude: info.position.longitudeI ? info.position.longitudeI / 1e7 : undefined,
          altitude: info.position.altitude,
        } : undefined,
      }
    };
  }

  // Handle my_info
  if (fromRadio.type === 'my_info' && fromRadio.myInfo) {
    return {
      type: 'my_info',
      data: {
        myNodeNum: fromRadio.myInfo.myNodeNum,
        myNodeId: nodeNumToId(fromRadio.myInfo.myNodeNum),
        rebootCount: fromRadio.myInfo.rebootCount,
        nodedbCount: fromRadio.myInfo.nodedbCount,
      }
    };
  }

  // Handle rebooted
  if (fromRadio.type === 'rebooted') {
    return {
      type: 'rebooted',
      data: { rebooted: true }
    };
  }

  // Handle config_complete
  if (fromRadio.type === 'config_complete') {
    return {
      type: 'config_complete',
      data: { configCompleteId: fromRadio.configCompleteId }
    };
  }

  return null;
}
