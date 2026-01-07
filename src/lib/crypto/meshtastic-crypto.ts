/**
 * Meshtastic Encryption/Decryption Module
 *
 * Handles AES-CTR decryption for Meshtastic MQTT messages.
 * Supports the default LongFast channel key (AQ==) and custom PSKs.
 *
 * Encryption details (from firmware CryptoEngine.cpp):
 * - Algorithm: AES-128-CTR for 16-byte keys, AES-256-CTR for 32-byte keys
 * - Default Key: PSK index 1 maps to hardcoded 16-byte key (NOT padded - uses AES-128!)
 * - Nonce: packetId (8 bytes LE as uint64) + fromNode (4 bytes LE) + 4 zero bytes = 16 bytes
 * - Counter size: 4 bytes (last 4 bytes of nonce are the counter)
 */

import crypto from 'crypto';

/**
 * The default pre-shared key used by Meshtastic (16 bytes)
 * This is hardcoded in the firmware at src/mesh/Channels.h
 * PSK index 1 (0x01, or "AQ==" in base64) refers to this key
 *
 * IMPORTANT: The firmware uses AES-128-CTR for 16-byte keys, NOT AES-256!
 */
export const DEFAULT_PSK_BYTES = Buffer.from([
  0xd4, 0xf1, 0xbb, 0x3a, 0x20, 0x29, 0x07, 0x59,
  0xf0, 0xbc, 0xff, 0xab, 0xcf, 0x4e, 0x69, 0x01
]);

// Default Meshtastic channel keys (as hex strings)
// These are 16 bytes - use AES-128-CTR, not AES-256!
export const MESHTASTIC_KEYS = {
  // The default 16-byte PSK (NOT zero-padded - firmware uses AES-128 for 16-byte keys)
  // This is what PSK index 1 ("AQ==" / 0x01) maps to
  LONGFAST_DEFAULT: 'd4f1bb3a20290759f0bcffabcf4e6901',

  // No encryption (all zeros)
  NONE: '00000000000000000000000000000000',
} as const;

// Pre-shared key name to hex key mapping for well-known channels
// These are the default Meshtastic channels that all use the same default PSK
export const CHANNEL_KEYS: Record<string, string> = {
  'LongFast': MESHTASTIC_KEYS.LONGFAST_DEFAULT,
  'LongSlow': MESHTASTIC_KEYS.LONGFAST_DEFAULT, // Uses same default
  'MediumFast': MESHTASTIC_KEYS.LONGFAST_DEFAULT,
  'MediumSlow': MESHTASTIC_KEYS.LONGFAST_DEFAULT,
  'ShortFast': MESHTASTIC_KEYS.LONGFAST_DEFAULT,
  'ShortSlow': MESHTASTIC_KEYS.LONGFAST_DEFAULT,
  'ShortTurbo': MESHTASTIC_KEYS.LONGFAST_DEFAULT,
  'LongModerate': MESHTASTIC_KEYS.LONGFAST_DEFAULT,
};

/**
 * Check if a channel name uses the default Meshtastic key
 * Only these channels can be decrypted without knowing the custom PSK
 */
export function isDefaultChannel(channelName: string): boolean {
  return channelName in CHANNEL_KEYS;
}

/**
 * Expands a PSK to a proper AES key
 *
 * Meshtastic key expansion rules (from firmware Channels.cpp getKey()):
 * - 0 bytes: No encryption (return null)
 * - 1 byte: PSK index - maps to hardcoded keys (1 = default, 2-10 = default with last byte incremented)
 * - 16 bytes: Use as-is for AES-128 (firmware uses AES-128 for 16-byte keys!)
 * - 32 bytes: Use as-is for AES-256
 * - Other lengths < 16: Zero-pad to 16 bytes (AES-128)
 * - Other lengths 16-32: Zero-pad to 32 bytes (AES-256)
 *
 * Returns the key and its length for selecting the right algorithm
 */
export function expandPSK(psk: Uint8Array | Buffer): Buffer | null {
  if (psk.length === 0) {
    return null; // No encryption
  }

  // Handle 1-byte PSK index
  if (psk.length === 1) {
    const pskIndex = psk[0];
    if (pskIndex === 0) {
      return null; // No encryption
    }
    // PSK index 1-10 uses the default key with last byte incremented by (index - 1)
    // The key stays 16 bytes - firmware uses AES-128 for these!
    const key = Buffer.alloc(16);
    DEFAULT_PSK_BYTES.copy(key, 0);
    // Increment last byte of the 16-byte key by (pskIndex - 1)
    key[15] = (DEFAULT_PSK_BYTES[15] + pskIndex - 1) & 0xff;
    return key;
  }

  // 32-byte key: use directly for AES-256
  if (psk.length === 32) {
    return Buffer.from(psk);
  }

  // 16-byte key: use directly for AES-128 (NOT zero-padded!)
  if (psk.length === 16) {
    return Buffer.from(psk);
  }

  // Other lengths < 16: zero-pad to 16 bytes (AES-128)
  if (psk.length < 16) {
    const key = Buffer.alloc(16);
    Buffer.from(psk).copy(key, 0);
    return key;
  }

  // Other lengths 16-32: zero-pad to 32 bytes (AES-256)
  const key = Buffer.alloc(32);
  Buffer.from(psk).copy(key, 0, 0, Math.min(psk.length, 32));
  return key;
}

/**
 * Converts a Base64 PSK string to expanded key
 */
export function pskFromBase64(base64Psk: string): Buffer | null {
  try {
    const pskBytes = Buffer.from(base64Psk, 'base64');
    return expandPSK(pskBytes);
  } catch {
    return null;
  }
}

/**
 * Converts a hex string to Buffer
 */
export function keyFromHex(hexKey: string): Buffer {
  return Buffer.from(hexKey, 'hex');
}

/**
 * Generates the 16-byte nonce/IV for AES-CTR decryption
 *
 * Nonce format (16 bytes total) - matches firmware's CryptoEngine::initNonce():
 * - Bytes 0-7: Packet ID (little-endian uint64)
 * - Bytes 8-11: From Node Number (little-endian uint32)
 * - Bytes 12-15: Zero padding
 *
 * Note: JavaScript doesn't have native uint64, but packet IDs fit in 32 bits
 * so we write it as uint32 in the lower bytes with zeros in upper bytes
 */
export function generateNonce(packetId: number, fromNode: number): Buffer {
  const nonce = Buffer.alloc(16);

  // Write packet ID as little-endian uint64 (using BigInt for proper 64-bit handling)
  // packetId in Meshtastic is actually a uint32, but firmware treats it as uint64 in nonce
  nonce.writeBigUInt64LE(BigInt(packetId >>> 0), 0);

  // Write from node as little-endian uint32 at offset 8
  nonce.writeUInt32LE(fromNode >>> 0, 8);

  // Bytes 12-15 are already zero (Buffer.alloc initializes to 0)

  console.log(`[Crypto] Nonce generated: ${nonce.toString('hex')} (packetId=${packetId}, fromNode=${fromNode})`);

  return nonce;
}

/**
 * Decrypts an encrypted Meshtastic packet payload
 *
 * CRITICAL: Firmware uses AES-128-CTR for 16-byte keys and AES-256-CTR for 32-byte keys!
 * (see CryptoEngine.cpp encryptAESCtr())
 *
 * @param encrypted - The encrypted payload bytes
 * @param key - The AES key (16 bytes for AES-128, 32 bytes for AES-256)
 * @param packetId - The packet ID from the MeshPacket header
 * @param fromNode - The sender's node number
 * @returns The decrypted payload, or null if decryption fails
 */
export function decryptPayload(
  encrypted: Uint8Array | Buffer,
  key: Buffer,
  packetId: number,
  fromNode: number
): Buffer | null {
  try {
    // Select algorithm based on key length (matches firmware behavior)
    let algorithm: string;
    if (key.length === 16) {
      algorithm = 'aes-128-ctr';
    } else if (key.length === 32) {
      algorithm = 'aes-256-ctr';
    } else {
      console.error('[Crypto] Invalid key length:', key.length, '(must be 16 or 32)');
      return null;
    }

    const nonce = generateNonce(packetId, fromNode);

    // Create decipher with correct algorithm
    const decipher = crypto.createDecipheriv(algorithm, key, nonce);

    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    console.log(`[Crypto] Decrypted ${decrypted.length} bytes using ${algorithm}`);
    return decrypted;
  } catch (error) {
    console.error('[Crypto] Decryption failed:', error);
    return null;
  }
}

/**
 * Attempts to decrypt with the default LongFast key
 *
 * Uses the 16-byte default PSK with AES-128-CTR (matching firmware behavior)
 */
export function decryptWithDefaultKey(
  encrypted: Uint8Array | Buffer,
  packetId: number,
  fromNode: number
): Buffer | null {
  // Use the 16-byte key directly - firmware uses AES-128 for this!
  const key = keyFromHex(MESHTASTIC_KEYS.LONGFAST_DEFAULT);
  return decryptPayload(encrypted, key, packetId, fromNode);
}

/**
 * Try decrypting with multiple known keys
 * Useful when channel key is unknown
 */
export function tryDecryptWithKnownKeys(
  encrypted: Uint8Array | Buffer,
  packetId: number,
  fromNode: number,
  additionalKeys?: Buffer[]
): { decrypted: Buffer; keyUsed: string } | null {
  // Try default key first
  const defaultKey = keyFromHex(MESHTASTIC_KEYS.LONGFAST_DEFAULT);
  let result = decryptPayload(encrypted, defaultKey, packetId, fromNode);

  if (result && isValidProtobuf(result)) {
    return { decrypted: result, keyUsed: 'LongFast (default)' };
  }

  // Try additional custom keys if provided
  if (additionalKeys) {
    for (let i = 0; i < additionalKeys.length; i++) {
      result = decryptPayload(encrypted, additionalKeys[i], packetId, fromNode);
      if (result && isValidProtobuf(result)) {
        return { decrypted: result, keyUsed: `custom_${i}` };
      }
    }
  }

  return null;
}

/**
 * Basic check if decrypted data looks like a valid protobuf
 * Checks for reasonable field tags and wire types
 */
export function isValidProtobuf(data: Buffer): boolean {
  if (data.length < 2) return false;

  // First byte should be a valid protobuf field header
  // Wire type is in lower 3 bits (0-5 are valid)
  // Field number is in upper 5 bits (should be > 0)
  const firstByte = data[0];
  const wireType = firstByte & 0x07;
  const fieldNum = firstByte >> 3;

  // Valid wire types: 0 (varint), 1 (64-bit), 2 (length-delimited), 3 (group start, deprecated), 4 (group end, deprecated), 5 (32-bit)
  if (wireType > 5) return false;
  if (fieldNum === 0) return false;

  // If it's a length-delimited field (wire type 2), check the length
  if (wireType === 2) {
    // Read varint length
    let len = 0;
    let shift = 0;
    let idx = 1;

    while (idx < data.length && shift < 35) {
      const b = data[idx];
      len |= (b & 0x7f) << shift;
      idx++;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }

    // Length should be reasonable (not larger than remaining data)
    if (len > data.length - idx) return false;
    if (len > 1000) return false; // Meshtastic packets are small
  }

  return true;
}

/**
 * Extract channel name from MQTT topic
 * Topic format: msh/{region}/{subregion}/{modem}/e/{channel}/!{nodeId}
 */
export function extractChannelFromTopic(topic: string): string | null {
  const parts = topic.split('/');

  // Find 'e' (encrypted) or 'c' (channel) marker
  const eIndex = parts.indexOf('e');
  const cIndex = parts.indexOf('c');
  const markerIndex = eIndex !== -1 ? eIndex : cIndex;

  if (markerIndex !== -1 && markerIndex + 1 < parts.length) {
    return parts[markerIndex + 1];
  }

  return null;
}

/**
 * Get encryption key for a channel
 */
export function getKeyForChannel(channelName: string, customKeys?: Map<string, Buffer>): Buffer | null {
  // Check custom keys first
  if (customKeys?.has(channelName)) {
    return customKeys.get(channelName)!;
  }

  // Check well-known channels
  if (channelName in CHANNEL_KEYS) {
    return keyFromHex(CHANNEL_KEYS[channelName]);
  }

  // Unknown channel - try default key
  return keyFromHex(MESHTASTIC_KEYS.LONGFAST_DEFAULT);
}

/**
 * Encrypts a payload using AES-CTR for Meshtastic MQTT publishing
 *
 * This is the inverse of decryptPayload - same algorithm and nonce format.
 * AES-CTR encryption and decryption are identical operations.
 *
 * @param plaintext - The unencrypted payload bytes
 * @param key - The AES key (16 bytes for AES-128, 32 bytes for AES-256)
 * @param packetId - The packet ID for the MeshPacket
 * @param fromNode - The sender's node number
 * @returns The encrypted payload, or null if encryption fails
 */
export function encryptPayload(
  plaintext: Uint8Array | Buffer,
  key: Buffer,
  packetId: number,
  fromNode: number
): Buffer | null {
  try {
    // Select algorithm based on key length (matches firmware behavior)
    let algorithm: string;
    if (key.length === 16) {
      algorithm = 'aes-128-ctr';
    } else if (key.length === 32) {
      algorithm = 'aes-256-ctr';
    } else {
      console.error('[Crypto] Invalid key length:', key.length, '(must be 16 or 32)');
      return null;
    }

    const nonce = generateNonce(packetId, fromNode);

    // Create cipher with correct algorithm
    const cipher = crypto.createCipheriv(algorithm, key, nonce);

    // Encrypt (AES-CTR encryption/decryption are the same operation)
    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final()
    ]);

    console.log(`[Crypto] Encrypted ${encrypted.length} bytes using ${algorithm}`);
    return encrypted;
  } catch (error) {
    console.error('[Crypto] Encryption failed:', error);
    return null;
  }
}

/**
 * Encrypts with the default LongFast key
 */
export function encryptWithDefaultKey(
  plaintext: Uint8Array | Buffer,
  packetId: number,
  fromNode: number
): Buffer | null {
  const key = keyFromHex(MESHTASTIC_KEYS.LONGFAST_DEFAULT);
  return encryptPayload(plaintext, key, packetId, fromNode);
}

/**
 * Generate a random packet ID for outgoing messages
 */
export function generatePacketId(): number {
  // Generate a random 32-bit unsigned integer
  return crypto.randomBytes(4).readUInt32LE(0);
}
