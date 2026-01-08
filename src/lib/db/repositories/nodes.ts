/**
 * Node Repository
 *
 * Database operations for mesh nodes
 */

import type Database from 'better-sqlite3';
import type { DBNode, NodeFilter, PaginationOptions, PaginatedResult } from '../types';
import type { ProcessedNodeInfo } from '@/lib/mqtt-processor';

export class NodeRepository {
  constructor(private db: Database.Database) {}

  /**
   * Upsert a node (insert or update if exists)
   * Handles conflicts on both id and node_num by migrating related data
   * instead of deleting (which would cascade delete positions, telemetry, etc.)
   */
  upsert(node: ProcessedNodeInfo): Database.RunResult {
    // Check if a node with this node_num already exists with a different id
    // This can happen when different sources (MQTT vs Serial) format node IDs differently
    const existingByNodeNum = this.db.prepare(
      'SELECT id FROM nodes WHERE node_num = ? AND id != ?'
    ).get(node.nodeNum, node.id) as { id: string } | undefined;

    if (existingByNodeNum) {
      const oldId = existingByNodeNum.id;
      // Migrate all related records to use the new node_id instead of deleting
      // This preserves positions, telemetry, messages, etc.
      this.db.prepare('UPDATE positions SET node_id = ? WHERE node_id = ?').run(node.id, oldId);
      this.db.prepare('UPDATE telemetry SET node_id = ? WHERE node_id = ?').run(node.id, oldId);
      this.db.prepare('UPDATE neighbors SET node_id = ? WHERE node_id = ?').run(node.id, oldId);
      this.db.prepare('UPDATE neighbors SET neighbor_id = ? WHERE neighbor_id = ?').run(node.id, oldId);
      this.db.prepare('UPDATE messages SET from_id = ? WHERE from_id = ?').run(node.id, oldId);
      this.db.prepare('UPDATE messages SET to_id = ? WHERE to_id = ?').run(node.id, oldId);
      this.db.prepare('UPDATE favorites SET node_id = ? WHERE node_id = ?').run(node.id, oldId);
      this.db.prepare('UPDATE traceroutes SET from_id = ? WHERE from_id = ?').run(node.id, oldId);
      this.db.prepare('UPDATE traceroutes SET to_id = ? WHERE to_id = ?').run(node.id, oldId);
      // Now safe to delete the old node record (related data already migrated)
      this.db.prepare('DELETE FROM nodes WHERE id = ?').run(oldId);
    }

    // Check if a node with this id already exists with a different node_num
    // This would be unusual but handle it by updating the node_num
    const existingById = this.db.prepare(
      'SELECT node_num FROM nodes WHERE id = ? AND node_num != ?'
    ).get(node.id, node.nodeNum) as { node_num: number } | undefined;

    if (existingById) {
      // Update the existing record's node_num rather than deleting
      this.db.prepare('UPDATE nodes SET node_num = ? WHERE id = ?').run(node.nodeNum, node.id);
    }

    // Now we can safely upsert
    const stmt = this.db.prepare(`
      INSERT INTO nodes (
        id, node_num, short_name, long_name, hw_model, role,
        last_heard, snr, rssi, hops_away, created_at, updated_at
      )
      VALUES (
        @id, @nodeNum, @shortName, @longName, @hwModel, @role,
        @lastHeard, @snr, @rssi, @hopsAway, @now, @now
      )
      ON CONFLICT(id) DO UPDATE SET
        node_num = @nodeNum,
        short_name = @shortName,
        long_name = @longName,
        hw_model = @hwModel,
        role = @role,
        last_heard = @lastHeard,
        snr = @snr,
        rssi = @rssi,
        hops_away = @hopsAway,
        updated_at = @now
    `);

    return stmt.run({
      id: node.id,
      nodeNum: node.nodeNum,
      shortName: node.shortName,
      longName: node.longName,
      hwModel: node.hwModel,
      role: node.role,
      lastHeard: node.lastHeard,
      snr: node.snr ?? null,
      rssi: node.rssi ?? null,
      hopsAway: node.hopsAway ?? null,
      now: Date.now()
    });
  }

  /**
   * Update node battery and voltage from telemetry
   */
  updateTelemetryInfo(nodeId: string, batteryLevel?: number, voltage?: number): Database.RunResult {
    const stmt = this.db.prepare(`
      UPDATE nodes
      SET battery_level = ?, voltage = ?, updated_at = ?
      WHERE id = ?
    `);

    return stmt.run(batteryLevel ?? null, voltage ?? null, Date.now(), nodeId);
  }

  /**
   * Get a single node by ID
   */
  getById(id: string): DBNode | null {
    const stmt = this.db.prepare('SELECT * FROM nodes WHERE id = ?');
    const result = stmt.get(id) as DBNode | undefined;
    return result ?? null;
  }

  /**
   * Get a single node by node number
   */
  getByNodeNum(nodeNum: number): DBNode | null {
    const stmt = this.db.prepare('SELECT * FROM nodes WHERE node_num = ?');
    const result = stmt.get(nodeNum) as DBNode | undefined;
    return result ?? null;
  }

  /**
   * Get all nodes with optional filtering
   */
  getAll(filter: NodeFilter = {}): DBNode[] {
    let query = 'SELECT * FROM nodes WHERE 1=1';
    const params: any[] = [];

    if (filter.activeWithin) {
      const cutoff = Date.now() - filter.activeWithin;
      query += ' AND last_heard > ?';
      params.push(cutoff);
    }

    if (filter.minBatteryLevel !== undefined) {
      query += ' AND battery_level >= ?';
      params.push(filter.minBatteryLevel);
    }

    if (filter.hasPosition) {
      query += ` AND id IN (
        SELECT DISTINCT node_id FROM positions
      )`;
    }

    query += ' ORDER BY last_heard DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as DBNode[];
  }

  /**
   * Get paginated nodes
   */
  getPaginated(
    filter: NodeFilter = {},
    pagination: PaginationOptions = {}
  ): PaginatedResult<DBNode> {
    const limit = pagination.limit || 100;
    const offset = pagination.offset || 0;

    // Build WHERE clause
    let whereClause = '1=1';
    const params: any[] = [];

    if (filter.activeWithin) {
      const cutoff = Date.now() - filter.activeWithin;
      whereClause += ' AND last_heard > ?';
      params.push(cutoff);
    }

    if (filter.minBatteryLevel !== undefined) {
      whereClause += ' AND battery_level >= ?';
      params.push(filter.minBatteryLevel);
    }

    if (filter.hasPosition) {
      whereClause += ` AND id IN (SELECT DISTINCT node_id FROM positions)`;
    }

    // Get total count
    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM nodes WHERE ${whereClause}`);
    const { count: total } = countStmt.get(...params) as { count: number };

    // Get paginated data
    const dataStmt = this.db.prepare(`
      SELECT * FROM nodes
      WHERE ${whereClause}
      ORDER BY last_heard DESC
      LIMIT ? OFFSET ?
    `);
    const data = dataStmt.all(...params, limit, offset) as DBNode[];

    return {
      data,
      total,
      limit,
      offset,
      hasMore: offset + data.length < total
    };
  }

  /**
   * Get count of all nodes
   */
  getCount(filter: NodeFilter = {}): number {
    let query = 'SELECT COUNT(*) as count FROM nodes WHERE 1=1';
    const params: any[] = [];

    if (filter.activeWithin) {
      const cutoff = Date.now() - filter.activeWithin;
      query += ' AND last_heard > ?';
      params.push(cutoff);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  }

  /**
   * Delete a node and all related data (cascade)
   */
  delete(id: string): Database.RunResult {
    const stmt = this.db.prepare('DELETE FROM nodes WHERE id = ?');
    return stmt.run(id);
  }

  /**
   * Delete nodes that haven't been heard from in X milliseconds
   */
  deleteInactive(inactiveMs: number): Database.RunResult {
    const cutoff = Date.now() - inactiveMs;
    const stmt = this.db.prepare('DELETE FROM nodes WHERE last_heard < ?');
    return stmt.run(cutoff);
  }

  /**
   * Get nodes with low battery
   */
  getLowBattery(threshold: number = 20): DBNode[] {
    const stmt = this.db.prepare(`
      SELECT * FROM nodes
      WHERE battery_level IS NOT NULL AND battery_level < ?
      ORDER BY battery_level ASC
    `);
    return stmt.all(threshold) as DBNode[];
  }

  /**
   * Search nodes by name
   */
  search(query: string): DBNode[] {
    const searchPattern = `%${query}%`;
    const stmt = this.db.prepare(`
      SELECT * FROM nodes
      WHERE short_name LIKE ? OR long_name LIKE ?
      ORDER BY last_heard DESC
      LIMIT 50
    `);
    return stmt.all(searchPattern, searchPattern) as DBNode[];
  }
}
