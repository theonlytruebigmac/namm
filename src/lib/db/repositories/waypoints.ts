/**
 * Waypoints Repository
 *
 * Database operations for waypoints (map pins/markers)
 */

import type Database from 'better-sqlite3';

export interface Waypoint {
  id: number;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  icon: number | null;
  expire: number | null;
  lockedTo: number | null;
  fromId: string;
  timestamp: number;
}

export interface ProcessedWaypoint {
  id: number;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  icon?: number;
  expire?: number;
  lockedTo?: number;
  fromId: string;
  timestamp: number;
}

interface DBWaypoint {
  id: number;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  icon: number | null;
  expire: number | null;
  locked_to: number | null;
  from_id: string;
  timestamp: number;
}

export class WaypointRepository {
  constructor(private db: Database.Database) {}

  /**
   * Insert or update a waypoint
   */
  upsert(waypoint: ProcessedWaypoint): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO waypoints (id, name, description, latitude, longitude, icon, expire, locked_to, from_id, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        icon = excluded.icon,
        expire = excluded.expire,
        locked_to = excluded.locked_to,
        from_id = excluded.from_id,
        timestamp = excluded.timestamp
    `);

    return stmt.run(
      waypoint.id,
      waypoint.name,
      waypoint.description || null,
      waypoint.latitude,
      waypoint.longitude,
      waypoint.icon || null,
      waypoint.expire || null,
      waypoint.lockedTo || null,
      waypoint.fromId,
      waypoint.timestamp
    );
  }

  /**
   * Get a waypoint by ID
   */
  getById(id: number): Waypoint | null {
    const stmt = this.db.prepare('SELECT * FROM waypoints WHERE id = ?');
    const row = stmt.get(id) as DBWaypoint | undefined;
    return row ? this.transform(row) : null;
  }

  /**
   * Get all waypoints
   */
  getAll(limit: number = 100): Waypoint[] {
    const stmt = this.db.prepare('SELECT * FROM waypoints ORDER BY timestamp DESC LIMIT ?');
    const rows = stmt.all(limit) as DBWaypoint[];
    return rows.map(row => this.transform(row));
  }

  /**
   * Get active waypoints (not expired)
   */
  getActive(): Waypoint[] {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare('SELECT * FROM waypoints WHERE expire IS NULL OR expire > ? ORDER BY timestamp DESC');
    const rows = stmt.all(now) as DBWaypoint[];
    return rows.map(row => this.transform(row));
  }

  /**
   * Get waypoints from a specific node
   */
  getByNode(nodeId: string): Waypoint[] {
    const stmt = this.db.prepare('SELECT * FROM waypoints WHERE from_id = ? ORDER BY timestamp DESC');
    const rows = stmt.all(nodeId) as DBWaypoint[];
    return rows.map(row => this.transform(row));
  }

  /**
   * Delete a waypoint
   */
  delete(id: number): Database.RunResult {
    return this.db.prepare('DELETE FROM waypoints WHERE id = ?').run(id);
  }

  /**
   * Delete expired waypoints
   */
  deleteExpired(): Database.RunResult {
    const now = Math.floor(Date.now() / 1000);
    return this.db.prepare('DELETE FROM waypoints WHERE expire IS NOT NULL AND expire < ?').run(now);
  }

  private transform(row: DBWaypoint): Waypoint {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      latitude: row.latitude,
      longitude: row.longitude,
      icon: row.icon,
      expire: row.expire,
      lockedTo: row.locked_to,
      fromId: row.from_id,
      timestamp: row.timestamp,
    };
  }
}
