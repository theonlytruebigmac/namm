/**
 * Neighbors Repository
 *
 * Database operations for neighbor info (mesh network topology)
 */

import type Database from 'better-sqlite3';

export interface Neighbor {
  id: number;
  nodeId: string;
  neighborId: string;
  snr: number;
  timestamp: number;
}

export interface ProcessedNeighbor {
  nodeId: string;
  neighborId: string;
  snr: number;
  timestamp?: number;
}

interface DBNeighbor {
  id: number;
  node_id: string;
  neighbor_id: string;
  snr: number;
  timestamp: number;
}

export class NeighborRepository {
  constructor(private db: Database.Database) {}

  /**
   * Insert or update a neighbor relationship
   */
  upsert(neighbor: ProcessedNeighbor): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO neighbors (node_id, neighbor_id, snr, timestamp)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(node_id, neighbor_id) DO UPDATE SET
        snr = excluded.snr,
        timestamp = excluded.timestamp
    `);

    return stmt.run(
      neighbor.nodeId,
      neighbor.neighborId,
      neighbor.snr,
      neighbor.timestamp || Math.floor(Date.now() / 1000)
    );
  }

  /**
   * Batch upsert multiple neighbors from a NeighborInfo packet
   */
  upsertMany(nodeId: string, neighbors: Array<{ neighborId: string; snr: number }>, timestamp?: number): void {
    const ts = timestamp || Math.floor(Date.now() / 1000);

    const upsert = this.db.prepare(`
      INSERT INTO neighbors (node_id, neighbor_id, snr, timestamp)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(node_id, neighbor_id) DO UPDATE SET
        snr = excluded.snr,
        timestamp = excluded.timestamp
    `);

    const transaction = this.db.transaction((items: Array<{ neighborId: string; snr: number }>) => {
      for (const item of items) {
        upsert.run(nodeId, item.neighborId, item.snr, ts);
      }
    });

    transaction(neighbors);
  }

  /**
   * Get all neighbors for a node
   */
  getByNode(nodeId: string): Neighbor[] {
    const stmt = this.db.prepare('SELECT * FROM neighbors WHERE node_id = ? ORDER BY snr DESC');
    const rows = stmt.all(nodeId) as DBNeighbor[];
    return rows.map(row => this.transform(row));
  }

  /**
   * Get nodes that have this node as a neighbor
   */
  getNodesWithNeighbor(neighborId: string): Neighbor[] {
    const stmt = this.db.prepare('SELECT * FROM neighbors WHERE neighbor_id = ? ORDER BY snr DESC');
    const rows = stmt.all(neighborId) as DBNeighbor[];
    return rows.map(row => this.transform(row));
  }

  /**
   * Get all neighbor relationships
   */
  getAll(): Neighbor[] {
    const stmt = this.db.prepare('SELECT * FROM neighbors ORDER BY timestamp DESC');
    const rows = stmt.all() as DBNeighbor[];
    return rows.map(row => this.transform(row));
  }

  /**
   * Get the full mesh topology as adjacency list
   */
  getTopology(): Map<string, Neighbor[]> {
    const all = this.getAll();
    const topology = new Map<string, Neighbor[]>();

    for (const neighbor of all) {
      if (!topology.has(neighbor.nodeId)) {
        topology.set(neighbor.nodeId, []);
      }
      topology.get(neighbor.nodeId)!.push(neighbor);
    }

    return topology;
  }

  /**
   * Delete all neighbors for a node
   */
  deleteByNode(nodeId: string): Database.RunResult {
    return this.db.prepare('DELETE FROM neighbors WHERE node_id = ?').run(nodeId);
  }

  /**
   * Delete stale neighbor entries (older than X hours)
   */
  deleteStale(hoursOld: number = 24): Database.RunResult {
    const cutoff = Math.floor(Date.now() / 1000) - (hoursOld * 3600);
    return this.db.prepare('DELETE FROM neighbors WHERE timestamp < ?').run(cutoff);
  }

  private transform(row: DBNeighbor): Neighbor {
    return {
      id: row.id,
      nodeId: row.node_id,
      neighborId: row.neighbor_id,
      snr: row.snr,
      timestamp: row.timestamp,
    };
  }
}
