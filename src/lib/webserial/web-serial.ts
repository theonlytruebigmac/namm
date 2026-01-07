/**
 * Web Serial API for Meshtastic
 *
 * Connects to Meshtastic device directly from the browser using Web Serial API.
 * Similar to how flasher.meshtastic.org works.
 */

// Serial protocol constants
const SERIAL_MAGIC = new Uint8Array([0x94, 0xc3]);
const SERIAL_BAUD_RATE = 115200;

export interface SerialConnectionState {
  isSupported: boolean;
  isConnected: boolean;
  port: SerialPort | null;
  error: string | null;
}

export interface FromRadioMessage {
  type: 'packet' | 'myInfo' | 'nodeInfo' | 'config' | 'configComplete' | 'channel' | 'metadata' | 'unknown';
  data: Record<string, unknown>;
  raw: Uint8Array;
}

export interface ChannelInfo {
  index: number;
  name: string;
  psk: Uint8Array | null;
  role: number;
}

type MessageCallback = (message: FromRadioMessage) => void;
type StatusCallback = (connected: boolean) => void;

class WebSerialConnection {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private readLoop: Promise<void> | null = null;
  private buffer: Uint8Array = new Uint8Array(0);
  private isReading = false;

  private messageCallbacks: Set<MessageCallback> = new Set();
  private statusCallbacks: Set<StatusCallback> = new Set();

  /**
   * Check if Web Serial API is supported
   */
  isSupported(): boolean {
    return 'serial' in navigator;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.port !== null && this.isReading;
  }

  /**
   * Subscribe to messages
   */
  onMessage(callback: MessageCallback): () => void {
    this.messageCallbacks.add(callback);
    return () => this.messageCallbacks.delete(callback);
  }

  /**
   * Subscribe to connection status changes
   */
  onStatusChange(callback: StatusCallback): () => void {
    this.statusCallbacks.add(callback);
    return () => this.statusCallbacks.delete(callback);
  }

  /**
   * Request port access and connect
   */
  async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Web Serial API not supported. Use Chrome, Edge, or Opera.');
    }

    try {
      // Request port - no filters to allow all serial devices
      // The user can select any available serial port
      this.port = await navigator.serial.requestPort();

      await this.port.open({ baudRate: SERIAL_BAUD_RATE });

      // Get reader and writer
      if (this.port.readable && this.port.writable) {
        this.reader = this.port.readable.getReader();
        this.writer = this.port.writable.getWriter();
        this.isReading = true;
        this.readLoop = this.startReadLoop();

        // Notify status change
        this.notifyStatus(true);

        // Request device config
        await this.requestConfig();

        return true;
      }

      throw new Error('Port not readable/writable');
    } catch (error) {
      if ((error as Error).name === 'NotFoundError') {
        // User cancelled port selection
        return false;
      }
      throw error;
    }
  }

  /**
   * Disconnect from device
   */
  async disconnect(): Promise<void> {
    this.isReading = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
        this.reader.releaseLock();
      } catch {
        // Ignore
      }
      this.reader = null;
    }

    if (this.writer) {
      try {
        this.writer.releaseLock();
      } catch {
        // Ignore
      }
      this.writer = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // Ignore
      }
      this.port = null;
    }

    this.buffer = new Uint8Array(0);
    this.notifyStatus(false);
  }

  /**
   * Send a ToRadio message
   */
  async send(data: Uint8Array): Promise<void> {
    if (!this.writer) {
      throw new Error('Not connected');
    }

    // Frame the data: magic bytes + length (2 bytes big-endian) + data
    const frame = new Uint8Array(4 + data.length);
    frame[0] = SERIAL_MAGIC[0];
    frame[1] = SERIAL_MAGIC[1];
    frame[2] = (data.length >> 8) & 0xff;
    frame[3] = data.length & 0xff;
    frame.set(data, 4);

    await this.writer.write(frame);
  }

  /**
   * Request device configuration (want_config)
   */
  private async requestConfig(): Promise<void> {
    // ToRadio message with want_config_id = 1
    // Field 3 (want_config_id) = varint 1
    const wantConfig = new Uint8Array([0x18, 0x01]); // field 3, varint 1
    await this.send(wantConfig);
  }

  /**
   * Send a text message via serial
   *
   * ToRadio message structure:
   *   Field 2: MeshPacket (packet to send)
   *
   * MeshPacket structure:
   *   Field 1: from (fixed32) - set to 0, device fills in
   *   Field 2: to (fixed32) - destination node (0xffffffff for broadcast)
   *   Field 3: channel (varint) - channel index
   *   Field 5: decoded (Data message)
   *   Field 6: id (fixed32) - packet ID
   *   Field 9: hop_limit (varint)
   *   Field 10: want_ack (varint bool)
   *
   * Data structure:
   *   Field 1: portnum (varint) - 1 for TEXT_MESSAGE_APP
   *   Field 2: payload (bytes) - UTF-8 text
   */
  async sendTextMessage(text: string, options?: {
    channel?: number;
    to?: number;
    wantAck?: boolean;
  }): Promise<boolean> {
    if (!this.writer) {
      console.error('[WebSerial] Cannot send: not connected');
      return false;
    }

    const channel = options?.channel ?? 0;
    const to = options?.to ?? 0xffffffff; // Broadcast
    const wantAck = options?.wantAck ?? false;
    const packetId = Math.floor(Math.random() * 0xffffffff);

    try {
      // Encode the text payload
      const textBytes = new TextEncoder().encode(text);

      // Build Data message
      // Field 1: portnum = 1 (TEXT_MESSAGE_APP)
      // Field 2: payload = text bytes
      const dataMsg = this.encodeData(1, textBytes);

      // Build MeshPacket
      // Field 2: to (fixed32)
      // Field 3: channel (varint) - only if not 0
      // Field 5: decoded (Data)
      // Field 6: id (fixed32)
      // Field 9: hop_limit (varint)
      // Field 10: want_ack (varint)
      const meshPacket = this.encodeMeshPacket({
        to,
        channel,
        decoded: dataMsg,
        id: packetId,
        hopLimit: 3,
        wantAck,
      });

      // Build ToRadio
      // Field 2: packet (MeshPacket)
      const toRadio = this.encodeToRadio(meshPacket);

      // Send
      await this.send(toRadio);
      console.log(`[WebSerial] Sent message (id=${packetId}): "${text.substring(0, 50)}..."`);

      return true;
    } catch (error) {
      console.error('[WebSerial] Failed to send message:', error);
      return false;
    }
  }

  /**
   * Encode Data message for TEXT_MESSAGE_APP
   */
  private encodeData(portnum: number, payload: Uint8Array): Uint8Array {
    const parts: Uint8Array[] = [];

    // Field 1: portnum (varint)
    parts.push(this.encodeVarintField(1, portnum));

    // Field 2: payload (length-delimited)
    parts.push(this.encodeLengthDelimited(2, payload));

    return this.concatArrays(parts);
  }

  /**
   * Encode MeshPacket for sending
   */
  private encodeMeshPacket(options: {
    to: number;
    channel?: number;
    decoded: Uint8Array;
    id: number;
    hopLimit: number;
    wantAck: boolean;
  }): Uint8Array {
    const parts: Uint8Array[] = [];

    // Field 2: to (fixed32)
    parts.push(this.encodeFixed32Field(2, options.to));

    // Field 3: channel (varint) - only if not 0
    if (options.channel && options.channel > 0) {
      parts.push(this.encodeVarintField(3, options.channel));
    }

    // Field 5: decoded (length-delimited Data)
    parts.push(this.encodeLengthDelimited(5, options.decoded));

    // Field 6: id (fixed32)
    parts.push(this.encodeFixed32Field(6, options.id));

    // Field 9: hop_limit (varint)
    parts.push(this.encodeVarintField(9, options.hopLimit));

    // Field 10: want_ack (varint)
    if (options.wantAck) {
      parts.push(this.encodeVarintField(10, 1));
    }

    return this.concatArrays(parts);
  }

  /**
   * Encode ToRadio wrapper
   */
  private encodeToRadio(packet: Uint8Array): Uint8Array {
    // Field 2: packet (length-delimited MeshPacket)
    return this.encodeLengthDelimited(2, packet);
  }

  /**
   * Encode a varint field
   */
  private encodeVarintField(fieldNum: number, value: number): Uint8Array {
    const header = (fieldNum << 3) | 0; // wire type 0 = varint
    const headerBytes = this.encodeVarint(header);
    const valueBytes = this.encodeVarint(value);
    return this.concatArrays([headerBytes, valueBytes]);
  }

  /**
   * Encode a fixed32 field
   */
  private encodeFixed32Field(fieldNum: number, value: number): Uint8Array {
    const header = (fieldNum << 3) | 5; // wire type 5 = fixed32
    const result = new Uint8Array(1 + 4);
    result[0] = header;
    // Little-endian
    result[1] = value & 0xff;
    result[2] = (value >> 8) & 0xff;
    result[3] = (value >> 16) & 0xff;
    result[4] = (value >> 24) & 0xff;
    return result;
  }

  /**
   * Encode a length-delimited field
   */
  private encodeLengthDelimited(fieldNum: number, data: Uint8Array): Uint8Array {
    const header = (fieldNum << 3) | 2; // wire type 2 = length-delimited
    const headerBytes = this.encodeVarint(header);
    const lengthBytes = this.encodeVarint(data.length);
    return this.concatArrays([headerBytes, lengthBytes, data]);
  }

  /**
   * Encode a varint
   */
  private encodeVarint(value: number): Uint8Array {
    const bytes: number[] = [];
    let v = value >>> 0;
    while (v > 0x7f) {
      bytes.push((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    bytes.push(v);
    return new Uint8Array(bytes);
  }

  /**
   * Concatenate Uint8Arrays
   */
  private concatArrays(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  /**
   * Read loop
   */
  private async startReadLoop(): Promise<void> {
    while (this.isReading && this.reader) {
      try {
        const { value, done } = await this.reader.read();

        if (done) {
          break;
        }

        if (value) {
          this.processIncoming(value);
        }
      } catch (error) {
        if (this.isReading) {
          console.error('[WebSerial] Read error:', error);
          await this.disconnect();
        }
        break;
      }
    }
  }

  /**
   * Process incoming data
   */
  private processIncoming(data: Uint8Array): void {
    // Append to buffer
    const newBuffer = new Uint8Array(this.buffer.length + data.length);
    newBuffer.set(this.buffer);
    newBuffer.set(data, this.buffer.length);
    this.buffer = newBuffer;

    // Try to extract frames
    while (this.buffer.length >= 4) {
      // Look for magic bytes
      const magicIndex = this.findMagicBytes();
      if (magicIndex === -1) {
        // No magic found, keep last byte in case it's partial magic
        this.buffer = this.buffer.slice(-1);
        break;
      }

      // Skip bytes before magic
      if (magicIndex > 0) {
        this.buffer = this.buffer.slice(magicIndex);
      }

      // Check if we have enough for length
      if (this.buffer.length < 4) {
        break;
      }

      // Read length (big-endian)
      const length = (this.buffer[2] << 8) | this.buffer[3];

      // Validate length
      if (length > 1024) {
        // Invalid length, skip magic and try again
        this.buffer = this.buffer.slice(2);
        continue;
      }

      // Check if we have full frame
      if (this.buffer.length < 4 + length) {
        break;
      }

      // Extract payload
      const payload = this.buffer.slice(4, 4 + length);
      this.buffer = this.buffer.slice(4 + length);

      // Decode and notify
      try {
        const message = this.decodeFromRadio(payload);
        this.notifyMessage(message);
      } catch (error) {
        console.error('[WebSerial] Decode error:', error);
      }
    }
  }

  /**
   * Find magic bytes in buffer
   */
  private findMagicBytes(): number {
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i] === SERIAL_MAGIC[0] && this.buffer[i + 1] === SERIAL_MAGIC[1]) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Decode FromRadio protobuf message
   */
  private decodeFromRadio(data: Uint8Array): FromRadioMessage {
    // Simple protobuf decoding for FromRadio
    let offset = 0;
    let type: FromRadioMessage['type'] = 'unknown';
    const result: Record<string, unknown> = {};

    while (offset < data.length) {
      const tag = data[offset++];
      const fieldNum = tag >> 3;
      const wireType = tag & 0x07;

      if (wireType === 0) {
        // Varint
        let value = 0;
        let shift = 0;
        while (offset < data.length) {
          const byte = data[offset++];
          value |= (byte & 0x7f) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }

        if (fieldNum === 1) result.id = value;
        if (fieldNum === 6) {
          type = 'configComplete';
          result.configCompleteId = value;
        }
        if (fieldNum === 7) {
          type = 'configComplete';
          result.configCompleteId = value;
        }
        if (fieldNum === 8) {
          // rebooted (bool) - skip
        }
      } else if (wireType === 2) {
        // Length-delimited
        let len = 0;
        let shift = 0;
        while (offset < data.length) {
          const byte = data[offset++];
          len |= (byte & 0x7f) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }

        const subData = data.slice(offset, offset + len);
        offset += len;

        if (fieldNum === 2) {
          type = 'packet';
          result.packet = this.decodeMeshPacket(subData);
        } else if (fieldNum === 3) {
          type = 'myInfo';
          result.myInfo = this.decodeMyInfo(subData);
        } else if (fieldNum === 4) {
          type = 'nodeInfo';
          result.nodeInfo = this.decodeNodeInfo(subData);
        } else if (fieldNum === 7) {
          type = 'config';
          result.config = subData;
        } else if (fieldNum === 10) {
          // Channel is field 10 in FromRadio protobuf
          type = 'channel';
          result.channel = this.decodeChannel(subData);
        } else if (fieldNum === 9) {
          type = 'metadata';
          result.metadata = subData;
        }
      } else {
        // Skip unknown wire types
        break;
      }
    }

    return { type, data: result, raw: data };
  }

  /**
   * Decode MeshPacket
   */
  private decodeMeshPacket(data: Uint8Array): Record<string, unknown> {
    const packet: Record<string, unknown> = {};
    let offset = 0;

    while (offset < data.length) {
      const tag = data[offset++];
      const fieldNum = tag >> 3;
      const wireType = tag & 0x07;

      if (wireType === 0) {
        let value = 0;
        let shift = 0;
        while (offset < data.length) {
          const byte = data[offset++];
          value |= (byte & 0x7f) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }

        if (fieldNum === 6) packet.rxTime = value;
        if (fieldNum === 7) packet.rxSnr = value;
        if (fieldNum === 8) packet.hopLimit = value;
        if (fieldNum === 9) packet.wantAck = value !== 0;
        if (fieldNum === 12) packet.channel = value;
        if (fieldNum === 13) packet.rxRssi = value;
      } else if (wireType === 2) {
        let len = 0;
        let shift = 0;
        while (offset < data.length) {
          const byte = data[offset++];
          len |= (byte & 0x7f) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }

        const subData = data.slice(offset, offset + len);
        offset += len;

        if (fieldNum === 4) {
          packet.decoded = this.decodeData(subData);
        } else if (fieldNum === 5) {
          packet.encrypted = subData;
        }
      } else if (wireType === 5) {
        // Fixed32
        if (offset + 4 <= data.length) {
          const value = data[offset] | (data[offset + 1] << 8) |
                       (data[offset + 2] << 16) | (data[offset + 3] << 24);
          offset += 4;

          if (fieldNum === 1) packet.from = value >>> 0;
          if (fieldNum === 2) packet.to = value >>> 0;
          if (fieldNum === 10) packet.id = value >>> 0;
        }
      } else {
        break;
      }
    }

    return packet;
  }

  /**
   * Decode Data payload
   */
  private decodeData(data: Uint8Array): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    let offset = 0;

    while (offset < data.length) {
      const tag = data[offset++];
      const fieldNum = tag >> 3;
      const wireType = tag & 0x07;

      if (wireType === 0) {
        let value = 0;
        let shift = 0;
        while (offset < data.length) {
          const byte = data[offset++];
          value |= (byte & 0x7f) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }

        if (fieldNum === 1) result.portnum = value;
        if (fieldNum === 6) result.requestId = value;
        if (fieldNum === 7) result.replyId = value;
        if (fieldNum === 8) result.emoji = value;
      } else if (wireType === 2) {
        let len = 0;
        let shift = 0;
        while (offset < data.length) {
          const byte = data[offset++];
          len |= (byte & 0x7f) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }

        const subData = data.slice(offset, offset + len);
        offset += len;

        if (fieldNum === 2) result.payload = subData;
      } else {
        break;
      }
    }

    return result;
  }

  /**
   * Decode MyInfo
   */
  private decodeMyInfo(data: Uint8Array): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    let offset = 0;

    while (offset < data.length) {
      const tag = data[offset++];
      const fieldNum = tag >> 3;
      const wireType = tag & 0x07;

      if (wireType === 0) {
        let value = 0;
        let shift = 0;
        while (offset < data.length) {
          const byte = data[offset++];
          value |= (byte & 0x7f) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }

        if (fieldNum === 1) result.myNodeNum = value;
      } else if (wireType === 5) {
        offset += 4;
      } else if (wireType === 2) {
        let len = 0;
        let shift = 0;
        while (offset < data.length) {
          const byte = data[offset++];
          len |= (byte & 0x7f) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }
        offset += len;
      } else {
        break;
      }
    }

    return result;
  }

  /**
   * Decode NodeInfo
   */
  private decodeNodeInfo(data: Uint8Array): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    let offset = 0;

    while (offset < data.length) {
      const tag = data[offset++];
      const fieldNum = tag >> 3;
      const wireType = tag & 0x07;

      if (wireType === 0) {
        let value = 0;
        let shift = 0;
        while (offset < data.length) {
          const byte = data[offset++];
          value |= (byte & 0x7f) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }

        if (fieldNum === 1) result.num = value;
        if (fieldNum === 5) result.lastHeard = value;
        if (fieldNum === 6) result.channel = value;
      } else if (wireType === 2) {
        let len = 0;
        let shift = 0;
        while (offset < data.length) {
          const byte = data[offset++];
          len |= (byte & 0x7f) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }

        const subData = data.slice(offset, offset + len);
        offset += len;

        if (fieldNum === 2) {
          result.user = this.decodeUser(subData);
        }
      } else {
        break;
      }
    }

    return result;
  }

  /**
   * Decode User
   */
  private decodeUser(data: Uint8Array): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    let offset = 0;

    while (offset < data.length) {
      const tag = data[offset++];
      const fieldNum = tag >> 3;
      const wireType = tag & 0x07;

      if (wireType === 0) {
        let value = 0;
        let shift = 0;
        while (offset < data.length) {
          const byte = data[offset++];
          value |= (byte & 0x7f) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }

        if (fieldNum === 5) result.hwModel = value;
        if (fieldNum === 6) result.isLicensed = value !== 0;
        if (fieldNum === 7) result.role = value;
      } else if (wireType === 2) {
        let len = 0;
        let shift = 0;
        while (offset < data.length) {
          const byte = data[offset++];
          len |= (byte & 0x7f) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }

        const subData = data.slice(offset, offset + len);
        offset += len;

        const text = new TextDecoder().decode(subData);
        if (fieldNum === 1) result.id = text;
        if (fieldNum === 2) result.longName = text;
        if (fieldNum === 3) result.shortName = text;
        if (fieldNum === 4) result.macaddr = subData;
      } else {
        break;
      }
    }

    return result;
  }

  /**
   * Decode Channel
   * Protobuf Channel message:
   * - field 1: index (varint)
   * - field 2: settings (ChannelSettings - length-delimited)
   * - field 3: role (varint) - 0=disabled, 1=primary, 2=secondary
   */
  private decodeChannel(data: Uint8Array): ChannelInfo {
    const result: ChannelInfo = {
      index: 0,
      name: '',
      psk: null,
      role: 0,
    };
    let offset = 0;

    while (offset < data.length) {
      const tag = data[offset++];
      const fieldNum = tag >> 3;
      const wireType = tag & 0x07;

      if (wireType === 0) {
        let value = 0;
        let shift = 0;
        while (offset < data.length) {
          const byte = data[offset++];
          value |= (byte & 0x7f) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }

        if (fieldNum === 1) result.index = value;
        if (fieldNum === 3) result.role = value;
      } else if (wireType === 2) {
        let len = 0;
        let shift = 0;
        while (offset < data.length) {
          const byte = data[offset++];
          len |= (byte & 0x7f) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }

        const subData = data.slice(offset, offset + len);
        offset += len;

        if (fieldNum === 2) {
          // Decode ChannelSettings
          const settings = this.decodeChannelSettings(subData);
          result.name = settings.name || '';
          result.psk = settings.psk || null;
        }
      } else {
        break;
      }
    }

    return result;
  }

  /**
   * Decode ChannelSettings
   * - field 1: channel_num (varint) - deprecated
   * - field 3: psk (bytes)
   * - field 4: name (string)
   * - field 5: id (fixed32)
   * - field 6: uplink_enabled (bool)
   * - field 7: downlink_enabled (bool)
   */
  private decodeChannelSettings(data: Uint8Array): { name: string; psk: Uint8Array | null } {
    const result: { name: string; psk: Uint8Array | null } = {
      name: '',
      psk: null,
    };
    let offset = 0;

    while (offset < data.length) {
      const tag = data[offset++];
      const fieldNum = tag >> 3;
      const wireType = tag & 0x07;

      if (wireType === 0) {
        // Skip varints
        while (offset < data.length && (data[offset] & 0x80)) offset++;
        if (offset < data.length) offset++;
      } else if (wireType === 2) {
        let len = 0;
        let shift = 0;
        while (offset < data.length) {
          const byte = data[offset++];
          len |= (byte & 0x7f) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }

        const subData = data.slice(offset, offset + len);
        offset += len;

        if (fieldNum === 3) {
          result.psk = subData;
        } else if (fieldNum === 4) {
          result.name = new TextDecoder().decode(subData);
        }
      } else if (wireType === 5) {
        // Fixed32 - skip
        offset += 4;
      } else {
        break;
      }
    }

    return result;
  }

  private notifyMessage(message: FromRadioMessage): void {
    this.messageCallbacks.forEach((cb) => cb(message));
  }

  private notifyStatus(connected: boolean): void {
    this.statusCallbacks.forEach((cb) => cb(connected));
  }
}

// Singleton instance
export const webSerial = new WebSerialConnection();
