/**
 * Database Initialization and Singleton Access
 *
 * Provides singleton access to SQLite database with WAL mode enabled
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initializeSchema, cleanupOldData } from './schema';

let db: Database.Database | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;

interface DatabaseOptions {
  path?: string;
  readonly?: boolean;
  verbose?: boolean;
}

/**
 * Get or create the database singleton instance
 */
export function getDatabase(options: DatabaseOptions = {}): Database.Database {
  if (db) {
    return db;
  }

  // Determine database path
  const dbPath = options.path || process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'namm.db');

  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Created database directory: ${dbDir}`);
  }

  // Create database connection
  console.log(`Opening database: ${dbPath}`);
  db = new Database(dbPath, {
    readonly: options.readonly || false,
    verbose: options.verbose ? console.log : undefined
  });

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Optimize for safety vs speed
  db.pragma('synchronous = NORMAL');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Increase cache size (in pages, negative = KB)
  db.pragma('cache_size = -64000'); // 64MB cache

  // Initialize schema
  initializeSchema(db);

  // Set up periodic cleanup (once per day)
  if (!cleanupInterval) {
    const retentionDays = parseInt(process.env.DATA_RETENTION_DAYS || '30', 10);
    cleanupInterval = setInterval(() => {
      try {
        cleanupOldData(db!, retentionDays);
      } catch (error) {
        console.error('Error during data cleanup:', error);
      }
    }, 24 * 60 * 60 * 1000); // Run once per day

    // Run cleanup on startup if data exists
    setTimeout(() => {
      try {
        cleanupOldData(db!, retentionDays);
      } catch (error) {
        console.error('Error during initial cleanup:', error);
      }
    }, 5000); // Wait 5 seconds after startup
  }

  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  if (db) {
    console.log('Closing database connection');
    db.close();
    db = null;
  }
}

/**
 * Check if database is initialized and connected
 */
export function isDatabaseConnected(): boolean {
  return db !== null && db.open;
}

/**
 * Execute a function within a transaction
 */
export function transaction<T>(fn: (db: Database.Database) => T): T {
  const database = getDatabase();
  const txn = database.transaction(fn);
  return txn(database);
}

/**
 * Get database statistics
 */
export function getDatabaseStats(): {
  size: number;
  pageCount: number;
  pageSize: number;
  nodeCount: number;
  positionCount: number;
  telemetryCount: number;
  messageCount: number;
} {
  const database = getDatabase();

  const pageCount = database.pragma('page_count', { simple: true }) as number;
  const pageSize = database.pragma('page_size', { simple: true }) as number;

  const nodeCount = database.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number };
  const positionCount = database.prepare('SELECT COUNT(*) as count FROM positions').get() as { count: number };
  const telemetryCount = database.prepare('SELECT COUNT(*) as count FROM telemetry').get() as { count: number };
  const messageCount = database.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };

  return {
    size: pageCount * pageSize,
    pageCount,
    pageSize,
    nodeCount: nodeCount.count,
    positionCount: positionCount.count,
    telemetryCount: telemetryCount.count,
    messageCount: messageCount.count
  };
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, closing database...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, closing database...');
  closeDatabase();
  process.exit(0);
});
