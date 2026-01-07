/**
 * Reactions Repository
 *
 * Database operations for message reactions (emoji)
 */

import type Database from 'better-sqlite3';

export interface DBReaction {
  id: number;
  message_id: number;
  from_node: string;
  emoji: string;
  timestamp: number;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  fromNodes: string[];
}

export class ReactionRepository {
  constructor(private db: Database.Database) {}

  /**
   * Add a reaction to a message
   * Uses UPSERT to handle duplicate reactions from same node
   */
  addReaction(messageId: number, fromNode: string, emoji: string): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO reactions (message_id, from_node, emoji, timestamp)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(message_id, from_node, emoji) DO UPDATE SET timestamp = excluded.timestamp
    `);

    return stmt.run(messageId, fromNode, emoji, Date.now());
  }

  /**
   * Remove a reaction from a message
   */
  removeReaction(messageId: number, fromNode: string, emoji: string): Database.RunResult {
    const stmt = this.db.prepare(`
      DELETE FROM reactions
      WHERE message_id = ? AND from_node = ? AND emoji = ?
    `);

    return stmt.run(messageId, fromNode, emoji);
  }

  /**
   * Toggle a reaction (add if not exists, remove if exists)
   */
  toggleReaction(messageId: number, fromNode: string, emoji: string): { added: boolean } {
    const existing = this.db.prepare(`
      SELECT id FROM reactions
      WHERE message_id = ? AND from_node = ? AND emoji = ?
    `).get(messageId, fromNode, emoji);

    if (existing) {
      this.removeReaction(messageId, fromNode, emoji);
      return { added: false };
    } else {
      this.addReaction(messageId, fromNode, emoji);
      return { added: true };
    }
  }

  /**
   * Get all reactions for a message
   */
  getForMessage(messageId: number): DBReaction[] {
    const stmt = this.db.prepare(`
      SELECT * FROM reactions
      WHERE message_id = ?
      ORDER BY timestamp ASC
    `);
    return stmt.all(messageId) as DBReaction[];
  }

  /**
   * Get reactions for a message grouped by emoji
   */
  getSummaryForMessage(messageId: number): ReactionSummary[] {
    const reactions = this.getForMessage(messageId);

    // Group by emoji
    const grouped = new Map<string, string[]>();
    for (const reaction of reactions) {
      const nodes = grouped.get(reaction.emoji) || [];
      nodes.push(reaction.from_node);
      grouped.set(reaction.emoji, nodes);
    }

    return Array.from(grouped.entries()).map(([emoji, fromNodes]) => ({
      emoji,
      count: fromNodes.length,
      fromNodes,
    }));
  }

  /**
   * Get reactions for multiple messages (batch)
   */
  getForMessages(messageIds: number[]): Map<number, ReactionSummary[]> {
    if (messageIds.length === 0) {
      return new Map();
    }

    const placeholders = messageIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT * FROM reactions
      WHERE message_id IN (${placeholders})
      ORDER BY message_id, timestamp ASC
    `);
    const reactions = stmt.all(...messageIds) as DBReaction[];

    // Group by message_id, then by emoji
    const result = new Map<number, ReactionSummary[]>();

    for (const messageId of messageIds) {
      const messageReactions = reactions.filter(r => r.message_id === messageId);
      const grouped = new Map<string, string[]>();

      for (const reaction of messageReactions) {
        const nodes = grouped.get(reaction.emoji) || [];
        nodes.push(reaction.from_node);
        grouped.set(reaction.emoji, nodes);
      }

      result.set(messageId, Array.from(grouped.entries()).map(([emoji, fromNodes]) => ({
        emoji,
        count: fromNodes.length,
        fromNodes,
      })));
    }

    return result;
  }

  /**
   * Check if a node has reacted to a message with a specific emoji
   */
  hasReacted(messageId: number, fromNode: string, emoji: string): boolean {
    const stmt = this.db.prepare(`
      SELECT 1 FROM reactions
      WHERE message_id = ? AND from_node = ? AND emoji = ?
      LIMIT 1
    `);
    return !!stmt.get(messageId, fromNode, emoji);
  }

  /**
   * Get all reactions from a specific node
   */
  getByNode(fromNode: string, limit: number = 100): DBReaction[] {
    const stmt = this.db.prepare(`
      SELECT * FROM reactions
      WHERE from_node = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(fromNode, limit) as DBReaction[];
  }

  /**
   * Delete all reactions for a message
   */
  deleteForMessage(messageId: number): Database.RunResult {
    const stmt = this.db.prepare('DELETE FROM reactions WHERE message_id = ?');
    return stmt.run(messageId);
  }

  /**
   * Get reaction count for a message
   */
  getCount(messageId: number): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM reactions WHERE message_id = ?');
    const result = stmt.get(messageId) as { count: number };
    return result.count;
  }
}
