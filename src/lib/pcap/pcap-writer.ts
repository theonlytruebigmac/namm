/**
 * PCAP Writer
 *
 * Creates Wireshark-compatible PCAP files for mesh network analysis
 *
 * PCAP Format:
 * - Global header (24 bytes)
 * - Per-packet header (16 bytes) + packet data
 *
 * We use a custom link type (User Link Type 0 = 147) for Meshtastic packets
 */

import fs from 'fs';
import path from 'path';

// PCAP magic number (little-endian)
const PCAP_MAGIC = 0xa1b2c3d4;

// Link type for user-defined protocol (DLT_USER0)
const LINKTYPE_USER0 = 147;

// PCAP version
const PCAP_VERSION_MAJOR = 2;
const PCAP_VERSION_MINOR = 4;

// Maximum snapshot length
const SNAPLEN = 65535;

export interface CaptureSession {
  id: string;
  filename: string;
  filePath: string;
  startTime: number;
  endTime?: number;
  packetCount: number;
  byteCount: number;
  status: 'active' | 'stopped' | 'error';
  filter?: CaptureFilter;
}

export interface CaptureFilter {
  nodeIds?: string[];     // Specific nodes to capture
  channels?: number[];    // Specific channels
  portnums?: number[];    // Specific portnums (TEXT_MESSAGE=1, TELEMETRY=67, etc)
  minSnr?: number;        // Minimum SNR threshold
}

export interface PacketMetadata {
  timestamp: number;      // Unix timestamp in ms
  nodeId: string;         // Source node ID
  channel: number;        // Channel index
  portnum: number;        // Application portnum
  snr?: number;           // Signal-to-noise ratio
  rssi?: number;          // Received signal strength
  hopStart?: number;      // Original hop limit
  hopLimit?: number;      // Current hop limit
}

/**
 * PCAP Writer for capturing mesh packets
 */
export class PCAPWriter {
  private stream: fs.WriteStream | null = null;
  private session: CaptureSession | null = null;
  private dataDir: string;

  constructor(dataDir: string = './data/captures') {
    this.dataDir = dataDir;
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Start a new capture session
   */
  startCapture(filter?: CaptureFilter): CaptureSession {
    if (this.session?.status === 'active') {
      throw new Error('Capture already in progress');
    }

    const id = `capture_${Date.now()}`;
    const filename = `${id}.pcap`;
    const filePath = path.join(this.dataDir, filename);

    // Create file stream
    this.stream = fs.createWriteStream(filePath);

    // Write PCAP global header
    this.writeGlobalHeader();

    this.session = {
      id,
      filename,
      filePath,
      startTime: Date.now(),
      packetCount: 0,
      byteCount: 0,
      status: 'active',
      filter,
    };

    console.log(`Started PCAP capture: ${filename}`);
    return this.session;
  }

  /**
   * Stop the current capture session
   */
  stopCapture(): CaptureSession | null {
    if (!this.session || this.session.status !== 'active') {
      return null;
    }

    this.session.endTime = Date.now();
    this.session.status = 'stopped';

    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }

    console.log(`Stopped PCAP capture: ${this.session.filename}, ${this.session.packetCount} packets`);
    return this.session;
  }

  /**
   * Write a packet to the capture
   */
  writePacket(data: Buffer, metadata: PacketMetadata): boolean {
    if (!this.stream || !this.session || this.session.status !== 'active') {
      return false;
    }

    // Apply filters
    if (this.session.filter) {
      if (!this.matchesFilter(metadata, this.session.filter)) {
        return false;
      }
    }

    // Create packet with metadata header
    const packetData = this.createPacketWithMetadata(data, metadata);

    // Write PCAP packet header + data
    this.writePacketHeader(packetData.length, metadata.timestamp);
    this.stream.write(packetData);

    this.session.packetCount++;
    this.session.byteCount += packetData.length;

    return true;
  }

  /**
   * Get the current session
   */
  getSession(): CaptureSession | null {
    return this.session;
  }

  /**
   * List all capture files
   */
  listCaptures(): { filename: string; size: number; created: number }[] {
    const files = fs.readdirSync(this.dataDir);
    return files
      .filter(f => f.endsWith('.pcap'))
      .map(filename => {
        const filePath = path.join(this.dataDir, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          size: stats.size,
          created: stats.birthtimeMs,
        };
      })
      .sort((a, b) => b.created - a.created);
  }

  /**
   * Get capture file path
   */
  getCaptureFilePath(filename: string): string | null {
    const filePath = path.join(this.dataDir, filename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }

  /**
   * Delete a capture file
   */
  deleteCapture(filename: string): boolean {
    const filePath = path.join(this.dataDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  /**
   * Write PCAP global header (24 bytes)
   */
  private writeGlobalHeader(): void {
    if (!this.stream) return;

    const header = Buffer.alloc(24);
    let offset = 0;

    // Magic number (4 bytes)
    header.writeUInt32LE(PCAP_MAGIC, offset);
    offset += 4;

    // Version major (2 bytes)
    header.writeUInt16LE(PCAP_VERSION_MAJOR, offset);
    offset += 2;

    // Version minor (2 bytes)
    header.writeUInt16LE(PCAP_VERSION_MINOR, offset);
    offset += 2;

    // This zone (4 bytes) - GMT offset, unused
    header.writeInt32LE(0, offset);
    offset += 4;

    // Sigfigs (4 bytes) - timestamp accuracy, unused
    header.writeUInt32LE(0, offset);
    offset += 4;

    // Snaplen (4 bytes)
    header.writeUInt32LE(SNAPLEN, offset);
    offset += 4;

    // Network (4 bytes) - link type
    header.writeUInt32LE(LINKTYPE_USER0, offset);

    this.stream.write(header);
  }

  /**
   * Write PCAP packet header (16 bytes)
   */
  private writePacketHeader(capturedLength: number, timestampMs: number): void {
    if (!this.stream) return;

    const header = Buffer.alloc(16);
    let offset = 0;

    // Timestamp seconds (4 bytes)
    const seconds = Math.floor(timestampMs / 1000);
    header.writeUInt32LE(seconds, offset);
    offset += 4;

    // Timestamp microseconds (4 bytes)
    const microseconds = (timestampMs % 1000) * 1000;
    header.writeUInt32LE(microseconds, offset);
    offset += 4;

    // Captured length (4 bytes)
    header.writeUInt32LE(capturedLength, offset);
    offset += 4;

    // Original length (4 bytes)
    header.writeUInt32LE(capturedLength, offset);

    this.stream.write(header);
  }

  /**
   * Create packet with Meshtastic metadata header
   *
   * Custom header format (16 bytes):
   * - 4 bytes: Node ID (last 4 bytes of hex)
   * - 1 byte: Channel
   * - 1 byte: Portnum
   * - 2 bytes: SNR * 100 (signed)
   * - 2 bytes: RSSI (signed)
   * - 1 byte: Hop start
   * - 1 byte: Hop limit
   * - 4 bytes: Reserved
   */
  private createPacketWithMetadata(data: Buffer, metadata: PacketMetadata): Buffer {
    const header = Buffer.alloc(16);
    let offset = 0;

    // Node ID (4 bytes) - last 4 hex chars as uint32
    const nodeNum = parseInt(metadata.nodeId.replace('!', '').slice(-8), 16);
    header.writeUInt32LE(nodeNum, offset);
    offset += 4;

    // Channel (1 byte)
    header.writeUInt8(metadata.channel, offset);
    offset += 1;

    // Portnum (1 byte)
    header.writeUInt8(metadata.portnum, offset);
    offset += 1;

    // SNR * 100 (2 bytes, signed)
    const snr = Math.round((metadata.snr ?? 0) * 100);
    header.writeInt16LE(snr, offset);
    offset += 2;

    // RSSI (2 bytes, signed)
    header.writeInt16LE(metadata.rssi ?? 0, offset);
    offset += 2;

    // Hop start (1 byte)
    header.writeUInt8(metadata.hopStart ?? 0, offset);
    offset += 1;

    // Hop limit (1 byte)
    header.writeUInt8(metadata.hopLimit ?? 0, offset);
    offset += 1;

    // Reserved (4 bytes)
    header.writeUInt32LE(0, offset);

    return Buffer.concat([header, data]);
  }

  /**
   * Check if packet matches filter criteria
   */
  private matchesFilter(metadata: PacketMetadata, filter: CaptureFilter): boolean {
    if (filter.nodeIds && filter.nodeIds.length > 0) {
      if (!filter.nodeIds.includes(metadata.nodeId)) {
        return false;
      }
    }

    if (filter.channels && filter.channels.length > 0) {
      if (!filter.channels.includes(metadata.channel)) {
        return false;
      }
    }

    if (filter.portnums && filter.portnums.length > 0) {
      if (!filter.portnums.includes(metadata.portnum)) {
        return false;
      }
    }

    if (filter.minSnr !== undefined && metadata.snr !== undefined) {
      if (metadata.snr < filter.minSnr) {
        return false;
      }
    }

    return true;
  }
}

// Singleton instance
let pcapWriter: PCAPWriter | null = null;

export function getPCAPWriter(): PCAPWriter {
  if (!pcapWriter) {
    pcapWriter = new PCAPWriter();
  }
  return pcapWriter;
}

// Common Meshtastic portnums for reference
export const PORTNUMS = {
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
