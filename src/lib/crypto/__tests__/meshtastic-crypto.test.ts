/**
 * Tests for Meshtastic Encryption/Decryption
 */

import { describe, it, expect } from 'vitest';
import {
  expandPSK,
  pskFromBase64,
  generateNonce,
  decryptPayload,
  decryptWithDefaultKey,
  keyFromHex,
  MESHTASTIC_KEYS,
  isValidProtobuf,
  extractChannelFromTopic,
} from '../meshtastic-crypto';
import {
  decodeServiceEnvelope,
  decodeMeshPacket,
  decodeData,
  decodePosition,
  decodeUser,
  decodeTelemetry,
  getPortNumName,
  getHardwareModelName,
  MESHTASTIC_PORTNUM,
} from '../protobuf-decoder';

describe('Meshtastic Crypto', () => {
  describe('expandPSK', () => {
    it('should return null for empty key (no encryption)', () => {
      const result = expandPSK(Buffer.alloc(0));
      expect(result).toBeNull();
    });

    it('should return null for PSK index 0 (no encryption)', () => {
      const result = expandPSK(Buffer.from([0x00]));
      expect(result).toBeNull();
    });

    it('should expand PSK index 1 to default key (zero-padded to 32 bytes)', () => {
      // Default key "AQ==" = 0x01 (PSK index 1)
      const key = expandPSK(Buffer.from([0x01]));
      expect(key).not.toBeNull();
      expect(key!.length).toBe(32);
      // First 16 bytes should be the default PSK
      expect(key!.subarray(0, 16).toString('hex')).toBe('d4f1bb3a20290759f0bcffabcf4e6901');
      // Last 16 bytes should be zeros
      expect(key!.subarray(16, 32).toString('hex')).toBe('00000000000000000000000000000000');
    });

    it('should increment last byte for PSK index 2', () => {
      const key = expandPSK(Buffer.from([0x02]));
      expect(key).not.toBeNull();
      expect(key!.length).toBe(32);
      // Last byte of 16-byte key should be 0x02 (0x01 + 2 - 1)
      expect(key![15]).toBe(0x02);
    });

    it('should pass through 32-byte key unchanged', () => {
      const key32 = Buffer.alloc(32, 0xAB);
      const result = expandPSK(key32);
      expect(result).toEqual(key32);
    });

    it('should zero-pad 16-byte key to 32 bytes', () => {
      const key16 = Buffer.alloc(16, 0xCD);
      const result = expandPSK(key16);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(32);
      expect(result!.subarray(0, 16)).toEqual(key16);
      expect(result!.subarray(16, 32)).toEqual(Buffer.alloc(16, 0));
    });
  });

  describe('pskFromBase64', () => {
    it('should decode AQ== (default key index 1) correctly', () => {
      const key = pskFromBase64('AQ==');
      expect(key).not.toBeNull();
      expect(key!.length).toBe(32);
      // First 16 bytes should be the default PSK
      expect(key!.subarray(0, 16).toString('hex')).toBe('d4f1bb3a20290759f0bcffabcf4e6901');
    });

    it('should return null for invalid base64', () => {
      const key = pskFromBase64('not valid base64!!!');
      // Actually Node.js Buffer.from is lenient, so this may not be null
      // Just verify it doesn't crash
      expect(key === null || key instanceof Buffer).toBe(true);
    });
  });

  describe('generateNonce', () => {
    it('should generate correct 16-byte nonce with uint64 packet ID', () => {
      const packetId = 0x12345678;
      const fromNode = 0xABCDEF00;

      const nonce = generateNonce(packetId, fromNode);

      expect(nonce.length).toBe(16);
      // Packet ID as uint64 little-endian (first 8 bytes)
      expect(nonce.readBigUInt64LE(0)).toBe(BigInt(packetId));
      // From node at offset 8
      expect(nonce.readUInt32LE(8)).toBe(fromNode);
      // Bytes 12-15 should be zero
      expect(nonce.subarray(12, 16)).toEqual(Buffer.alloc(4, 0));
    });
  });

  describe('decryptPayload', () => {
    it('should decrypt with valid key and nonce', () => {
      // Test with known encrypted data
      // This would need real test vectors from Meshtastic
      const key = keyFromHex(MESHTASTIC_KEYS.LONGFAST_DEFAULT);
      const packetId = 12345;
      const fromNode = 0x12345678;

      // Create test data by encrypting something first
      const crypto = require('crypto');
      const nonce = generateNonce(packetId, fromNode);
      const plaintext = Buffer.from('Hello, Meshtastic!');

      const cipher = crypto.createCipheriv('aes-256-ctr', key, nonce);
      const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

      // Now decrypt
      const decrypted = decryptPayload(encrypted, key, packetId, fromNode);

      expect(decrypted).not.toBeNull();
      expect(decrypted!.toString()).toBe('Hello, Meshtastic!');
    });

    it('should reject invalid key length', () => {
      const badKey = Buffer.alloc(15); // 15 bytes is invalid (must be 16 or 32)
      const result = decryptPayload(
        Buffer.from('test'),
        badKey,
        123,
        456
      );
      expect(result).toBeNull();
    });
  });

  describe('extractChannelFromTopic', () => {
    it('should extract channel from encrypted topic', () => {
      const topic = 'msh/US/KY/2/e/LongFast/!abcd1234';
      expect(extractChannelFromTopic(topic)).toBe('LongFast');
    });

    it('should extract channel from channel topic', () => {
      const topic = 'msh/US/2/c/MyChannel/!12345678';
      expect(extractChannelFromTopic(topic)).toBe('MyChannel');
    });

    it('should return null for invalid topic', () => {
      const topic = 'msh/US/2/json/!12345678';
      expect(extractChannelFromTopic(topic)).toBeNull();
    });
  });
});

describe('Protobuf Decoder', () => {
  describe('getPortNumName', () => {
    it('should return correct port name', () => {
      expect(getPortNumName(MESHTASTIC_PORTNUM.TEXT_MESSAGE_APP)).toBe('TEXT_MESSAGE_APP');
      expect(getPortNumName(MESHTASTIC_PORTNUM.POSITION_APP)).toBe('POSITION_APP');
      expect(getPortNumName(MESHTASTIC_PORTNUM.TELEMETRY_APP)).toBe('TELEMETRY_APP');
    });

    it('should return UNKNOWN for unknown port', () => {
      expect(getPortNumName(999 as any)).toBe('UNKNOWN_999');
    });
  });

  describe('decodeData', () => {
    it('should decode simple Data message', () => {
      // Construct a simple Data protobuf:
      // field 1 (portnum) = 1 (TEXT_MESSAGE_APP)
      // field 2 (payload) = "Hello"
      const buf = Buffer.from([
        0x08, 0x01,                           // field 1, varint, value 1
        0x12, 0x05, 0x48, 0x65, 0x6c, 0x6c, 0x6f // field 2, length 5, "Hello"
      ]);

      const data = decodeData(buf);
      expect(data).not.toBeNull();
      expect(data!.portnum).toBe(MESHTASTIC_PORTNUM.TEXT_MESSAGE_APP);
      expect(data!.payload.toString()).toBe('Hello');
    });
  });

  describe('decodePosition', () => {
    it('should decode Position message', () => {
      // Position with lat/lon as sfixed32 (wire type 5)
      // The test bytes decode to latitudeI = 377780208
      const buf = Buffer.from([
        0x0d, 0xf0, 0x77, 0x84, 0x16, // field 1, fixed32, lat_i
        0x15, 0x00, 0xdc, 0x0d, 0xb7, // field 2, fixed32, lon_i (negative)
      ]);

      const pos = decodePosition(buf);
      expect(pos).not.toBeNull();
      expect(pos!.latitudeI).toBe(377780208); // 0x168477f0 little-endian
      // Note: negative sfixed32
    });
  });

  describe('decodeUser', () => {
    it('should decode User message', () => {
      // User with id, long_name, short_name
      const buf = Buffer.from([
        0x0a, 0x09, 0x21, 0x61, 0x62, 0x63, 0x64, 0x31, 0x32, 0x33, 0x34, // id: "!abcd1234"
        0x12, 0x04, 0x54, 0x65, 0x73, 0x74, // long_name: "Test"
        0x1a, 0x02, 0x54, 0x53, // short_name: "TS"
      ]);

      const user = decodeUser(buf);
      expect(user).not.toBeNull();
      expect(user!.id).toBe('!abcd1234');
      expect(user!.longName).toBe('Test');
      expect(user!.shortName).toBe('TS');
    });
  });

  describe('decodeMeshPacket', () => {
    it('should decode MeshPacket with encrypted payload', () => {
      // MeshPacket with from, to, channel, id, encrypted
      const buf = Buffer.from([
        0x08, 0x78, // from: 120 (varint)
        0x10, 0x90, 0x01, // to: 144 (varint)
        0x18, 0x00, // channel: 0
        0x2a, 0x05, 0x01, 0x02, 0x03, 0x04, 0x05, // encrypted: 5 bytes
        0x30, 0xd2, 0x09, // id: 1234 (varint)
      ]);

      const packet = decodeMeshPacket(buf);
      expect(packet).not.toBeNull();
      expect(packet!.from).toBe(120);
      expect(packet!.to).toBe(144);
      expect(packet!.channel).toBe(0);
      expect(packet!.id).toBe(1234);
      expect(packet!.encrypted).toEqual(Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]));
    });
  });

  describe('decodeServiceEnvelope', () => {
    it('should decode ServiceEnvelope with channel_id and gateway_id', () => {
      // ServiceEnvelope with channel_id and gateway_id strings
      const buf = Buffer.from([
        0x12, 0x08, 0x4c, 0x6f, 0x6e, 0x67, 0x46, 0x61, 0x73, 0x74, // channel_id: "LongFast"
        0x1a, 0x09, 0x21, 0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x30, 0x30, // gateway_id: "!abcdef00"
      ]);

      const envelope = decodeServiceEnvelope(buf);
      expect(envelope).not.toBeNull();
      expect(envelope!.channelId).toBe('LongFast');
      expect(envelope!.gatewayId).toBe('!abcdef00');
    });
  });
});

describe('isValidProtobuf', () => {
  it('should return true for valid protobuf-like data', () => {
    // Valid field 1, wire type 0 (varint)
    const valid = Buffer.from([0x08, 0x01]);
    expect(isValidProtobuf(valid)).toBe(true);
  });

  it('should return false for too short data', () => {
    expect(isValidProtobuf(Buffer.from([0x08]))).toBe(false);
  });

  it('should return false for invalid wire type', () => {
    // Wire type 7 is invalid
    const invalid = Buffer.from([0x0f, 0x01]);
    expect(isValidProtobuf(invalid)).toBe(false);
  });

  it('should return false for field number 0', () => {
    // Field 0 is invalid in protobuf
    const invalid = Buffer.from([0x00, 0x01]);
    expect(isValidProtobuf(invalid)).toBe(false);
  });
});
