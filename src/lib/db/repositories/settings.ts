/**
 * Settings Repository
 *
 * Database operations for application settings (key-value store)
 */

import type Database from 'better-sqlite3';
import type { DBSetting } from '../types';

export class SettingsRepository {
  constructor(private db: Database.Database) {}

  /**
   * Get a setting by key
   */
  get(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get(key) as DBSetting | undefined;
    return result?.value ?? null;
  }

  /**
   * Get a setting as JSON object
   */
  getJSON<T = any>(key: string): T | null {
    const value = this.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Failed to parse JSON setting '${key}':`, error);
      return null;
    }
  }

  /**
   * Get a setting as number
   */
  getNumber(key: string): number | null {
    const value = this.get(key);
    if (!value) return null;

    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  /**
   * Get a setting as boolean
   */
  getBoolean(key: string): boolean | null {
    const value = this.get(key);
    if (value === null) return null;

    return value === 'true' || value === '1';
  }

  /**
   * Set a setting
   */
  set(key: string, value: string): Database.RunResult {
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);

    return stmt.run(key, value, Date.now());
  }

  /**
   * Set a setting from JSON object
   */
  setJSON(key: string, value: any): Database.RunResult {
    return this.set(key, JSON.stringify(value));
  }

  /**
   * Set a setting from number
   */
  setNumber(key: string, value: number): Database.RunResult {
    return this.set(key, value.toString());
  }

  /**
   * Set a setting from boolean
   */
  setBoolean(key: string, value: boolean): Database.RunResult {
    return this.set(key, value ? 'true' : 'false');
  }

  /**
   * Set multiple settings at once
   */
  setMany(settings: Record<string, string>): void {
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);

    const setMany = this.db.transaction((settings: Record<string, string>) => {
      const now = Date.now();
      for (const [key, value] of Object.entries(settings)) {
        stmt.run(key, value, now);
      }
    });

    setMany(settings);
  }

  /**
   * Get all settings
   */
  getAll(): DBSetting[] {
    const stmt = this.db.prepare('SELECT * FROM settings ORDER BY key');
    return stmt.all() as DBSetting[];
  }

  /**
   * Get all settings as a key-value object
   */
  getAllAsObject(): Record<string, string> {
    const settings = this.getAll();
    return settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);
  }

  /**
   * Check if a setting exists
   */
  exists(key: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM settings WHERE key = ?');
    return stmt.get(key) !== undefined;
  }

  /**
   * Delete a setting
   */
  delete(key: string): Database.RunResult {
    const stmt = this.db.prepare('DELETE FROM settings WHERE key = ?');
    return stmt.run(key);
  }

  /**
   * Delete multiple settings
   */
  deleteMany(keys: string[]): void {
    const stmt = this.db.prepare('DELETE FROM settings WHERE key = ?');

    const deleteMany = this.db.transaction((keys: string[]) => {
      for (const key of keys) {
        stmt.run(key);
      }
    });

    deleteMany(keys);
  }

  /**
   * Clear all settings
   */
  clear(): Database.RunResult {
    const stmt = this.db.prepare('DELETE FROM settings');
    return stmt.run();
  }

  /**
   * Get settings by key prefix
   */
  getByPrefix(prefix: string): DBSetting[] {
    const stmt = this.db.prepare('SELECT * FROM settings WHERE key LIKE ? ORDER BY key');
    return stmt.all(`${prefix}%`) as DBSetting[];
  }

  /**
   * Get count of settings
   */
  getCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM settings');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Export all settings as JSON
   */
  export(): string {
    const settings = this.getAllAsObject();
    return JSON.stringify(settings, null, 2);
  }

  /**
   * Import settings from JSON
   */
  import(json: string): void {
    try {
      const settings = JSON.parse(json) as Record<string, string>;
      this.setMany(settings);
    } catch (error) {
      console.error('Failed to import settings:', error);
      throw new Error('Invalid settings JSON');
    }
  }
}
