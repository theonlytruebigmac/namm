/**
 * Database Schema Definitions
 *
 * SQL schema for SQLite database with indexes and constraints
 */

import type Database from 'better-sqlite3';

export const SCHEMA_VERSION = 7;

export function initializeSchema(db: Database.Database): void {
  // Check if already initialized
  const version = getCurrentVersion(db);

  if (version === SCHEMA_VERSION) {
    console.log(`Database schema already at version ${SCHEMA_VERSION}`);
    return;
  }

  if (version === 0) {
    console.log('Initializing database schema...');
    createTables(db);
    createIndexes(db);
    setVersion(db, SCHEMA_VERSION);
    console.log(`Database schema initialized to version ${SCHEMA_VERSION}`);
  } else if (version < SCHEMA_VERSION) {
    console.log(`Migrating database from version ${version} to ${SCHEMA_VERSION}...`);
    // Future migrations would go here
    migrate(db, version, SCHEMA_VERSION);
    console.log('Migration complete');
  }
}

function getCurrentVersion(db: Database.Database): number {
  // Create metadata table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  const row = db.prepare('SELECT value FROM metadata WHERE key = ?').get('schema_version') as { value: string } | undefined;
  return row ? parseInt(row.value, 10) : 0;
}

function setVersion(db: Database.Database, version: number): void {
  db.prepare(`
    INSERT INTO metadata (key, value) VALUES ('schema_version', ?)
    ON CONFLICT(key) DO UPDATE SET value = ?
  `).run(version.toString(), version.toString());
}

function createTables(db: Database.Database): void {
  // Nodes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      node_num INTEGER UNIQUE NOT NULL,
      short_name TEXT NOT NULL DEFAULT '',
      long_name TEXT NOT NULL DEFAULT '',
      hw_model TEXT NOT NULL DEFAULT '',
      role INTEGER NOT NULL DEFAULT 0,
      last_heard INTEGER NOT NULL,
      snr REAL,
      rssi INTEGER,
      hops_away INTEGER,
      battery_level INTEGER,
      voltage REAL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Positions table (time-series)
  db.exec(`
    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT NOT NULL,
      node_num INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      altitude INTEGER,
      precision_bits INTEGER,
      timestamp INTEGER NOT NULL,
      snr REAL,
      rssi INTEGER,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
    )
  `);

  // Telemetry table (time-series)
  db.exec(`
    CREATE TABLE IF NOT EXISTS telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT NOT NULL,
      node_num INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      battery_level INTEGER,
      voltage REAL,
      channel_utilization REAL,
      air_util_tx REAL,
      uptime INTEGER,
      temperature REAL,
      snr REAL,
      rssi INTEGER,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
    )
  `);

  // Messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      channel INTEGER NOT NULL,
      text TEXT,
      timestamp INTEGER NOT NULL,
      snr REAL,
      rssi INTEGER,
      hops_away INTEGER,
      reply_to INTEGER,
      FOREIGN KEY (from_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL
    )
  `);

  // Reactions table - stores emoji reactions on messages
  db.exec(`
    CREATE TABLE IF NOT EXISTS reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      from_node TEXT NOT NULL,
      emoji TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      UNIQUE(message_id, from_node, emoji),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    )
  `);

  // Favorites table - stores favorite nodes
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      node_id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
    )
  `);

  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Channels table - stores learned channel name -> index mappings
  db.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      role INTEGER DEFAULT 2,
      has_key INTEGER DEFAULT 0,
      last_seen INTEGER NOT NULL,
      UNIQUE(id)
    )
  `);

  // Traceroutes table - stores traceroute results
  db.exec(`
    CREATE TABLE IF NOT EXISTS traceroutes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      route TEXT NOT NULL,
      route_back TEXT,
      snr_towards TEXT,
      snr_back TEXT,
      hops INTEGER NOT NULL,
      success INTEGER DEFAULT 1,
      latency_ms INTEGER,
      FOREIGN KEY (from_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (to_id) REFERENCES nodes(id) ON DELETE CASCADE
    )
  `);

  // Waypoints table - stores map waypoints/pins
  db.exec(`
    CREATE TABLE IF NOT EXISTS waypoints (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      description TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      icon INTEGER,
      expire INTEGER,
      locked_to INTEGER,
      from_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (from_id) REFERENCES nodes(id) ON DELETE CASCADE
    )
  `);

  // Neighbors table - stores neighbor relationships between nodes
  db.exec(`
    CREATE TABLE IF NOT EXISTS neighbors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT NOT NULL,
      neighbor_id TEXT NOT NULL,
      snr REAL,
      timestamp INTEGER NOT NULL,
      UNIQUE(node_id, neighbor_id),
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
    )
  `);

  // Routing table - stores delivery confirmations and routing errors
  db.exec(`
    CREATE TABLE IF NOT EXISTS routing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      packet_id INTEGER,
      error_reason INTEGER DEFAULT 0,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (from_id) REFERENCES nodes(id) ON DELETE CASCADE
    )
  `);
}

function createIndexes(db: Database.Database): void {
  // Node indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nodes_last_heard ON nodes(last_heard DESC);
    CREATE INDEX IF NOT EXISTS idx_nodes_updated_at ON nodes(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_nodes_node_num ON nodes(node_num);
  `);

  // Position indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_positions_node_timestamp ON positions(node_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_positions_timestamp ON positions(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_positions_location ON positions(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_positions_node_num ON positions(node_num);
  `);

  // Telemetry indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_telemetry_node_timestamp ON telemetry(node_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_telemetry_node_num ON telemetry(node_num);
  `);

  // Message indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to);
  `);

  // Reaction indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);
  `);

  // Traceroute indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_traceroutes_timestamp ON traceroutes(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_traceroutes_from ON traceroutes(from_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_traceroutes_to ON traceroutes(to_id, timestamp DESC);
  `);

  // Waypoint indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_waypoints_timestamp ON waypoints(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_waypoints_from ON waypoints(from_id);
    CREATE INDEX IF NOT EXISTS idx_waypoints_location ON waypoints(latitude, longitude);
  `);

  // Neighbor indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_neighbors_node ON neighbors(node_id);
    CREATE INDEX IF NOT EXISTS idx_neighbors_neighbor ON neighbors(neighbor_id);
    CREATE INDEX IF NOT EXISTS idx_neighbors_timestamp ON neighbors(timestamp DESC);
  `);

  // Routing indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_routing_timestamp ON routing(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_routing_from ON routing(from_id);
    CREATE INDEX IF NOT EXISTS idx_routing_to ON routing(to_id);
  `);
}

function migrate(db: Database.Database, fromVersion: number, toVersion: number): void {
  // Migration from v1 to v2: add channels table
  if (fromVersion < 2 && toVersion >= 2) {
    console.log('Migration v1 -> v2: Adding channels table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        role INTEGER DEFAULT 2,
        has_key INTEGER DEFAULT 0,
        last_seen INTEGER NOT NULL,
        UNIQUE(id)
      )
    `);
  }

  // Migration from v2 to v3: add reply_to column and reactions table
  if (fromVersion < 3 && toVersion >= 3) {
    console.log('Migration v2 -> v3: Adding reply_to column and reactions table...');

    // Add reply_to column to messages
    db.exec(`
      ALTER TABLE messages ADD COLUMN reply_to INTEGER REFERENCES messages(id) ON DELETE SET NULL
    `);

    // Create reactions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        from_node TEXT NOT NULL,
        emoji TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        UNIQUE(message_id, from_node, emoji),
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      )
    `);

    // Create index for reactions
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);
      CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to);
    `);
  }

  // Migration from v3 to v4: add favorites table
  if (fromVersion < 4 && toVersion >= 4) {
    console.log('Migration v3 -> v4: Adding favorites table...');

    db.exec(`
      CREATE TABLE IF NOT EXISTS favorites (
        node_id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
      )
    `);
  }

  // Migration from v4 to v5: add read_at column for read receipts
  if (fromVersion < 5 && toVersion >= 5) {
    console.log('Migration v4 -> v5: Adding read_at column for read receipts...');

    db.exec(`
      ALTER TABLE messages ADD COLUMN read_at INTEGER DEFAULT NULL
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_read_at ON messages(read_at);
    `);
  }

  // Migration from v5 to v6: add traceroutes table
  if (fromVersion < 6 && toVersion >= 6) {
    console.log('Migration v5 -> v6: Adding traceroutes table...');

    db.exec(`
      CREATE TABLE IF NOT EXISTS traceroutes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        route TEXT NOT NULL,
        route_back TEXT,
        snr_towards TEXT,
        snr_back TEXT,
        hops INTEGER NOT NULL,
        success INTEGER DEFAULT 1,
        latency_ms INTEGER,
        FOREIGN KEY (from_id) REFERENCES nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (to_id) REFERENCES nodes(id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_traceroutes_timestamp ON traceroutes(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_traceroutes_from ON traceroutes(from_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_traceroutes_to ON traceroutes(to_id, timestamp DESC);
    `);
  }

  // Migration from v6 to v7: add waypoints, neighbors, routing tables
  if (fromVersion < 7 && toVersion >= 7) {
    console.log('Migration v6 -> v7: Adding waypoints, neighbors, routing tables...');

    // Waypoints table
    db.exec(`
      CREATE TABLE IF NOT EXISTS waypoints (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        description TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        icon INTEGER,
        expire INTEGER,
        locked_to INTEGER,
        from_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (from_id) REFERENCES nodes(id) ON DELETE CASCADE
      )
    `);

    // Neighbors table
    db.exec(`
      CREATE TABLE IF NOT EXISTS neighbors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        neighbor_id TEXT NOT NULL,
        snr REAL,
        timestamp INTEGER NOT NULL,
        UNIQUE(node_id, neighbor_id),
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
      )
    `);

    // Routing table
    db.exec(`
      CREATE TABLE IF NOT EXISTS routing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        packet_id INTEGER,
        error_reason INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (from_id) REFERENCES nodes(id) ON DELETE CASCADE
      )
    `);

    // Indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_waypoints_timestamp ON waypoints(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_waypoints_from ON waypoints(from_id);
      CREATE INDEX IF NOT EXISTS idx_waypoints_location ON waypoints(latitude, longitude);
      CREATE INDEX IF NOT EXISTS idx_neighbors_node ON neighbors(node_id);
      CREATE INDEX IF NOT EXISTS idx_neighbors_neighbor ON neighbors(neighbor_id);
      CREATE INDEX IF NOT EXISTS idx_neighbors_timestamp ON neighbors(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_routing_timestamp ON routing(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_routing_from ON routing(from_id);
      CREATE INDEX IF NOT EXISTS idx_routing_to ON routing(to_id);
    `);
  }

  setVersion(db, toVersion);
}

/**
 * Clean up old data based on retention policy
 */
export function cleanupOldData(db: Database.Database, retentionDays: number): void {
  const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

  // Clean up old positions
  const positionsDeleted = db.prepare('DELETE FROM positions WHERE timestamp < ?').run(cutoffTime);

  // Clean up old telemetry
  const telemetryDeleted = db.prepare('DELETE FROM telemetry WHERE timestamp < ?').run(cutoffTime);

  // Clean up old messages
  const messagesDeleted = db.prepare('DELETE FROM messages WHERE timestamp < ?').run(cutoffTime);

  console.log(`Data cleanup: removed ${positionsDeleted.changes} positions, ${telemetryDeleted.changes} telemetry records, ${messagesDeleted.changes} messages older than ${retentionDays} days`);

  // Run VACUUM to reclaim space (expensive operation, run carefully)
  if ((positionsDeleted.changes + telemetryDeleted.changes + messagesDeleted.changes) > 1000) {
    console.log('Running VACUUM to reclaim space...');
    db.exec('VACUUM');
  }
}
