/**
 * Meshtastic Serial Protocol
 *
 * Handles the framing protocol for serial communication with Meshtastic devices.
 * The serial protocol uses a simple framing:
 *   - Magic bytes: 0x94 0xC3
 *   - Length: 2 bytes (big-endian, MSB first)
 *   - Payload: Protobuf data (FromRadio or ToRadio)
 */

// Magic bytes that start each frame
export const SERIAL_MAGIC = Buffer.from([0x94, 0xc3]);

// Maximum payload size
export const MAX_PAYLOAD_SIZE = 512;

/**
 * Parse a complete serial frame
 * Returns the protobuf payload or null if frame is invalid
 */
export function parseSerialFrame(data: Buffer): Buffer | null {
  // Need at least 4 bytes (magic + length)
  if (data.length < 4) {
    return null;
  }

  // Check magic bytes
  if (data[0] !== 0x94 || data[1] !== 0xc3) {
    return null;
  }

  // Read length (big-endian, MSB first)
  const length = (data[2] << 8) | data[3];

  if (length > MAX_PAYLOAD_SIZE) {
    console.error(`[Serial] Invalid frame length: ${length}`);
    return null;
  }

  // Check if we have complete payload
  if (data.length < 4 + length) {
    return null;
  }

  // Extract payload
  return data.subarray(4, 4 + length);
}

/**
 * Create a serial frame for sending ToRadio messages
 */
export function createSerialFrame(payload: Buffer): Buffer {
  const frame = Buffer.alloc(4 + payload.length);

  // Magic bytes
  frame[0] = 0x94;
  frame[1] = 0xc3;

  // Length (big-endian)
  frame[2] = (payload.length >> 8) & 0xff;
  frame[3] = payload.length & 0xff;

  // Payload
  payload.copy(frame, 4);

  return frame;
}

/**
 * Frame accumulator for handling partial reads
 */
export class SerialFrameAccumulator {
  private buffer: Buffer = Buffer.alloc(0);

  /**
   * Add data to the accumulator
   * Returns array of complete frame payloads
   */
  addData(data: Buffer): Buffer[] {
    // Append new data
    this.buffer = Buffer.concat([this.buffer, data]);

    const frames: Buffer[] = [];

    // Try to extract complete frames
    while (this.buffer.length >= 4) {
      // Look for magic bytes
      const magicIndex = this.findMagic();

      if (magicIndex === -1) {
        // No magic found, discard buffer
        this.buffer = Buffer.alloc(0);
        break;
      }

      if (magicIndex > 0) {
        // Discard data before magic
        this.buffer = this.buffer.subarray(magicIndex);
      }

      if (this.buffer.length < 4) {
        break; // Need more data
      }

      // Read length
      const length = (this.buffer[2] << 8) | this.buffer[3];

      if (length > MAX_PAYLOAD_SIZE) {
        // Invalid length, skip magic and try again
        this.buffer = this.buffer.subarray(2);
        continue;
      }

      const frameSize = 4 + length;

      if (this.buffer.length < frameSize) {
        break; // Need more data
      }

      // Extract complete frame
      const payload = this.buffer.subarray(4, frameSize);
      frames.push(Buffer.from(payload)); // Create a copy

      // Remove frame from buffer
      this.buffer = this.buffer.subarray(frameSize);
    }

    return frames;
  }

  private findMagic(): number {
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i] === 0x94 && this.buffer[i + 1] === 0xc3) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Clear the accumulator buffer
   */
  clear(): void {
    this.buffer = Buffer.alloc(0);
  }
}
