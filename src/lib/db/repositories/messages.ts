/**
 * Message Repository
 *
 * Database operations for mesh text messages
 */

import type Database from 'better-sqlite3';
import type { DBMessage, MessageFilter, PaginationOptions, PaginatedResult } from '../types';
import type { ProcessedMessage } from '@/lib/mqtt-processor';

export class MessageRepository {
  constructor(private db: Database.Database) {}

  /**
   * Insert a new message
   */
  insert(message: ProcessedMessage): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO messages (
        id, from_id, to_id, channel, text, timestamp, snr, rssi, hops_away, reply_to
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `);

    return stmt.run(
      message.id,
      message.from,
      message.to,
      message.channel,
      message.text ?? null,
      message.timestamp,
      message.snr ?? null,
      message.rssi ?? null,
      message.hopsAway ?? null,
      message.replyTo ?? null
    );
  }

  /**
   * Batch insert messages
   */
  insertMany(messages: ProcessedMessage[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (
        id, from_id, to_id, channel, text, timestamp, snr, rssi, hops_away, reply_to
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `);

    const insertMany = this.db.transaction((messages: ProcessedMessage[]) => {
      for (const message of messages) {
        stmt.run(
          message.id,
          message.from,
          message.to,
          message.channel,
          message.text ?? null,
          message.timestamp,
          message.snr ?? null,
          message.rssi ?? null,
          message.hopsAway ?? null,
          message.replyTo ?? null
        );
      }
    });

    insertMany(messages);
  }

  /**
   * Get a message by ID
   */
  getById(id: number): DBMessage | null {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?');
    return stmt.get(id) as DBMessage | null;
  }

  /**
   * Get all messages with filtering
   */
  getAll(filter: MessageFilter = {}): DBMessage[] {
    let query = 'SELECT * FROM messages WHERE 1=1';
    const params: any[] = [];

    if (filter.fromId) {
      query += ' AND from_id = ?';
      params.push(filter.fromId);
    }

    if (filter.toId) {
      query += ' AND to_id = ?';
      params.push(filter.toId);
    }

    if (filter.channel !== undefined) {
      query += ' AND channel = ?';
      params.push(filter.channel);
    }

    if (filter.since) {
      query += ' AND timestamp > ?';
      params.push(filter.since);
    }

    query += ' ORDER BY timestamp DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as DBMessage[];
  }

  /**
   * Get paginated messages
   */
  getPaginated(
    filter: MessageFilter = {},
    pagination: PaginationOptions = {}
  ): PaginatedResult<DBMessage> {
    const limit = pagination.limit || 100;
    const offset = pagination.offset || 0;

    // Build WHERE clause
    let whereClause = '1=1';
    const params: any[] = [];

    if (filter.fromId) {
      whereClause += ' AND from_id = ?';
      params.push(filter.fromId);
    }

    if (filter.toId) {
      whereClause += ' AND to_id = ?';
      params.push(filter.toId);
    }

    if (filter.channel !== undefined) {
      whereClause += ' AND channel = ?';
      params.push(filter.channel);
    }

    if (filter.since) {
      whereClause += ' AND timestamp > ?';
      params.push(filter.since);
    }

    // Get total count
    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM messages WHERE ${whereClause}`);
    const { count: total } = countStmt.get(...params) as { count: number };

    // Get paginated data
    const dataStmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);
    const data = dataStmt.all(...params, limit, offset) as DBMessage[];

    return {
      data,
      total,
      limit,
      offset,
      hasMore: offset + data.length < total
    };
  }

  /**
   * Get messages for a specific node (sent or received)
   */
  getForNode(nodeId: string, limit: number = 100): DBMessage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE from_id = ? OR to_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(nodeId, nodeId, limit) as DBMessage[];
  }

  /**
   * Get conversation between two nodes
   */
  getConversation(nodeId1: string, nodeId2: string, limit: number = 100): DBMessage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(nodeId1, nodeId2, nodeId2, nodeId1, limit) as DBMessage[];
  }

  /**
   * Get recent messages (last N messages)
   */
  getRecent(limit: number = 50): DBMessage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(limit) as DBMessage[];
  }

  /**
   * Get messages by channel
   */
  getByChannel(channel: number, limit: number = 100): DBMessage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE channel = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(channel, limit) as DBMessage[];
  }

  /**
   * Get messages within a time range
   */
  getByTimeRange(startTime: number, endTime: number): DBMessage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE timestamp BETWEEN ? AND ?
      ORDER BY timestamp DESC
    `);
    return stmt.all(startTime, endTime) as DBMessage[];
  }

  /**
   * Search messages by text content
   */
  search(query: string, limit: number = 50): DBMessage[] {
    const searchPattern = `%${query}%`;
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE text LIKE ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(searchPattern, limit) as DBMessage[];
  }

  /**
   * Get count of messages
   */
  getCount(filter: MessageFilter = {}): number {
    let query = 'SELECT COUNT(*) as count FROM messages WHERE 1=1';
    const params: any[] = [];

    if (filter.fromId) {
      query += ' AND from_id = ?';
      params.push(filter.fromId);
    }

    if (filter.toId) {
      query += ' AND to_id = ?';
      params.push(filter.toId);
    }

    if (filter.channel !== undefined) {
      query += ' AND channel = ?';
      params.push(filter.channel);
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
   * Get message statistics
   */
  getStats(since?: number): {
    totalMessages: number;
    uniqueSenders: number;
    uniqueChannels: number;
    messagesWithText: number;
  } {
    let query = `
      SELECT
        COUNT(*) as totalMessages,
        COUNT(DISTINCT from_id) as uniqueSenders,
        COUNT(DISTINCT channel) as uniqueChannels,
        COUNT(CASE WHEN text IS NOT NULL AND text != '' THEN 1 END) as messagesWithText
      FROM messages
    `;
    const params: any[] = [];

    if (since) {
      query += ' WHERE timestamp > ?';
      params.push(since);
    }

    const stmt = this.db.prepare(query);
    return stmt.get(...params) as any;
  }

  /**
   * Delete a message
   */
  delete(id: number): Database.RunResult {
    const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?');
    return stmt.run(id);
  }

  /**
   * Delete all messages for a node
   */
  deleteForNode(nodeId: string): Database.RunResult {
    const stmt = this.db.prepare('DELETE FROM messages WHERE from_id = ? OR to_id = ?');
    return stmt.run(nodeId, nodeId);
  }

  /**
   * Get replies to a message
   */
  getReplies(messageId: number): DBMessage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE reply_to = ?
      ORDER BY timestamp ASC
    `);
    return stmt.all(messageId) as DBMessage[];
  }

  /**
   * Get a message thread (original message + all replies)
   */
  getThread(messageId: number): DBMessage[] {
    // Get the root message (could be a reply itself)
    let rootId = messageId;
    let msg = this.getById(messageId);

    // Walk up to find root
    while (msg && msg.reply_to) {
      rootId = msg.reply_to;
      msg = this.getById(rootId);
    }

    // Get all messages in the thread
    const stmt = this.db.prepare(`
      WITH RECURSIVE thread AS (
        SELECT * FROM messages WHERE id = ?
        UNION ALL
        SELECT m.* FROM messages m
        INNER JOIN thread t ON m.reply_to = t.id
      )
      SELECT * FROM thread ORDER BY timestamp ASC
    `);
    return stmt.all(rootId) as DBMessage[];
  }

  /**
   * Update reply_to for a message
   */
  setReplyTo(messageId: number, replyToId: number | null): Database.RunResult {
    const stmt = this.db.prepare('UPDATE messages SET reply_to = ? WHERE id = ?');
    return stmt.run(replyToId, messageId);
  }

  /**
   * Mark a message as read
   */
  markAsRead(messageId: number): Database.RunResult {
    const stmt = this.db.prepare('UPDATE messages SET read_at = ? WHERE id = ? AND read_at IS NULL');
    return stmt.run(Date.now(), messageId);
  }

  /**
   * Mark multiple messages as read
   */
  markManyAsRead(messageIds: number[]): void {
    if (messageIds.length === 0) return;

    const stmt = this.db.prepare('UPDATE messages SET read_at = ? WHERE id = ? AND read_at IS NULL');
    const timestamp = Date.now();

    const markMany = this.db.transaction((ids: number[]) => {
      for (const id of ids) {
        stmt.run(timestamp, id);
      }
    });

    markMany(messageIds);
  }

  /**
   * Mark all messages in a channel as read
   */
  markChannelAsRead(channel: number): Database.RunResult {
    const stmt = this.db.prepare('UPDATE messages SET read_at = ? WHERE channel = ? AND read_at IS NULL');
    return stmt.run(Date.now(), channel);
  }

  /**
   * Get unread message count
   */
  getUnreadCount(channel?: number): number {
    let query = 'SELECT COUNT(*) as count FROM messages WHERE read_at IS NULL';
    const params: any[] = [];

    if (channel !== undefined) {
      query += ' AND channel = ?';
      params.push(channel);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  }

  /**
   * Get unread count per channel
   */
  getUnreadCountByChannel(): { channel: number; count: number }[] {
    const stmt = this.db.prepare(`
      SELECT channel, COUNT(*) as count
      FROM messages
      WHERE read_at IS NULL
      GROUP BY channel
      ORDER BY channel ASC
    `);
    return stmt.all() as { channel: number; count: number }[];
  }
}
