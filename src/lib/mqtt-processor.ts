/**
 * MQTT Message Processor
 *
 * Parses and processes MQTT messages from Meshtastic broker
 * Handles nodeinfo, position, telemetry, and message packets
 *
 * Supports decryption of encrypted LongFast channel messages using
 * the default Meshtastic key (AQ==).
 */

import type { Node, Position } from "@/types/node";
import type { ProcessedTraceroute } from "@/types/extended-packets";
import {
  decryptWithDefaultKey,
  extractChannelFromTopic,
  getKeyForChannel,
  keyFromHex,
  decryptPayload,
  isDefaultChannel,
  MESHTASTIC_KEYS,
} from "@/lib/crypto/meshtastic-crypto";
import {
  decodeServiceEnvelope,
  decodeMeshPacket,
  decodeData,
  decodePosition,
  decodeUser,
  decodeTelemetry,
  decodeMapReport,
  decodeRouteDiscovery,
  getPortNumName,
  getHardwareModelName,
  MESHTASTIC_PORTNUM,
  type DecodedMeshPacket,
  type DecodedData,
  type DecodedMapReport,
  type DecodedRouteDiscovery,
} from "@/lib/crypto/protobuf-decoder";

export interface MQTTPacket {
  channel: number;
  from: number;
  hop_start?: number;
  hops_away?: number;
  id: number;
  payload: any;
  rssi?: number;
  sender: string;
  snr?: number;
  timestamp: number;
  to: number;
  type: string;
}

export interface ProcessedNodeInfo {
  id: string;
  nodeNum: number;
  shortName: string;
  longName: string;
  hwModel: string;
  role: number;
  lastHeard: number;
  snr?: number;
  rssi?: number;
  hopsAway?: number;
}

export interface ProcessedPosition {
  nodeId: string;
  nodeNum: number;
  position: Position;
  timestamp: number;
  snr?: number;
  rssi?: number;
}

export interface ProcessedTelemetry {
  nodeId: string;
  nodeNum: number;
  timestamp: number;
  batteryLevel?: number;
  voltage?: number;
  channelUtilization?: number;
  airUtilTx?: number;
  uptime?: number;
  temperature?: number;
  snr?: number;
  rssi?: number;
}

export interface ProcessedMessage {
  id: number;
  from: string;
  to: string;
  channel: number;
  text?: string;
  timestamp: number;
  snr?: number;
  rssi?: number;
  hopsAway?: number;
  replyTo?: number;
}

// Re-export ProcessedTraceroute from the types file
export type { ProcessedTraceroute } from "@/types/extended-packets";

export interface ProcessedMapReport {
  id?: string;
  shortName?: string;
  longName?: string;
  hwModel: string;
  role?: number;
  firmwareVersion?: string;
  region?: number;
  modemPreset?: number;
  hasDefaultChannel?: boolean;
  position?: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
  positionPrecision?: number;
  numOnlineLocalNodes?: number;
  timestamp: number;
}

/**
 * Determine message type from MQTT topic
 */
export function getMessageType(topic: string): string | null {
  // msh/US/KY/2/json/LongFast/!nodeId
  // msh/US/KY/2/e/LongFast/!nodeId (encrypted)
  // msh/US/KY/2/map/!nodeId (map report - unencrypted protobuf)

  if (topic.includes("/json/")) {
    return "json";
  } else if (topic.includes("/e/")) {
    return "encrypted";
  } else if (topic.includes("/map/")) {
    return "mapreport";
  } else if (topic.includes("/c/")) {
    return "channel";
  } else if (topic.includes("/stat/")) {
    return "status";
  }

  return null;
}

/**
 * Parse MQTT JSON payload into typed packet
 */
export function parseMQTTPayload(payload: string): MQTTPacket | null {
  try {
    const data = JSON.parse(payload);

    // Log packet types to understand what we're receiving
    if (typeof (global as any).__packetTypes === 'undefined') {
      (global as any).__packetTypes = new Set();
    }
    const packetType = data.type || 'undefined';
    if (!(global as any).__packetTypes.has(packetType)) {
      (global as any).__packetTypes.add(packetType);
      console.log(`[MQTT Parser] New packet type: "${packetType}" | Keys: ${Object.keys(data).join(',')}`);
    }

    return data as MQTTPacket;
  } catch (error) {
    console.error("Failed to parse MQTT payload:", error);
    return null;
  }
}

/**
 * Convert node number to hex ID format (!xxxxxxxx)
 */
export function nodeNumToId(nodeNum: number): string {
  return `!${nodeNum.toString(16).padStart(8, "0")}`;
}

/**
 * Process nodeinfo packet
 */
export function processNodeInfo(packet: MQTTPacket): ProcessedNodeInfo | null {
  if (packet.type !== "nodeinfo" || !packet.payload) {
    return null;
  }

  const nodeId = packet.sender || nodeNumToId(packet.from);

  return {
    id: nodeId,
    nodeNum: packet.from,
    shortName: packet.payload.shortname || "Unknown",
    longName: packet.payload.longname || "Unknown Node",
    hwModel: packet.payload.hardware?.toString() || "UNSET",
    role: packet.payload.role || 0,
    lastHeard: packet.timestamp * 1000, // Convert to milliseconds
    snr: packet.snr,
    rssi: packet.rssi,
    hopsAway: packet.hops_away,
  };
}

/**
 * Process position packet
 */
export function processPosition(packet: MQTTPacket): ProcessedPosition | null {
  if (packet.type !== "position" || !packet.payload) {
    return null;
  }

  // Position payload format:
  // { latitude_i: 123456789, longitude_i: 987654321, altitude: 123, time: 1234567890 }
  const lat = packet.payload.latitude_i ? packet.payload.latitude_i / 1e7 : packet.payload.latitude;
  const lon = packet.payload.longitude_i ? packet.payload.longitude_i / 1e7 : packet.payload.longitude;

  if (!lat || !lon) {
    return null;
  }

  const nodeId = packet.sender || nodeNumToId(packet.from);

  return {
    nodeId,
    nodeNum: packet.from,
    position: {
      latitude: lat,
      longitude: lon,
      altitude: packet.payload.altitude,
      timestamp: (packet.payload.time || packet.timestamp) * 1000,
    },
    timestamp: packet.timestamp * 1000,
    snr: packet.snr,
    rssi: packet.rssi,
  };
}

/**
 * Process telemetry packet
 */
export function processTelemetry(packet: MQTTPacket): ProcessedTelemetry | null {
  if (packet.type !== "telemetry" || !packet.payload) {
    return null;
  }

  const nodeId = packet.sender || nodeNumToId(packet.from);

  return {
    nodeId,
    nodeNum: packet.from,
    timestamp: packet.timestamp * 1000,
    batteryLevel: packet.payload.battery_level,
    voltage: packet.payload.voltage,
    channelUtilization: packet.payload.channel_utilization,
    airUtilTx: packet.payload.air_util_tx,
    uptime: packet.payload.uptime_seconds,
    temperature: packet.payload.temperature,
    snr: packet.snr,
    rssi: packet.rssi,
  };
}

/**
 * Process text message packet
 */
export function processTextMessage(packet: MQTTPacket): ProcessedMessage | null {
  if (packet.type !== "text" || !packet.payload) {
    return null;
  }

  const fromId = packet.sender || nodeNumToId(packet.from);
  const toId = nodeNumToId(packet.to);

  return {
    id: packet.id,
    from: fromId,
    to: toId,
    channel: packet.channel,
    text: packet.payload.text || "",
    timestamp: packet.timestamp * 1000,
    snr: packet.snr,
    rssi: packet.rssi,
    hopsAway: packet.hops_away,
  };
}

/**
 * Process traceroute/routediscovery JSON packet
 */
export function processTraceroutePacket(packet: MQTTPacket): ProcessedTraceroute | null {
  if (!packet.payload) {
    return null;
  }

  const fromId = packet.sender || nodeNumToId(packet.from);
  const toId = nodeNumToId(packet.to);

  // JSON format may have route as array in payload
  const route = Array.isArray(packet.payload.route)
    ? packet.payload.route
    : packet.payload.route_ids
      ? packet.payload.route_ids
      : [packet.from];

  const routeBack = Array.isArray(packet.payload.route_back)
    ? packet.payload.route_back
    : undefined;

  const snrTowards = Array.isArray(packet.payload.snr_towards)
    ? packet.payload.snr_towards
    : undefined;

  const snrBack = Array.isArray(packet.payload.snr_back)
    ? packet.payload.snr_back
    : undefined;

  return {
    fromId,
    toId,
    timestamp: packet.timestamp * 1000,
    route,
    routeBack,
    snrTowards,
    snrBack,
    hops: route.length,
    success: true,
  };
}

/**
 * Custom keys storage - can be populated with channel-specific keys
 */
const customChannelKeys = new Map<string, Buffer>();

/**
 * Channel name to index mapping - learned from MQTT messages
 * Maps channel name (e.g., "LongFast") to channel index (e.g., 0)
 * Note: This is in-memory only. The channels API reads from database.
 */
const channelNameToIndex = new Map<string, number>();
const channelIndexToName = new Map<number, string>();

// Callback to persist channel mappings (set by server-side code)
let persistChannelCallback: ((name: string, index: number) => void) | null = null;

/**
 * Set callback for persisting channel mappings
 * Called by server-side code to enable database persistence
 */
export function setChannelPersistCallback(callback: (name: string, index: number) => void): void {
  persistChannelCallback = callback;
}

/**
 * Register a channel name -> index mapping
 */
export function registerChannelMapping(name: string, index: number): void {
  if (!name || name === '') return;

  // Check if already known with same name
  const existing = channelIndexToName.get(index);
  if (existing === name) return;

  channelNameToIndex.set(name, index);
  channelIndexToName.set(index, name);

  // Persist via callback if available
  if (persistChannelCallback) {
    try {
      persistChannelCallback(name, index);
    } catch (error) {
      console.error(`[MQTT Processor] Failed to persist channel mapping:`, error);
    }
  }
}

/**
 * Load channel mappings (called with data from database)
 */
export function loadChannelMappings(mappings: Array<{ name: string; index: number }>): void {
  for (const m of mappings) {
    channelNameToIndex.set(m.name, m.index);
    channelIndexToName.set(m.index, m.name);
  }
  if (mappings.length > 0) {
    console.log(`[MQTT Processor] Loaded ${mappings.length} channel mappings`);
  }
}

/**
 * Get all known channel mappings
 */
export function getChannelMappings(): Array<{ name: string; index: number }> {
  return Array.from(channelNameToIndex.entries()).map(([name, index]) => ({ name, index }));
}

/**
 * Get channel name by index
 */
export function getChannelName(index: number): string | undefined {
  return channelIndexToName.get(index);
}

/**
 * Add a custom decryption key for a channel
 * @param channelName - The channel name (e.g., "LongFast", "MyPrivateChannel")
 * @param keyBase64 - The PSK in Base64 format (e.g., "AQ==" for default)
 */
export function addChannelKey(channelName: string, keyBase64: string): void {
  const keyBytes = Buffer.from(keyBase64, 'base64');
  // Expand short keys using SHA256 (same as Meshtastic firmware)
  const expandedKey = keyBytes.length === 32
    ? keyBytes
    : require('crypto').createHash('sha256').update(keyBytes).digest();
  customChannelKeys.set(channelName, expandedKey);
}

/**
 * Process encrypted MQTT message (protobuf ServiceEnvelope)
 *
 * Encrypted messages come as binary protobuf ServiceEnvelope containing:
 * - packet: MeshPacket with encrypted payload
 * - channel_id: Channel name (e.g., "LongFast")
 * - gateway_id: Gateway node ID
 */
export function processEncryptedMessage(topic: string, payload: string | Buffer) {
  try {
    // Convert payload to Buffer if needed
    const payloadBuffer = typeof payload === 'string'
      ? Buffer.from(payload, 'binary')
      : Buffer.from(payload);

    console.log(`[MQTT Processor] Processing encrypted message: ${payloadBuffer.length} bytes from ${topic}`);
    console.log(`[MQTT Processor] First 20 bytes (hex): ${payloadBuffer.subarray(0, 20).toString('hex')}`);

    // Decode the ServiceEnvelope (outer wrapper)
    const envelope = decodeServiceEnvelope(payloadBuffer);
    console.log(`[MQTT Processor] ServiceEnvelope decoded:`, envelope ? {
      hasPacket: !!envelope.packet,
      channelId: envelope.channelId,
      gatewayId: envelope.gatewayId,
      packetFrom: envelope.packet?.from,
      packetId: envelope.packet?.id,
      encryptedLen: envelope.packet?.encrypted?.length,
    } : 'null');

    if (!envelope || !envelope.packet) {
      console.error(`[MQTT Processor] Failed to decode ServiceEnvelope or no packet`);
      return { type: "encrypted_parse_error", topic, payload: null };
    }

    const meshPacket = envelope.packet;
    const channelName = envelope.channelId || extractChannelFromTopic(topic) || 'LongFast';

    // Register channel name -> index mapping if we have both
    // This works even for encrypted channels we can't decrypt
    if (channelName && meshPacket.channel !== undefined) {
      registerChannelMapping(channelName, meshPacket.channel);
    }

    // Check if packet has encrypted payload
    if (!meshPacket.encrypted || meshPacket.encrypted.length === 0) {
      // Packet is already decrypted (rare but possible)
      if (meshPacket.decoded) {
        return processDecodedPacket(meshPacket, envelope, topic);
      }
      return { type: "encrypted_no_payload", topic, payload: null };
    }

    // Check if we can decrypt this channel
    // Only default Meshtastic channels (LongFast, etc.) use the known default key
    // Custom channels require their PSK to be added via addChannelKey()
    const hasCustomKey = customChannelKeys.has(channelName);
    const isDefault = isDefaultChannel(channelName);

    if (!hasCustomKey && !isDefault) {
      // We don't have a key for this channel - can't decrypt
      console.log(`[MQTT Processor] Unknown channel "${channelName}" - no PSK available, skipping decryption`);
      return {
        type: "encrypted_unknown_channel",
        topic,
        channel: channelName,
        from: nodeNumToId(meshPacket.from),
        to: nodeNumToId(meshPacket.to),
        id: meshPacket.id,
        gatewayId: envelope.gatewayId,
        payload: null,
        message: `Channel "${channelName}" requires PSK - add via QR code or manual key entry`
      };
    }

    // Get the encryption key for this channel
    const key = customChannelKeys.get(channelName) ||
                keyFromHex(MESHTASTIC_KEYS.LONGFAST_DEFAULT);

    console.log(`[MQTT Processor] Decrypting with key (first 8 bytes): ${key.subarray(0, 8).toString('hex')}`);
    console.log(`[MQTT Processor] Packet ID: ${meshPacket.id}, From: ${meshPacket.from}`);

    // Decrypt the payload
    const decrypted = decryptPayload(
      meshPacket.encrypted,
      key,
      meshPacket.id,
      meshPacket.from
    );

    if (!decrypted) {
      // Decryption failed - might be using a different key
      return {
        type: "encrypted_decrypt_failed",
        topic,
        channel: channelName,
        from: nodeNumToId(meshPacket.from),
        to: nodeNumToId(meshPacket.to),
        payload: null
      };
    }

    console.log(`[MQTT Processor] Decrypted ${decrypted.length} bytes: ${decrypted.subarray(0, 20).toString('hex')}`);

    // Decode the inner Data message
    const data = decodeData(decrypted);
    if (!data) {
      console.log(`[MQTT Processor] Failed to decode Data from decrypted payload`);
      return { type: "encrypted_data_parse_error", topic, payload: null };
    }

    // Create a decoded packet structure
    meshPacket.decoded = data;
    delete (meshPacket as any).encrypted;

    return processDecodedPacket(meshPacket, envelope, topic);

  } catch (error) {
    console.error('[MQTT Processor] Error processing encrypted message:', error);
    return { type: "encrypted_error", topic, payload: null, error: String(error) };
  }
}

/**
 * Process a decrypted MeshPacket based on its portnum
 */
function processDecodedPacket(
  meshPacket: DecodedMeshPacket,
  envelope: { channelId?: string; gatewayId?: string },
  topic: string
) {
  const data = meshPacket.decoded;
  if (!data) {
    return { type: "no_data", topic, payload: null };
  }

  // Register channel name -> index mapping if we have both
  if (envelope.channelId && meshPacket.channel !== undefined) {
    registerChannelMapping(envelope.channelId, meshPacket.channel);
  }

  const fromId = nodeNumToId(meshPacket.from);
  const toId = nodeNumToId(meshPacket.to);
  const timestamp = (meshPacket.rxTime || Math.floor(Date.now() / 1000)) * 1000;

  const basePacket: MQTTPacket = {
    channel: meshPacket.channel,
    from: meshPacket.from,
    hop_start: meshPacket.hopStart,
    hops_away: meshPacket.hopStart && meshPacket.hopLimit
      ? meshPacket.hopStart - meshPacket.hopLimit
      : undefined,
    id: meshPacket.id,
    payload: {},
    rssi: meshPacket.rxRssi,
    sender: fromId,
    snr: meshPacket.rxSnr,
    timestamp: meshPacket.rxTime || Math.floor(Date.now() / 1000),
    to: meshPacket.to,
    type: getPortNumName(data.portnum).toLowerCase().replace('_app', ''),
  };

  // Process based on port number
  switch (data.portnum) {
    case MESHTASTIC_PORTNUM.TEXT_MESSAGE_APP: {
      const text = data.payload.toString('utf8');
      return {
        type: "text",
        data: {
          id: meshPacket.id,
          from: fromId,
          to: toId,
          channel: meshPacket.channel,
          text,
          timestamp,
          snr: meshPacket.rxSnr,
          rssi: meshPacket.rxRssi,
          hopsAway: basePacket.hops_away,
        } as ProcessedMessage,
      };
    }

    case MESHTASTIC_PORTNUM.POSITION_APP: {
      const position = decodePosition(data.payload);
      if (!position) {
        return { type: "position_parse_error", topic, payload: null };
      }

      const lat = position.latitudeI ? position.latitudeI / 1e7 : undefined;
      const lon = position.longitudeI ? position.longitudeI / 1e7 : undefined;

      if (!lat || !lon) {
        return { type: "position_no_coords", topic, payload: null };
      }

      return {
        type: "position",
        data: {
          nodeId: fromId,
          nodeNum: meshPacket.from,
          position: {
            latitude: lat,
            longitude: lon,
            altitude: position.altitude,
            timestamp: (position.time || meshPacket.rxTime || Math.floor(Date.now() / 1000)) * 1000,
          },
          timestamp,
          snr: meshPacket.rxSnr,
          rssi: meshPacket.rxRssi,
        } as ProcessedPosition,
      };
    }

    case MESHTASTIC_PORTNUM.NODEINFO_APP: {
      const user = decodeUser(data.payload);
      if (!user) {
        return { type: "nodeinfo_parse_error", topic, payload: null };
      }

      return {
        type: "nodeinfo",
        data: {
          id: user.id || fromId,
          nodeNum: meshPacket.from,
          shortName: user.shortName || "UNK",
          longName: user.longName || "Unknown Node",
          hwModel: user.hwModel !== undefined
            ? getHardwareModelName(user.hwModel)
            : "UNSET",
          role: user.role || 0,
          lastHeard: timestamp,
          snr: meshPacket.rxSnr,
          rssi: meshPacket.rxRssi,
          hopsAway: basePacket.hops_away,
        } as ProcessedNodeInfo,
      };
    }

    case MESHTASTIC_PORTNUM.TELEMETRY_APP: {
      const telemetry = decodeTelemetry(data.payload);
      if (!telemetry) {
        return { type: "telemetry_parse_error", topic, payload: null };
      }

      return {
        type: "telemetry",
        data: {
          nodeId: fromId,
          nodeNum: meshPacket.from,
          timestamp,
          batteryLevel: telemetry.deviceMetrics?.batteryLevel,
          voltage: telemetry.deviceMetrics?.voltage,
          channelUtilization: telemetry.deviceMetrics?.channelUtilization,
          airUtilTx: telemetry.deviceMetrics?.airUtilTx,
          uptime: telemetry.deviceMetrics?.uptimeSeconds,
          snr: meshPacket.rxSnr,
          rssi: meshPacket.rxRssi,
        } as ProcessedTelemetry,
      };
    }

    case MESHTASTIC_PORTNUM.TRACEROUTE_APP: {
      const routeDiscovery = decodeRouteDiscovery(data.payload);
      if (!routeDiscovery || routeDiscovery.route.length === 0) {
        // Fall back to raw data if parsing fails
        basePacket.payload = { raw: data.payload.toString('hex') };
        return { type: "traceroute_parse_error", data: basePacket };
      }

      return {
        type: "traceroute",
        data: {
          fromId,
          toId,
          timestamp,
          route: routeDiscovery.route,
          routeBack: routeDiscovery.routeBack,
          snrTowards: routeDiscovery.snrTowards,
          snrBack: routeDiscovery.snrBack,
          hops: routeDiscovery.route.length,
          success: true,
        } as ProcessedTraceroute,
      };
    }

    case MESHTASTIC_PORTNUM.NEIGHBORINFO_APP:
    case MESHTASTIC_PORTNUM.ROUTING_APP:
    case MESHTASTIC_PORTNUM.MAP_REPORT_APP:
    case MESHTASTIC_PORTNUM.RANGE_TEST_APP:
    case MESHTASTIC_PORTNUM.DETECTION_SENSOR_APP:
    case MESHTASTIC_PORTNUM.PAXCOUNTER_APP:
    case MESHTASTIC_PORTNUM.ATAK_PLUGIN:
      // Pass through these packet types with raw data
      basePacket.payload = { raw: data.payload.toString('hex') };
      return { type: basePacket.type, data: basePacket };

    default:
      // Unknown port number - pass through with raw payload
      console.log(`[MQTT Processor] Decrypted unknown portnum: ${data.portnum} (${getPortNumName(data.portnum)})`);
      basePacket.payload = { raw: data.payload.toString('hex') };
      return { type: basePacket.type, data: basePacket };
  }
}

/**
 * Process MapReport messages from /map/ topics
 * MapReport is sent as raw protobuf (not encrypted, not in ServiceEnvelope)
 */
export function processMapReportMessage(topic: string, payload: string | Buffer) {
  try {
    const payloadBuffer = typeof payload === 'string'
      ? Buffer.from(payload, 'binary')
      : Buffer.from(payload);

    // Extract node ID from topic: msh/US/KY/2/map/!nodeId
    const nodeIdMatch = topic.match(/!([0-9a-f]+)$/i);
    const nodeId = nodeIdMatch ? `!${nodeIdMatch[1]}` : undefined;

    console.log(`[MQTT Processor] Processing MapReport: ${payloadBuffer.length} bytes from ${topic}`);

    const mapReport = decodeMapReport(payloadBuffer);
    if (!mapReport) {
      console.log(`[MQTT Processor] Failed to decode MapReport`);
      return { type: "mapreport_parse_error", topic, payload: null };
    }

    // Convert to position/node format for consistency
    const lat = mapReport.latitudeI ? mapReport.latitudeI / 1e7 : undefined;
    const lon = mapReport.longitudeI ? mapReport.longitudeI / 1e7 : undefined;

    return {
      type: "mapreport",
      data: {
        id: nodeId,
        shortName: mapReport.shortName,
        longName: mapReport.longName,
        hwModel: mapReport.hwModel !== undefined
          ? getHardwareModelName(mapReport.hwModel)
          : "UNSET",
        role: mapReport.role,
        firmwareVersion: mapReport.firmwareVersion,
        region: mapReport.region,
        modemPreset: mapReport.modemPreset,
        hasDefaultChannel: mapReport.hasDefaultChannel,
        position: lat && lon ? {
          latitude: lat,
          longitude: lon,
          altitude: mapReport.altitude,
        } : undefined,
        positionPrecision: mapReport.positionPrecision,
        numOnlineLocalNodes: mapReport.numOnlineLocalNodes,
        timestamp: Date.now(),
      }
    };
  } catch (error) {
    console.error('[MQTT Processor] Error processing MapReport:', error);
    return { type: "mapreport_error", topic, payload: null, error: String(error) };
  }
}

/**
 * Process any MQTT packet and return typed result
 */
export function processMQTTMessage(topic: string, payload: string | Buffer) {
  const messageType = getMessageType(topic);

  if (messageType === "encrypted") {
    // Try to decrypt the encrypted message
    return processEncryptedMessage(topic, payload);
  }

  if (messageType === "mapreport") {
    // Process MapReport protobuf
    return processMapReportMessage(topic, payload);
  }

  if (messageType !== "json") {
    return { type: "unknown", topic, payload: null };
  }

  // JSON payload - parse as before
  const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf8');
  const packet = parseMQTTPayload(payloadStr);
  if (!packet) {
    return { type: "parse_error", topic, payload: null };
  }

  switch (packet.type) {
    case "nodeinfo":
      return { type: "nodeinfo", data: processNodeInfo(packet) };

    case "position":
      return { type: "position", data: processPosition(packet) };

    case "telemetry":
      return { type: "telemetry", data: processTelemetry(packet) };

    case "text":
      return { type: "text", data: processTextMessage(packet) };

    case "traceroute":
    case "routediscovery":
      // Process traceroute/route discovery JSON packets
      return { type: "traceroute", data: processTraceroutePacket(packet) };

    // Control/Status packets - pass through for logging/future use
    case "sendtext":
    case "neighborinfo":
    case "mapreport":
    case "routing":
    case "paxcounter":
    case "detection_sensor":
    case "range_test":
    case "atak":
      // Pass through with raw packet data - these are useful for network analysis
      return { type: packet.type, data: packet };

    default:
      // Log truly unknown packet types
      if (packet.type) {
        console.log(`[MQTT Processor] Unhandled packet type: ${packet.type}`);
      }
      return { type: packet.type || 'unknown', data: packet };
  }
}
