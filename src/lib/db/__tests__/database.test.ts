/**
 * Database Tests
 *
 * Unit tests for database initialization, schema, and repositories
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema, cleanupOldData, SCHEMA_VERSION } from '../schema';
import { NodeRepository } from '../repositories/nodes';
import { PositionRepository } from '../repositories/positions';
import { TelemetryRepository } from '../repositories/telemetry';
import { MessageRepository } from '../repositories/messages';
import { SettingsRepository } from '../repositories/settings';
import type { ProcessedNodeInfo, ProcessedPosition, ProcessedTelemetry, ProcessedMessage } from '@/lib/mqtt-processor';

describe('Database Schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    db.close();
  });

  it('should initialize schema', () => {
    initializeSchema(db);

    // Check that tables exist
    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table'
      ORDER BY name
    `).all() as { name: string }[];

    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('nodes');
    expect(tableNames).toContain('positions');
    expect(tableNames).toContain('telemetry');
    expect(tableNames).toContain('messages');
    expect(tableNames).toContain('settings');
    expect(tableNames).toContain('metadata');
  });

  it('should set schema version', () => {
    initializeSchema(db);

    const result = db.prepare('SELECT value FROM metadata WHERE key = ?')
      .get('schema_version') as { value: string };

    expect(parseInt(result.value)).toBe(SCHEMA_VERSION);
  });

  it('should create indexes', () => {
    initializeSchema(db);

    const indexes = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='index' AND name LIKE 'idx_%'
    `).all() as { name: string }[];

    expect(indexes.length).toBeGreaterThan(0);
  });

  it('should handle re-initialization idempotently', () => {
    initializeSchema(db);
    initializeSchema(db);

    const result = db.prepare('SELECT value FROM metadata WHERE key = ?')
      .get('schema_version') as { value: string };

    expect(parseInt(result.value)).toBe(SCHEMA_VERSION);
  });
});

describe('NodeRepository', () => {
  let db: Database.Database;
  let repo: NodeRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
    repo = new NodeRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  const createTestNode = (): ProcessedNodeInfo => ({
    id: '!12345678',
    nodeNum: 123456,
    shortName: 'TEST',
    longName: 'Test Node',
    hwModel: 'TBEAM',
    role: 1,
    lastHeard: Date.now(),
    snr: 5.5,
    rssi: -90,
    hopsAway: 1
  });

  it('should insert a node', () => {
    const node = createTestNode();
    const result = repo.upsert(node);

    expect(result.changes).toBe(1);
  });

  it('should retrieve a node by id', () => {
    const node = createTestNode();
    repo.upsert(node);

    const retrieved = repo.getById(node.id);
    expect(retrieved).toBeTruthy();
    expect(retrieved?.id).toBe(node.id);
    expect(retrieved?.short_name).toBe(node.shortName);
  });

  it('should update existing node', () => {
    const node = createTestNode();
    repo.upsert(node);

    // Update the node
    const updated = { ...node, shortName: 'UPDATED' };
    repo.upsert(updated);

    const retrieved = repo.getById(node.id);
    expect(retrieved?.short_name).toBe('UPDATED');
  });

  it('should get all nodes', () => {
    repo.upsert(createTestNode());
    repo.upsert({ ...createTestNode(), id: '!87654321', nodeNum: 654321 });

    const nodes = repo.getAll();
    expect(nodes.length).toBe(2);
  });

  it('should filter nodes by active status', () => {
    const oldNode = { ...createTestNode(), lastHeard: Date.now() - 2000 };
    const newNode = createTestNode();

    repo.upsert(oldNode);
    repo.upsert(newNode);

    const activeNodes = repo.getAll({ activeWithin: 1000 });
    expect(activeNodes.length).toBe(1);
    expect(activeNodes[0].id).toBe(newNode.id);
  });

  it('should search nodes by name', () => {
    repo.upsert({ ...createTestNode(), shortName: 'ALPHA', longName: 'Alpha Node' });
    repo.upsert({ ...createTestNode(), id: '!87654321', nodeNum: 654321, shortName: 'BETA', longName: 'Beta Node' });

    const results = repo.search('ALPHA');
    expect(results.length).toBe(1);
    expect(results[0].short_name).toBe('ALPHA');
  });

  it('should delete a node', () => {
    const node = createTestNode();
    repo.upsert(node);

    repo.delete(node.id);

    const retrieved = repo.getById(node.id);
    expect(retrieved).toBeNull();
  });
});

describe('PositionRepository', () => {
  let db: Database.Database;
  let repo: PositionRepository;
  let nodeRepo: NodeRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
    repo = new PositionRepository(db);
    nodeRepo = new NodeRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  const createTestPosition = (): ProcessedPosition => ({
    nodeId: '!12345678',
    nodeNum: 123456,
    position: {
      latitude: 38.0,
      longitude: -84.5,
      altitude: 300,
    },
    timestamp: Date.now(),
    snr: 5.5,
    rssi: -90
  });

  it('should insert a position', () => {
    // Create node first (foreign key constraint)
    nodeRepo.upsert({
      id: '!12345678',
      nodeNum: 123456,
      shortName: 'TEST',
      longName: 'Test',
      hwModel: 'TBEAM',
      role: 1,
      lastHeard: Date.now()
    });

    const position = createTestPosition();
    const result = repo.insert(position);

    expect(result.changes).toBe(1);
  });

  it('should get latest position for node', () => {
    nodeRepo.upsert({
      id: '!12345678',
      nodeNum: 123456,
      shortName: 'TEST',
      longName: 'Test',
      hwModel: 'TBEAM',
      role: 1,
      lastHeard: Date.now()
    });

    const pos1 = { ...createTestPosition(), timestamp: Date.now() - 1000 };
    const pos2 = { ...createTestPosition(), timestamp: Date.now() };

    repo.insert(pos1);
    repo.insert(pos2);

    const latest = repo.getLatestForNode('!12345678');
    expect(latest).toBeTruthy();
    expect(latest?.timestamp).toBe(pos2.timestamp);
  });

  it('should filter positions by bounds', () => {
    nodeRepo.upsert({
      id: '!12345678',
      nodeNum: 123456,
      shortName: 'TEST',
      longName: 'Test',
      hwModel: 'TBEAM',
      role: 1,
      lastHeard: Date.now()
    });

    const posInside = createTestPosition();
    const posOutside = {
      ...createTestPosition(),
      position: { latitude: 50.0, longitude: -100.0 }
    };

    repo.insert(posInside);
    repo.insert(posOutside);

    const bounds = { north: 39.0, south: 37.0, east: -84.0, west: -85.0 };
    const filtered = repo.getAll({ bounds });

    expect(filtered.length).toBe(1);
    expect(filtered[0].latitude).toBe(38.0);
  });
});

describe('MessageRepository', () => {
  let db: Database.Database;
  let repo: MessageRepository;
  let nodeRepo: NodeRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
    repo = new MessageRepository(db);
    nodeRepo = new NodeRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  const createTestMessage = (): ProcessedMessage => ({
    id: 12345,
    from: '!12345678',
    to: '!87654321',
    channel: 0,
    text: 'Hello World',
    timestamp: Date.now(),
    snr: 5.5,
    rssi: -90,
    hopsAway: 1
  });

  it('should insert a message', () => {
    // Create nodes first
    nodeRepo.upsert({
      id: '!12345678',
      nodeNum: 123456,
      shortName: 'FROM',
      longName: 'From Node',
      hwModel: 'TBEAM',
      role: 1,
      lastHeard: Date.now()
    });

    const message = createTestMessage();
    const result = repo.insert(message);

    expect(result.changes).toBe(1);
  });

  it('should not insert duplicate messages', () => {
    nodeRepo.upsert({
      id: '!12345678',
      nodeNum: 123456,
      shortName: 'FROM',
      longName: 'From Node',
      hwModel: 'TBEAM',
      role: 1,
      lastHeard: Date.now()
    });

    const message = createTestMessage();
    repo.insert(message);
    const result = repo.insert(message);

    // ON CONFLICT DO NOTHING means no rows affected
    expect(result.changes).toBe(0);
  });

  it('should search messages by text', () => {
    nodeRepo.upsert({
      id: '!12345678',
      nodeNum: 123456,
      shortName: 'FROM',
      longName: 'From Node',
      hwModel: 'TBEAM',
      role: 1,
      lastHeard: Date.now()
    });

    repo.insert({ ...createTestMessage(), id: 1, text: 'Hello World' });
    repo.insert({ ...createTestMessage(), id: 2, text: 'Goodbye Moon' });

    const results = repo.search('Hello');
    expect(results.length).toBe(1);
    expect(results[0].text).toContain('Hello');
  });

  it('should get messages by channel', () => {
    nodeRepo.upsert({
      id: '!12345678',
      nodeNum: 123456,
      shortName: 'FROM',
      longName: 'From Node',
      hwModel: 'TBEAM',
      role: 1,
      lastHeard: Date.now()
    });

    repo.insert({ ...createTestMessage(), id: 1, channel: 0 });
    repo.insert({ ...createTestMessage(), id: 2, channel: 1 });

    const channel0 = repo.getByChannel(0);
    expect(channel0.length).toBe(1);
    expect(channel0[0].channel).toBe(0);
  });
});

describe('SettingsRepository', () => {
  let db: Database.Database;
  let repo: SettingsRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeSchema(db);
    repo = new SettingsRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should set and get a setting', () => {
    repo.set('test_key', 'test_value');

    const value = repo.get('test_key');
    expect(value).toBe('test_value');
  });

  it('should update existing setting', () => {
    repo.set('test_key', 'original');
    repo.set('test_key', 'updated');

    const value = repo.get('test_key');
    expect(value).toBe('updated');
  });

  it('should handle JSON settings', () => {
    const obj = { foo: 'bar', num: 42 };
    repo.setJSON('json_test', obj);

    const retrieved = repo.getJSON('json_test');
    expect(retrieved).toEqual(obj);
  });

  it('should handle number settings', () => {
    repo.setNumber('num_test', 123);

    const value = repo.getNumber('num_test');
    expect(value).toBe(123);
  });

  it('should handle boolean settings', () => {
    repo.setBoolean('bool_test', true);

    const value = repo.getBoolean('bool_test');
    expect(value).toBe(true);
  });

  it('should get all settings', () => {
    repo.set('key1', 'value1');
    repo.set('key2', 'value2');

    const all = repo.getAll();
    expect(all.length).toBe(2);
  });

  it('should delete a setting', () => {
    repo.set('delete_me', 'value');
    repo.delete('delete_me');

    const value = repo.get('delete_me');
    expect(value).toBeNull();
  });

  it('should export and import settings', () => {
    repo.set('key1', 'value1');
    repo.set('key2', 'value2');

    const exported = repo.export();

    repo.clear();
    repo.import(exported);

    expect(repo.get('key1')).toBe('value1');
    expect(repo.get('key2')).toBe('value2');
  });
});

describe('Data Cleanup', () => {
  let db: Database.Database;
  let posRepo: PositionRepository;
  let nodeRepo: NodeRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
    posRepo = new PositionRepository(db);
    nodeRepo = new NodeRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should remove old positions', () => {
    nodeRepo.upsert({
      id: '!12345678',
      nodeNum: 123456,
      shortName: 'TEST',
      longName: 'Test',
      hwModel: 'TBEAM',
      role: 1,
      lastHeard: Date.now()
    });

    const oldPos = {
      nodeId: '!12345678',
      nodeNum: 123456,
      position: { latitude: 38.0, longitude: -84.5 },
      timestamp: Date.now() - (31 * 24 * 60 * 60 * 1000), // 31 days ago
      snr: 5.5,
      rssi: -90
    };

    const newPos = {
      ...oldPos,
      timestamp: Date.now()
    };

    posRepo.insert(oldPos);
    posRepo.insert(newPos);

    cleanupOldData(db, 30); // 30 day retention

    const remaining = posRepo.getAll();
    expect(remaining.length).toBe(1);
    expect(remaining[0].timestamp).toBe(newPos.timestamp);
  });
});
