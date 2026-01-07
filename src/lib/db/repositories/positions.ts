/**
 * Position Repository
 *
 * Database operations for node positions (time-series data)
 */

import type Database from 'better-sqlite3';
import type { DBPosition, PositionFilter, PaginationOptions, PaginatedResult } from '../types';
import type { ProcessedPosition } from '@/lib/mqtt-processor';

export class PositionRepository {
  constructor(private db: Database.Database) {}

  /**
   * Insert a new position
   */
  insert(position: ProcessedPosition): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO positions (
        node_id, node_num, latitude, longitude, altitude,
        timestamp, snr, rssi
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      position.nodeId,
      position.nodeNum,
      position.position.latitude,
      position.position.longitude,
      position.position.altitude ?? null,
      position.timestamp,
      position.snr ?? null,
      position.rssi ?? null
    );
  }

  /**
   * Batch insert positions
   */
  insertMany(positions: ProcessedPosition[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO positions (
        node_id, node_num, latitude, longitude, altitude,
        timestamp, snr, rssi
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((positions: ProcessedPosition[]) => {
      for (const position of positions) {
        stmt.run(
          position.nodeId,
          position.nodeNum,
          position.position.latitude,
          position.position.longitude,
          position.position.altitude ?? null,
          position.timestamp,
          position.snr ?? null,
          position.rssi ?? null
        );
      }
    });

    insertMany(positions);
  }

  /**
   * Get latest position for a node
   */
  getLatestForNode(nodeId: string): DBPosition | null {
    const stmt = this.db.prepare(`
      SELECT * FROM positions
      WHERE node_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    return stmt.get(nodeId) as DBPosition | null;
  }

  /**
   * Get all positions for a node
   */
  getAllForNode(nodeId: string, limit: number = 100): DBPosition[] {
    const stmt = this.db.prepare(`
      SELECT * FROM positions
      WHERE node_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(nodeId, limit) as DBPosition[];
  }

  /**
   * Get positions with filtering
   */
  getAll(filter: PositionFilter = {}): DBPosition[] {
    let query = 'SELECT * FROM positions WHERE 1=1';
    const params: any[] = [];

    if (filter.nodeId) {
      query += ' AND node_id = ?';
      params.push(filter.nodeId);
    }

    if (filter.since) {
      query += ' AND timestamp > ?';
      params.push(filter.since);
    }

    if (filter.bounds) {
      query += ' AND latitude BETWEEN ? AND ?';
      query += ' AND longitude BETWEEN ? AND ?';
      params.push(
        filter.bounds.south,
        filter.bounds.north,
        filter.bounds.west,
        filter.bounds.east
      );
    }

    query += ' ORDER BY timestamp DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as DBPosition[];
  }

  /**
   * Get paginated positions
   */
  getPaginated(
    filter: PositionFilter = {},
    pagination: PaginationOptions = {}
  ): PaginatedResult<DBPosition> {
    const limit = pagination.limit || 100;
    const offset = pagination.offset || 0;

    // Build WHERE clause
    let whereClause = '1=1';
    const params: any[] = [];

    if (filter.nodeId) {
      whereClause += ' AND node_id = ?';
      params.push(filter.nodeId);
    }

    if (filter.since) {
      whereClause += ' AND timestamp > ?';
      params.push(filter.since);
    }

    if (filter.bounds) {
      whereClause += ' AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?';
      params.push(
        filter.bounds.south,
        filter.bounds.north,
        filter.bounds.west,
        filter.bounds.east
      );
    }

    // Get total count
    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM positions WHERE ${whereClause}`);
    const { count: total } = countStmt.get(...params) as { count: number };

    // Get paginated data
    const dataStmt = this.db.prepare(`
      SELECT * FROM positions
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);
    const data = dataStmt.all(...params, limit, offset) as DBPosition[];

    return {
      data,
      total,
      limit,
      offset,
      hasMore: offset + data.length < total
    };
  }

  /**
   * Get latest positions for all nodes (one per node)
   */
  getLatestForAllNodes(): DBPosition[] {
    const stmt = this.db.prepare(`
      SELECT p1.*
      FROM positions p1
      INNER JOIN (
        SELECT node_id, MAX(timestamp) as max_timestamp
        FROM positions
        GROUP BY node_id
      ) p2 ON p1.node_id = p2.node_id AND p1.timestamp = p2.max_timestamp
      ORDER BY p1.timestamp DESC
    `);
    return stmt.all() as DBPosition[];
  }

  /**
   * Get positions within a time range
   */
  getByTimeRange(startTime: number, endTime: number): DBPosition[] {
    const stmt = this.db.prepare(`
      SELECT * FROM positions
      WHERE timestamp BETWEEN ? AND ?
      ORDER BY timestamp DESC
    `);
    return stmt.all(startTime, endTime) as DBPosition[];
  }

  /**
   * Get positions within geographic bounds
   */
  getByBounds(bounds: PositionFilter['bounds']): DBPosition[] {
    if (!bounds) return [];

    const stmt = this.db.prepare(`
      SELECT * FROM positions
      WHERE latitude BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
      ORDER BY timestamp DESC
      LIMIT 1000
    `);
    return stmt.all(
      bounds.south,
      bounds.north,
      bounds.west,
      bounds.east
    ) as DBPosition[];
  }

  /**
   * Delete old positions for a node, keeping only the N most recent
   */
  pruneOldForNode(nodeId: string, keepCount: number = 100): Database.RunResult {
    const stmt = this.db.prepare(`
      DELETE FROM positions
      WHERE node_id = ?
        AND id NOT IN (
          SELECT id FROM positions
          WHERE node_id = ?
          ORDER BY timestamp DESC
          LIMIT ?
        )
    `);
    return stmt.run(nodeId, nodeId, keepCount);
  }

  /**
   * Get count of positions
   */
  getCount(filter: PositionFilter = {}): number {
    let query = 'SELECT COUNT(*) as count FROM positions WHERE 1=1';
    const params: any[] = [];

    if (filter.nodeId) {
      query += ' AND node_id = ?';
      params.push(filter.nodeId);
    }

    if (filter.since) {
      query += ' AND timestamp > ?';
      params.push(filter.since);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  }
}
