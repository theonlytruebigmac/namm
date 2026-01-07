/**
 * Favorites Repository
 *
 * Database operations for favorite nodes
 */

import type Database from 'better-sqlite3';

export interface DBFavorite {
  node_id: string;
  created_at: number;
}

export class FavoriteRepository {
  constructor(private db: Database.Database) {}

  /**
   * Add a node to favorites
   */
  add(nodeId: string): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO favorites (node_id, created_at)
      VALUES (?, ?)
      ON CONFLICT(node_id) DO NOTHING
    `);

    return stmt.run(nodeId, Date.now());
  }

  /**
   * Remove a node from favorites
   */
  remove(nodeId: string): Database.RunResult {
    const stmt = this.db.prepare('DELETE FROM favorites WHERE node_id = ?');
    return stmt.run(nodeId);
  }

  /**
   * Toggle favorite status
   */
  toggle(nodeId: string): { isFavorite: boolean } {
    const existing = this.isFavorite(nodeId);

    if (existing) {
      this.remove(nodeId);
      return { isFavorite: false };
    } else {
      this.add(nodeId);
      return { isFavorite: true };
    }
  }

  /**
   * Check if a node is a favorite
   */
  isFavorite(nodeId: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM favorites WHERE node_id = ? LIMIT 1');
    return !!stmt.get(nodeId);
  }

  /**
   * Get all favorite node IDs
   */
  getAll(): string[] {
    const stmt = this.db.prepare('SELECT node_id FROM favorites ORDER BY created_at DESC');
    const results = stmt.all() as DBFavorite[];
    return results.map(r => r.node_id);
  }

  /**
   * Get all favorites as a Set for quick lookup
   */
  getSet(): Set<string> {
    return new Set(this.getAll());
  }

  /**
   * Get favorite count
   */
  getCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM favorites');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Clear all favorites
   */
  clear(): Database.RunResult {
    const stmt = this.db.prepare('DELETE FROM favorites');
    return stmt.run();
  }
}
