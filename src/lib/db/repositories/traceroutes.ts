/**
 * Traceroute Repository
 *
 * Database operations for traceroute results
 */

import type Database from 'better-sqlite3';
import type { DBTraceroute } from '../types';
import type { ProcessedTraceroute } from '@/types/extended-packets';

export interface TracerouteFilter {
  fromId?: string;
  toId?: string;
  since?: number;
  until?: number;
  success?: boolean;
}

export interface Traceroute {
  id: number;
  fromId: string;
  toId: string;
  timestamp: number;
  route: number[];
  routeBack?: number[];
  snrTowards?: number[];
  snrBack?: number[];
  hops: number;
  success: boolean;
  latencyMs?: number;
}

export class TracerouteRepository {
  constructor(private db: Database.Database) {}

  /**
   * Insert a new traceroute record
   */
  insert(traceroute: ProcessedTraceroute): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO traceroutes (
        from_id, to_id, timestamp, route, route_back,
        snr_towards, snr_back, hops, success, latency_ms
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      traceroute.fromId,
      traceroute.toId,
      traceroute.timestamp,
      JSON.stringify(traceroute.route),
      traceroute.routeBack ? JSON.stringify(traceroute.routeBack) : null,
      traceroute.snrTowards ? JSON.stringify(traceroute.snrTowards) : null,
      traceroute.snrBack ? JSON.stringify(traceroute.snrBack) : null,
      traceroute.hops,
      traceroute.success ? 1 : 0,
      traceroute.latencyMs || null
    );
  }

  /**
   * Get a traceroute by ID
   */
  getById(id: number): Traceroute | null {
    const stmt = this.db.prepare('SELECT * FROM traceroutes WHERE id = ?');
    const row = stmt.get(id) as DBTraceroute | undefined;
    return row ? this.transform(row) : null;
  }

  /**
   * Get all traceroutes with optional filtering
   */
  getAll(filter: TracerouteFilter = {}, limit: number = 100): Traceroute[] {
    let query = 'SELECT * FROM traceroutes WHERE 1=1';
    const params: any[] = [];

    if (filter.fromId) {
      query += ' AND from_id = ?';
      params.push(filter.fromId);
    }

    if (filter.toId) {
      query += ' AND to_id = ?';
      params.push(filter.toId);
    }

    if (filter.since) {
      query += ' AND timestamp > ?';
      params.push(filter.since);
    }

    if (filter.until) {
      query += ' AND timestamp < ?';
      params.push(filter.until);
    }

    if (filter.success !== undefined) {
      query += ' AND success = ?';
      params.push(filter.success ? 1 : 0);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as DBTraceroute[];
    return rows.map(row => this.transform(row));
  }

  /**
   * Get recent traceroutes
   */
  getRecent(limit: number = 50): Traceroute[] {
    const stmt = this.db.prepare(`
      SELECT * FROM traceroutes
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as DBTraceroute[];
    return rows.map(row => this.transform(row));
  }

  /**
   * Get traceroutes for a specific node (as source or destination)
   */
  getForNode(nodeId: string, limit: number = 50): Traceroute[] {
    const stmt = this.db.prepare(`
      SELECT * FROM traceroutes
      WHERE from_id = ? OR to_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(nodeId, nodeId, limit) as DBTraceroute[];
    return rows.map(row => this.transform(row));
  }

  /**
   * Get traceroutes between two specific nodes
   */
  getBetweenNodes(nodeA: string, nodeB: string, limit: number = 50): Traceroute[] {
    const stmt = this.db.prepare(`
      SELECT * FROM traceroutes
      WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(nodeA, nodeB, nodeB, nodeA, limit) as DBTraceroute[];
    return rows.map(row => this.transform(row));
  }

  /**
   * Get unique routes (paths) seen in the network
   */
  getUniqueRoutes(): { route: number[]; count: number; lastSeen: number }[] {
    const stmt = this.db.prepare(`
      SELECT route, COUNT(*) as count, MAX(timestamp) as last_seen
      FROM traceroutes
      WHERE success = 1
      GROUP BY route
      ORDER BY count DESC
      LIMIT 100
    `);
    const rows = stmt.all() as { route: string; count: number; last_seen: number }[];
    return rows.map(row => ({
      route: JSON.parse(row.route),
      count: row.count,
      lastSeen: row.last_seen,
    }));
  }

  /**
   * Get traceroute statistics
   */
  getStats(since?: number): {
    totalTraceroutes: number;
    successfulTraceroutes: number;
    failedTraceroutes: number;
    avgHops: number;
    uniqueRoutes: number;
  } {
    let query = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
        AVG(CASE WHEN success = 1 THEN hops ELSE NULL END) as avg_hops,
        COUNT(DISTINCT route) as unique_routes
      FROM traceroutes
    `;
    const params: any[] = [];

    if (since) {
      query += ' WHERE timestamp > ?';
      params.push(since);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as {
      total: number;
      successful: number;
      failed: number;
      avg_hops: number | null;
      unique_routes: number;
    };

    return {
      totalTraceroutes: result.total || 0,
      successfulTraceroutes: result.successful || 0,
      failedTraceroutes: result.failed || 0,
      avgHops: result.avg_hops || 0,
      uniqueRoutes: result.unique_routes || 0,
    };
  }

  /**
   * Delete old traceroutes
   */
  deleteOlderThan(timestamp: number): Database.RunResult {
    const stmt = this.db.prepare('DELETE FROM traceroutes WHERE timestamp < ?');
    return stmt.run(timestamp);
  }

  /**
   * Transform DB row to Traceroute object
   */
  private transform(row: DBTraceroute): Traceroute {
    return {
      id: row.id,
      fromId: row.from_id,
      toId: row.to_id,
      timestamp: row.timestamp,
      route: JSON.parse(row.route),
      routeBack: row.route_back ? JSON.parse(row.route_back) : undefined,
      snrTowards: row.snr_towards ? JSON.parse(row.snr_towards) : undefined,
      snrBack: row.snr_back ? JSON.parse(row.snr_back) : undefined,
      hops: row.hops,
      success: row.success === 1,
      latencyMs: row.latency_ms ?? undefined,
    };
  }
}
