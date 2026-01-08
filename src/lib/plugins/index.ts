/**
 * Plugin System
 *
 * Exports the complete plugin system API
 */

// Core types
export type {
  Plugin,
  PluginMetadata,
  PluginCategory,
  PluginState,
  PluginAPI,
  NodesAPI,
  MessagesAPI,
  SettingsAPI,
  EventsAPI,
  UIAPI,
  StorageAPI,
  LogAPI,
  PluginContributions,
  PluginWidget,
  PluginWidgetProps,
  PluginPanel,
  PluginMenuItem,
  PluginMapLayer,
  PluginSettingsSchema,
  PluginSettingsField,
  PluginRegistry,
  RegisteredPlugin,
  // Plugin data types
  NodeInfo,
  MessagePacket,
  Position,
  Telemetry,
} from './types';

// Registry
export {
  createPluginRegistry,
  getPluginRegistry,
  resetPluginRegistry,
} from './registry';

// Loader
export {
  PluginLoader,
  getPluginLoader,
  resetPluginLoader,
  type PluginLoaderConfig,
} from './loader';

// API utilities
export {
  emitPluginEvent,
  getRegisteredWidgets,
  getRegisteredPanels,
  setNodesAccessor,
  setMessagesAccessor,
  setPositionsAccessor,
  setTelemetryAccessor,
  setMessageSender,
  setToastShower,
} from './api';

// Example plugins
export { createNodeStatsPlugin } from './examples/node-stats-plugin';
export { createMessageCounterPlugin } from './examples/message-counter-plugin';
