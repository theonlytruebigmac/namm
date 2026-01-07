/**
 * Routing Repository
 *
 * Database operations for routing/ACK information
 */

import type Database from 'better-sqlite3';

// Meshtastic Routing error reasons
export enum RoutingError {
  NONE = 0,
  NO_ROUTE = 1,
  GOT_NAK = 2,
  TIMEOUT = 3,
  NO_INTERFACE = 4,
  MAX_RETRANSMIT = 5,
  NO_CHANNEL = 6,
  TOO_LARGE = 7,
  NO_RESPONSE = 8,
  DUTY_CYCLE_LIMIT = 9,
  BAD_REQUEST = 32,
  NOT_AUTHORIZED = 33,
}

export interface RoutingEntry {
  id: number;
  fromId: string;
  toId: string;
  packetId: number;
  errorReason: number;
  timestamp: number;
}

export interface ProcessedRouting {
  fromId: string;
  toId: string;
  packetId: number;
  errorReason: number;
  timestamp?: number;
}

interface DBRouting {
  id: number;
  from_id: string;
  to_id: string;
  packet_id: number;
  error_reason: number;
  timestamp: number;
}

export class RoutingRepository {
  constructor(private db: Database.Database) {}

  /**
   * Insert a routing entry (ACK/NAK)
   */
  insert(routing: ProcessedRouting): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO routing (from_id, to_id, packet_id, error_reason, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    return stmt.run(
      routing.fromId,
      routing.toId,
      routing.packetId,
      routing.errorReason,
      routing.timestamp || Math.floor(Date.now() / 1000)
    );
  }

  /**
   * Get routing entries for a specific packet
   */
  getByPacketId(packetId: number): RoutingEntry[] {
    const stmt = this.db.prepare('SELECT * FROM routing WHERE packet_id = ? ORDER BY timestamp DESC');
    const rows = stmt.all(packetId) as DBRouting[];
    return rows.map(row => this.transform(row));
  }

  /**
   * Get recent routing entries from a node
   */
  getByNode(nodeId: string, limit: number = 50): RoutingEntry[] {
    const stmt = this.db.prepare('SELECT * FROM routing WHERE from_id = ? ORDER BY timestamp DESC LIMIT ?');
    const rows = stmt.all(nodeId, limit) as DBRouting[];
    return rows.map(row => this.transform(row));
  }

  /**
   * Get routing entries to a specific node
   */
  getToNode(nodeId: string, limit: number = 50): RoutingEntry[] {
    const stmt = this.db.prepare('SELECT * FROM routing WHERE to_id = ? ORDER BY timestamp DESC LIMIT ?');
    const rows = stmt.all(nodeId, limit) as DBRouting[];
    return rows.map(row => this.transform(row));
  }

  /**
   * Get recent failures
   */
  getFailures(limit: number = 50): RoutingEntry[] {
    const stmt = this.db.prepare('SELECT * FROM routing WHERE error_reason > 0 ORDER BY timestamp DESC LIMIT ?');
    const rows = stmt.all(limit) as DBRouting[];
    return rows.map(row => this.transform(row));
  }

  /**
   * Get delivery stats for a node (success/failure counts)
   */
  getNodeStats(nodeId: string): { sent: number; received: number; failed: number } {
    const sentStmt = this.db.prepare('SELECT COUNT(*) as count FROM routing WHERE from_id = ? AND error_reason = 0');
    const receivedStmt = this.db.prepare('SELECT COUNT(*) as count FROM routing WHERE to_id = ? AND error_reason = 0');
    const failedStmt = this.db.prepare('SELECT COUNT(*) as count FROM routing WHERE from_id = ? AND error_reason > 0');

    const sent = (sentStmt.get(nodeId) as { count: number })?.count || 0;
    const received = (receivedStmt.get(nodeId) as { count: number })?.count || 0;
    const failed = (failedStmt.get(nodeId) as { count: number })?.count || 0;

    return { sent, received, failed };
  }

  /**
   * Get overall network reliability stats
   */
  getNetworkStats(): { total: number; successful: number; failed: number; successRate: number } {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM routing');
    const successStmt = this.db.prepare('SELECT COUNT(*) as count FROM routing WHERE error_reason = 0');
    const failedStmt = this.db.prepare('SELECT COUNT(*) as count FROM routing WHERE error_reason > 0');

    const total = (totalStmt.get() as { count: number })?.count || 0;
    const successful = (successStmt.get() as { count: number })?.count || 0;
    const failed = (failedStmt.get() as { count: number })?.count || 0;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    return { total, successful, failed, successRate };
  }

  /**
   * Get all routing entries
   */
  getAll(limit: number = 100): RoutingEntry[] {
    const stmt = this.db.prepare('SELECT * FROM routing ORDER BY timestamp DESC LIMIT ?');
    const rows = stmt.all(limit) as DBRouting[];
    return rows.map(row => this.transform(row));
  }

  /**
   * Delete old routing entries
   */
  deleteOld(daysOld: number = 7): Database.RunResult {
    const cutoff = Math.floor(Date.now() / 1000) - (daysOld * 86400);
    return this.db.prepare('DELETE FROM routing WHERE timestamp < ?').run(cutoff);
  }

  /**
   * Get human-readable error reason
   */
  static getErrorName(errorCode: number): string {
    const names: Record<number, string> = {
      [RoutingError.NONE]: 'Success',
      [RoutingError.NO_ROUTE]: 'No Route',
      [RoutingError.GOT_NAK]: 'Got NAK',
      [RoutingError.TIMEOUT]: 'Timeout',
      [RoutingError.NO_INTERFACE]: 'No Interface',
      [RoutingError.MAX_RETRANSMIT]: 'Max Retransmit',
      [RoutingError.NO_CHANNEL]: 'No Channel',
      [RoutingError.TOO_LARGE]: 'Too Large',
      [RoutingError.NO_RESPONSE]: 'No Response',
      [RoutingError.DUTY_CYCLE_LIMIT]: 'Duty Cycle Limit',
      [RoutingError.BAD_REQUEST]: 'Bad Request',
      [RoutingError.NOT_AUTHORIZED]: 'Not Authorized',
    };
    return names[errorCode] || `Unknown (${errorCode})`;
  }

  private transform(row: DBRouting): RoutingEntry {
    return {
      id: row.id,
      fromId: row.from_id,
      toId: row.to_id,
      packetId: row.packet_id,
      errorReason: row.error_reason,
      timestamp: row.timestamp,
    };
  }
}
