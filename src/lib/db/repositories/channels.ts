/**
 * Channel Repository
 *
 * Database operations for channel name -> index mappings
 * Learned from MQTT messages and serial device config
 */

import type Database from 'better-sqlite3';

export interface DBChannel {
  id: number;       // channel index
  name: string;
  role: number;     // 0=disabled, 1=primary, 2=secondary
  has_key: number;  // 0 or 1
  last_seen: number;
}

export class ChannelRepository {
  constructor(private db: Database.Database) {}

  /**
   * Upsert a channel (insert or update)
   */
  upsert(index: number, name: string, role: number = 2, hasKey: boolean = false): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO channels (id, name, role, has_key, last_seen)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        role = CASE WHEN excluded.role > 0 THEN excluded.role ELSE channels.role END,
        has_key = CASE WHEN excluded.has_key > 0 THEN excluded.has_key ELSE channels.has_key END,
        last_seen = excluded.last_seen
    `);

    return stmt.run(index, name, role, hasKey ? 1 : 0, Date.now());
  }

  /**
   * Get all channels
   */
  getAll(): DBChannel[] {
    const stmt = this.db.prepare(`
      SELECT id, name, role, has_key, last_seen
      FROM channels
      ORDER BY id
    `);

    return stmt.all() as DBChannel[];
  }

  /**
   * Get channel by index
   */
  getByIndex(index: number): DBChannel | null {
    const stmt = this.db.prepare(`
      SELECT id, name, role, has_key, last_seen
      FROM channels
      WHERE id = ?
    `);

    return (stmt.get(index) as DBChannel) || null;
  }

  /**
   * Get channel name by index
   */
  getName(index: number): string | null {
    const channel = this.getByIndex(index);
    return channel?.name || null;
  }

  /**
   * Delete a channel
   */
  delete(index: number): Database.RunResult {
    const stmt = this.db.prepare('DELETE FROM channels WHERE id = ?');
    return stmt.run(index);
  }
}
