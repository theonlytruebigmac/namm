/**
 * Meshtastic Protobuf Encoder
 *
 * Lightweight manual encoder for Meshtastic protobuf messages.
 * Handles ServiceEnvelope, MeshPacket, and Data message types for sending.
 *
 * This is the inverse of protobuf-decoder.ts
 */

import { MESHTASTIC_PORTNUM } from './protobuf-decoder';

// Protobuf wire types
const WIRE_TYPE = {
  VARINT: 0,
  FIXED64: 1,
  LENGTH_DELIMITED: 2,
  START_GROUP: 3,
  END_GROUP: 4,
  FIXED32: 5,
} as const;

/**
 * Write a varint to a buffer
 * Returns the bytes written
 */
function writeVarint(value: number): Buffer {
  const bytes: number[] = [];
  let v = value >>> 0; // Ensure unsigned

  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v);

  return Buffer.from(bytes);
}

/**
 * Write a signed varint (zigzag encoded for sint32/sint64)
 */
function writeSignedVarint(value: number): Buffer {
  // Zigzag encoding: (n << 1) ^ (n >> 31)
  const encoded = (value << 1) ^ (value >> 31);
  return writeVarint(encoded);
}

/**
 * Write a field header (field number + wire type)
 */
function writeFieldHeader(fieldNumber: number, wireType: number): Buffer {
  const header = (fieldNumber << 3) | wireType;
  return writeVarint(header);
}

/**
 * Write a length-delimited field (bytes, string, embedded message)
 */
function writeLengthDelimited(fieldNumber: number, data: Buffer): Buffer {
  const header = writeFieldHeader(fieldNumber, WIRE_TYPE.LENGTH_DELIMITED);
  const length = writeVarint(data.length);
  return Buffer.concat([header, length, data]);
}

/**
 * Write a varint field
 */
function writeVarintField(fieldNumber: number, value: number): Buffer {
  const header = writeFieldHeader(fieldNumber, WIRE_TYPE.VARINT);
  const varint = writeVarint(value);
  return Buffer.concat([header, varint]);
}

/**
 * Write a fixed32 field
 */
function writeFixed32Field(fieldNumber: number, value: number): Buffer {
  const header = writeFieldHeader(fieldNumber, WIRE_TYPE.FIXED32);
  const data = Buffer.alloc(4);
  data.writeUInt32LE(value);
  return Buffer.concat([header, data]);
}

/**
 * Encode a Data message (the payload inside MeshPacket)
 *
 * Data message fields:
 *   1: portnum (PortNum enum)
 *   2: payload (bytes)
 *   3: want_response (bool)
 *   4: dest (fixed32) - for direct messages
 *   5: source (fixed32)
 *   6: request_id (fixed32)
 *   7: reply_id (fixed32)
 *   8: emoji (fixed32)
 */
export function encodeData(options: {
  portnum: number;
  payload: Buffer;
  wantResponse?: boolean;
  dest?: number;
  source?: number;
  requestId?: number;
  replyId?: number;
  emoji?: number;
}): Buffer {
  const parts: Buffer[] = [];

  // Field 1: portnum (varint)
  parts.push(writeVarintField(1, options.portnum));

  // Field 2: payload (length-delimited)
  parts.push(writeLengthDelimited(2, options.payload));

  // Field 3: want_response (varint bool) - optional
  if (options.wantResponse) {
    parts.push(writeVarintField(3, 1));
  }

  // Field 4: dest (fixed32) - optional
  if (options.dest !== undefined) {
    parts.push(writeFixed32Field(4, options.dest));
  }

  // Field 5: source (fixed32) - optional
  if (options.source !== undefined) {
    parts.push(writeFixed32Field(5, options.source));
  }

  // Field 6: request_id (fixed32) - optional
  if (options.requestId !== undefined) {
    parts.push(writeFixed32Field(6, options.requestId));
  }

  // Field 7: reply_id (fixed32) - optional
  if (options.replyId !== undefined) {
    parts.push(writeFixed32Field(7, options.replyId));
  }

  // Field 8: emoji (fixed32) - optional
  if (options.emoji !== undefined) {
    parts.push(writeFixed32Field(8, options.emoji));
  }

  return Buffer.concat(parts);
}

/**
 * Encode a MeshPacket message
 *
 * MeshPacket fields:
 *   1: from (fixed32)
 *   2: to (fixed32)
 *   3: channel (uint32)
 *   4: encrypted (bytes) - encrypted Data
 *   5: decoded (Data) - unencrypted Data (one of 4 or 5)
 *   6: id (fixed32)
 *   7: rx_time (fixed32)
 *   8: rx_snr (float)
 *   9: hop_limit (uint32)
 *   10: want_ack (bool)
 *   11: priority (enum)
 *   12: rx_rssi (int32)
 *   13: delayed (enum)
 *   15: via_mqtt (bool)
 *   16: hop_start (uint32)
 *   17: public_key (bytes)
 *   18: pki_encrypted (bool)
 */
export function encodeMeshPacket(options: {
  from: number;
  to: number;
  channel?: number;
  encrypted?: Buffer;
  decoded?: Buffer; // Pre-encoded Data message
  id: number;
  hopLimit?: number;
  wantAck?: boolean;
  viaMqtt?: boolean;
  hopStart?: number;
}): Buffer {
  const parts: Buffer[] = [];

  // Field 1: from (fixed32)
  parts.push(writeFixed32Field(1, options.from));

  // Field 2: to (fixed32)
  parts.push(writeFixed32Field(2, options.to));

  // Field 3: channel (varint) - optional, defaults to 0
  if (options.channel !== undefined && options.channel > 0) {
    parts.push(writeVarintField(3, options.channel));
  }

  // Field 4: encrypted (bytes) OR Field 5: decoded (Data)
  if (options.encrypted) {
    parts.push(writeLengthDelimited(4, options.encrypted));
  } else if (options.decoded) {
    parts.push(writeLengthDelimited(5, options.decoded));
  }

  // Field 6: id (fixed32)
  parts.push(writeFixed32Field(6, options.id));

  // Field 9: hop_limit (varint) - optional
  if (options.hopLimit !== undefined) {
    parts.push(writeVarintField(9, options.hopLimit));
  }

  // Field 10: want_ack (varint bool) - optional
  if (options.wantAck) {
    parts.push(writeVarintField(10, 1));
  }

  // Field 15: via_mqtt (varint bool) - important for MQTT messages
  if (options.viaMqtt !== false) {
    parts.push(writeVarintField(15, 1));
  }

  // Field 16: hop_start (varint) - optional
  if (options.hopStart !== undefined) {
    parts.push(writeVarintField(16, options.hopStart));
  }

  return Buffer.concat(parts);
}

/**
 * Encode a ServiceEnvelope message (the outer wrapper for MQTT)
 *
 * ServiceEnvelope fields:
 *   1: packet (MeshPacket)
 *   2: channel_id (string)
 *   3: gateway_id (string)
 */
export function encodeServiceEnvelope(options: {
  packet: Buffer; // Pre-encoded MeshPacket
  channelId?: string;
  gatewayId?: string;
}): Buffer {
  const parts: Buffer[] = [];

  // Field 1: packet (embedded MeshPacket)
  parts.push(writeLengthDelimited(1, options.packet));

  // Field 2: channel_id (string) - optional
  if (options.channelId) {
    parts.push(writeLengthDelimited(2, Buffer.from(options.channelId, 'utf-8')));
  }

  // Field 3: gateway_id (string) - optional
  if (options.gatewayId) {
    parts.push(writeLengthDelimited(3, Buffer.from(options.gatewayId, 'utf-8')));
  }

  return Buffer.concat(parts);
}

/**
 * Create a complete text message for MQTT publishing
 *
 * This creates an encrypted ServiceEnvelope ready to publish to MQTT.
 *
 * @param text - The message text
 * @param fromNode - Sender's node number
 * @param toNode - Recipient node number (0xffffffff for broadcast)
 * @param channel - Channel number (default 0 = LongFast)
 * @param packetId - Unique packet ID
 * @param encryptFn - Function to encrypt the payload
 * @param options - Additional options (channelId, gatewayId)
 */
export function createTextMessage(options: {
  text: string;
  fromNode: number;
  toNode?: number;
  channel?: number;
  packetId: number;
  channelId?: string;
  gatewayId?: string;
  encryptFn: (plaintext: Buffer, packetId: number, fromNode: number) => Buffer | null;
}): Buffer | null {
  const {
    text,
    fromNode,
    toNode = 0xffffffff, // Broadcast
    channel = 0,
    packetId,
    channelId,
    gatewayId,
    encryptFn,
  } = options;

  // Step 1: Create the text payload
  const textPayload = Buffer.from(text, 'utf-8');

  // Step 2: Encode the Data message
  const dataMessage = encodeData({
    portnum: MESHTASTIC_PORTNUM.TEXT_MESSAGE_APP,
    payload: textPayload,
  });

  // Step 3: Encrypt the Data message
  const encryptedData = encryptFn(dataMessage, packetId, fromNode);
  if (!encryptedData) {
    console.error('[Encoder] Failed to encrypt Data message');
    return null;
  }

  // Step 4: Encode the MeshPacket with encrypted payload
  const meshPacket = encodeMeshPacket({
    from: fromNode,
    to: toNode,
    channel: channel,
    encrypted: encryptedData,
    id: packetId,
    hopLimit: 3,
    wantAck: false,
    viaMqtt: true,
    hopStart: 3,
  });

  // Step 5: Wrap in ServiceEnvelope
  const envelope = encodeServiceEnvelope({
    packet: meshPacket,
    channelId: channelId,
    gatewayId: gatewayId,
  });

  return envelope;
}

/**
 * Create a traceroute request packet
 *
 * Traceroute works by sending an empty RouteDiscovery payload with wantResponse=true.
 * The destination node will respond with the route it took to reach us.
 *
 * @param options - Traceroute options
 */
export function createTracerouteRequest(options: {
  fromNode: number;
  toNode: number;
  channel?: number;
  packetId: number;
  channelId?: string;
  gatewayId?: string;
  encryptFn: (plaintext: Buffer, packetId: number, fromNode: number) => Buffer | null;
}): Buffer | null {
  const {
    fromNode,
    toNode,
    channel = 0,
    packetId,
    channelId,
    gatewayId,
    encryptFn,
  } = options;

  // Traceroute request starts with an empty RouteDiscovery message
  // The route will be populated by nodes as the packet travels
  const emptyRouteDiscovery = Buffer.alloc(0);

  // Encode the Data message with TRACEROUTE_APP portnum and wantResponse=true
  const dataMessage = encodeData({
    portnum: MESHTASTIC_PORTNUM.TRACEROUTE_APP,
    payload: emptyRouteDiscovery,
    wantResponse: true,
    dest: toNode,
  });

  // Encrypt the Data message
  const encryptedData = encryptFn(dataMessage, packetId, fromNode);
  if (!encryptedData) {
    console.error('[Encoder] Failed to encrypt traceroute request');
    return null;
  }

  // Encode the MeshPacket with encrypted payload
  const meshPacket = encodeMeshPacket({
    from: fromNode,
    to: toNode,
    channel: channel,
    encrypted: encryptedData,
    id: packetId,
    hopLimit: 7, // Traceroutes need higher hop limit
    wantAck: true,
    viaMqtt: true,
    hopStart: 7,
  });

  // Wrap in ServiceEnvelope
  const envelope = encodeServiceEnvelope({
    packet: meshPacket,
    channelId: channelId,
    gatewayId: gatewayId,
  });

  return envelope;
}

/**
 * Export port numbers for convenience
 */
export { MESHTASTIC_PORTNUM };
