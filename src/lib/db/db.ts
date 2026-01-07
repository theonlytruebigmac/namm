/**
 * Database Module Exports
 *
 * Central export point for database functionality
 */

// Core database functions
export {
  getDatabase,
  closeDatabase,
  isDatabaseConnected,
  transaction,
  getDatabaseStats
} from './index';

// Schema management
export {
  initializeSchema,
  cleanupOldData,
  SCHEMA_VERSION
} from './schema';

// Repositories
export { NodeRepository } from './repositories/nodes';
export { PositionRepository } from './repositories/positions';
export { TelemetryRepository } from './repositories/telemetry';
export { MessageRepository } from './repositories/messages';
export { SettingsRepository } from './repositories/settings';
export { ReactionRepository } from './repositories/reactions';
export { FavoriteRepository } from './repositories/favorites';

// Types
export type {
  DBNode,
  DBPosition,
  DBTelemetry,
  DBMessage,
  DBSetting,
  DBMetadata,
  NodeFilter,
  PositionFilter,
  TelemetryFilter,
  MessageFilter,
  BoundingBox,
  PaginationOptions,
  PaginatedResult
} from './types';
