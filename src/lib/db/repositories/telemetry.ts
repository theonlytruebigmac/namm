/**
 * Telemetry Repository
 *
 * Database operations for node telemetry (time-series data)
 */

import type Database from 'better-sqlite3';
import type { DBTelemetry, TelemetryFilter, PaginationOptions, PaginatedResult } from '../types';
import type { ProcessedTelemetry } from '@/lib/mqtt-processor';

export class TelemetryRepository {
  constructor(private db: Database.Database) {}

  /**
   * Insert a new telemetry record
   */
  insert(telemetry: ProcessedTelemetry): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO telemetry (
        node_id, node_num, timestamp, battery_level, voltage,
        channel_utilization, air_util_tx, uptime, temperature, snr, rssi
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      telemetry.nodeId,
      telemetry.nodeNum,
      telemetry.timestamp,
      telemetry.batteryLevel ?? null,
      telemetry.voltage ?? null,
      telemetry.channelUtilization ?? null,
      telemetry.airUtilTx ?? null,
      telemetry.uptime ?? null,
      telemetry.temperature ?? null,
      telemetry.snr ?? null,
      telemetry.rssi ?? null
    );
  }

  /**
   * Batch insert telemetry records
   */
  insertMany(telemetryRecords: ProcessedTelemetry[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO telemetry (
        node_id, node_num, timestamp, battery_level, voltage,
        channel_utilization, air_util_tx, uptime, temperature, snr, rssi
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((records: ProcessedTelemetry[]) => {
      for (const telemetry of records) {
        stmt.run(
          telemetry.nodeId,
          telemetry.nodeNum,
          telemetry.timestamp,
          telemetry.batteryLevel ?? null,
          telemetry.voltage ?? null,
          telemetry.channelUtilization ?? null,
          telemetry.airUtilTx ?? null,
          telemetry.uptime ?? null,
          telemetry.temperature ?? null,
          telemetry.snr ?? null,
          telemetry.rssi ?? null
        );
      }
    });

    insertMany(telemetryRecords);
  }

  /**
   * Get latest telemetry for a node
   */
  getLatestForNode(nodeId: string): DBTelemetry | null {
    const stmt = this.db.prepare(`
      SELECT * FROM telemetry
      WHERE node_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    return stmt.get(nodeId) as DBTelemetry | null;
  }

  /**
   * Get all telemetry for a node
   */
  getAllForNode(nodeId: string, limit: number = 100): DBTelemetry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM telemetry
      WHERE node_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(nodeId, limit) as DBTelemetry[];
  }

  /**
   * Get telemetry with filtering
   */
  getAll(filter: TelemetryFilter = {}): DBTelemetry[] {
    let query = 'SELECT * FROM telemetry WHERE 1=1';
    const params: any[] = [];

    if (filter.nodeId) {
      query += ' AND node_id = ?';
      params.push(filter.nodeId);
    }

    if (filter.since) {
      query += ' AND timestamp > ?';
      params.push(filter.since);
    }

    query += ' ORDER BY timestamp DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as DBTelemetry[];
  }

  /**
   * Get paginated telemetry
   */
  getPaginated(
    filter: TelemetryFilter = {},
    pagination: PaginationOptions = {}
  ): PaginatedResult<DBTelemetry> {
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

    // Get total count
    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM telemetry WHERE ${whereClause}`);
    const { count: total } = countStmt.get(...params) as { count: number };

    // Get paginated data
    const dataStmt = this.db.prepare(`
      SELECT * FROM telemetry
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);
    const data = dataStmt.all(...params, limit, offset) as DBTelemetry[];

    return {
      data,
      total,
      limit,
      offset,
      hasMore: offset + data.length < total
    };
  }

  /**
   * Get telemetry within a time range
   */
  getByTimeRange(startTime: number, endTime: number, nodeId?: string): DBTelemetry[] {
    let query = `
      SELECT * FROM telemetry
      WHERE timestamp BETWEEN ? AND ?
    `;
    const params: any[] = [startTime, endTime];

    if (nodeId) {
      query += ' AND node_id = ?';
      params.push(nodeId);
    }

    query += ' ORDER BY timestamp DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as DBTelemetry[];
  }

  /**
   * Get average telemetry values for a node over a time period
   */
  getAverageForNode(nodeId: string, since: number): {
    avgBatteryLevel: number | null;
    avgVoltage: number | null;
    avgChannelUtilization: number | null;
    avgAirUtilTx: number | null;
    avgTemperature: number | null;
    count: number;
  } {
    const stmt = this.db.prepare(`
      SELECT
        AVG(battery_level) as avgBatteryLevel,
        AVG(voltage) as avgVoltage,
        AVG(channel_utilization) as avgChannelUtilization,
        AVG(air_util_tx) as avgAirUtilTx,
        AVG(temperature) as avgTemperature,
        COUNT(*) as count
      FROM telemetry
      WHERE node_id = ? AND timestamp > ?
    `);
    return stmt.get(nodeId, since) as any;
  }

  /**
   * Get latest telemetry for all nodes
   */
  getLatestForAllNodes(): DBTelemetry[] {
    const stmt = this.db.prepare(`
      SELECT t1.*
      FROM telemetry t1
      INNER JOIN (
        SELECT node_id, MAX(timestamp) as max_timestamp
        FROM telemetry
        GROUP BY node_id
      ) t2 ON t1.node_id = t2.node_id AND t1.timestamp = t2.max_timestamp
      ORDER BY t1.timestamp DESC
    `);
    return stmt.all() as DBTelemetry[];
  }

  /**
   * Delete old telemetry for a node, keeping only the N most recent
   */
  pruneOldForNode(nodeId: string, keepCount: number = 1000): Database.RunResult {
    const stmt = this.db.prepare(`
      DELETE FROM telemetry
      WHERE node_id = ?
        AND id NOT IN (
          SELECT id FROM telemetry
          WHERE node_id = ?
          ORDER BY timestamp DESC
          LIMIT ?
        )
    `);
    return stmt.run(nodeId, nodeId, keepCount);
  }

  /**
   * Get count of telemetry records
   */
  getCount(filter: TelemetryFilter = {}): number {
    let query = 'SELECT COUNT(*) as count FROM telemetry WHERE 1=1';
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

  /**
   * Get telemetry statistics for a time period
   */
  getStats(since: number): {
    totalRecords: number;
    uniqueNodes: number;
    avgBatteryLevel: number | null;
    minBatteryLevel: number | null;
    maxBatteryLevel: number | null;
  } {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as totalRecords,
        COUNT(DISTINCT node_id) as uniqueNodes,
        AVG(battery_level) as avgBatteryLevel,
        MIN(battery_level) as minBatteryLevel,
        MAX(battery_level) as maxBatteryLevel
      FROM telemetry
      WHERE timestamp > ?
    `);
    return stmt.get(since) as any;
  }
}
