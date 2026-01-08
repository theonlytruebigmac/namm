/**
 * Plugin System Types
 *
 * Provides a flexible extension mechanism for adding custom functionality
 */

// ============================================================================
// Plugin-specific types (simplified for plugin use)
// ============================================================================

/**
 * Node information for plugins
 */
export interface NodeInfo {
  id: string;
  nodeNum: number;
  shortName: string;
  longName: string;
  hwModel: string;
  role: string;
  batteryLevel?: number;
  voltage?: number;
  snr?: number;
  rssi?: number;
  lastHeard: number;
  position?: Position;
  hopsAway?: number;
}

/**
 * Position information
 */
export interface Position {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  timestamp?: number;
}

/**
 * Message information for plugins
 */
export interface MessagePacket {
  id: string;
  from: number;
  to?: number;
  channel?: number;
  text?: string;
  rxTime?: number;
  timestamp: number;
}

/**
 * Telemetry information for plugins
 */
export interface Telemetry {
  batteryLevel?: number;
  voltage?: number;
  channelUtilization?: number;
  airUtilTx?: number;
  uptime?: number;
}

// ============================================================================
// Core Plugin Types
// ============================================================================

/**
 * Plugin metadata describing the plugin
 */
export interface PluginMetadata {
  /** Unique identifier for the plugin */
  id: string;
  /** Human-readable name */
  name: string;
  /** Version following semver */
  version: string;
  /** Brief description */
  description: string;
  /** Author name or organization */
  author: string;
  /** Optional homepage or repository URL */
  homepage?: string;
  /** Minimum app version required */
  minAppVersion?: string;
  /** Plugin category for organization */
  category?: PluginCategory;
}

/**
 * Plugin categories for organization
 */
export type PluginCategory =
  | 'visualization'
  | 'messaging'
  | 'automation'
  | 'analysis'
  | 'export'
  | 'integration'
  | 'other';

/**
 * Plugin lifecycle state
 */
export type PluginState = 'unloaded' | 'loaded' | 'active' | 'error' | 'disabled';

/**
 * Core plugin interface that all plugins must implement
 */
export interface Plugin {
  /** Plugin metadata */
  metadata: PluginMetadata;

  /** Called when plugin is loaded (initialization) */
  onLoad?(api: PluginAPI): Promise<void> | void;

  /** Called when plugin is activated */
  onActivate?(api: PluginAPI): Promise<void> | void;

  /** Called when plugin is deactivated */
  onDeactivate?(api: PluginAPI): Promise<void> | void;

  /** Called when plugin is unloaded (cleanup) */
  onUnload?(api: PluginAPI): Promise<void> | void;

  /** Optional settings schema for plugin configuration */
  settingsSchema?: PluginSettingsSchema;

  /** Optional UI contributions */
  contributions?: PluginContributions;
}

// ============================================================================
// Plugin API - What plugins can access
// ============================================================================

/**
 * API surface exposed to plugins for interacting with the app
 */
export interface PluginAPI {
  /** Node-related operations */
  nodes: NodesAPI;

  /** Message-related operations */
  messages: MessagesAPI;

  /** Settings operations */
  settings: SettingsAPI;

  /** Event subscription */
  events: EventsAPI;

  /** UI operations */
  ui: UIAPI;

  /** Storage for plugin data */
  storage: StorageAPI;

  /** Logging */
  log: LogAPI;
}

/**
 * Nodes API for accessing mesh node data
 */
export interface NodesAPI {
  /** Get all known nodes */
  getAll(): NodeInfo[];

  /** Get a specific node by ID */
  getById(nodeId: string): NodeInfo | undefined;

  /** Get nodes matching a filter */
  getByFilter(filter: (node: NodeInfo) => boolean): NodeInfo[];

  /** Get node positions */
  getPositions(): Map<string, Position>;

  /** Get node telemetry */
  getTelemetry(nodeId: string): Telemetry | undefined;
}

/**
 * Messages API for accessing mesh messages
 */
export interface MessagesAPI {
  /** Get all messages */
  getAll(): MessagePacket[];

  /** Get messages for a channel */
  getByChannel(channelId: number): MessagePacket[];

  /** Send a message (if connected) */
  send(text: string, channelId?: number, destination?: string): Promise<boolean>;
}

/**
 * Settings API for plugin configuration
 */
export interface SettingsAPI {
  /** Get plugin-specific settings */
  get<T>(key: string, defaultValue: T): T;

  /** Set plugin-specific settings */
  set<T>(key: string, value: T): void;

  /** Get all plugin settings */
  getAll(): Record<string, unknown>;
}

/**
 * Events API for subscribing to app events
 */
export interface EventsAPI {
  /** Subscribe to node updates */
  onNodeUpdate(callback: (node: NodeInfo) => void): () => void;

  /** Subscribe to new messages */
  onMessage(callback: (message: MessagePacket) => void): () => void;

  /** Subscribe to telemetry updates */
  onTelemetry(callback: (nodeId: string, telemetry: Telemetry) => void): () => void;

  /** Subscribe to position updates */
  onPosition(callback: (nodeId: string, position: Position) => void): () => void;

  /** Subscribe to connection state changes */
  onConnectionChange(callback: (connected: boolean) => void): () => void;
}

/**
 * UI API for plugin UI contributions
 */
export interface UIAPI {
  /** Show a toast notification */
  showToast(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;

  /** Register a custom panel */
  registerPanel(id: string, component: React.ComponentType): void;

  /** Register a dashboard widget */
  registerWidget(widget: PluginWidget): void;

  /** Unregister a panel */
  unregisterPanel(id: string): void;

  /** Unregister a widget */
  unregisterWidget(id: string): void;
}

/**
 * Storage API for plugin data persistence
 */
export interface StorageAPI {
  /** Get stored value */
  get<T>(key: string): T | undefined;

  /** Set stored value */
  set<T>(key: string, value: T): void;

  /** Remove stored value */
  remove(key: string): void;

  /** Clear all plugin storage */
  clear(): void;
}

/**
 * Logging API for plugin debugging
 */
export interface LogAPI {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

// ============================================================================
// Plugin Contributions - UI Extensions
// ============================================================================

/**
 * UI contributions a plugin can make
 */
export interface PluginContributions {
  /** Dashboard widgets */
  widgets?: PluginWidget[];

  /** Sidebar panels */
  panels?: PluginPanel[];

  /** Menu items */
  menuItems?: PluginMenuItem[];

  /** Map layers */
  mapLayers?: PluginMapLayer[];
}

/**
 * Dashboard widget contribution
 */
export interface PluginWidget {
  id: string;
  title: string;
  description?: string;
  defaultSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
  component: React.ComponentType<PluginWidgetProps>;
}

/**
 * Props passed to plugin widgets
 */
export interface PluginWidgetProps {
  api: PluginAPI;
  settings: Record<string, unknown>;
}

/**
 * Sidebar panel contribution
 */
export interface PluginPanel {
  id: string;
  title: string;
  icon?: React.ComponentType;
  position?: 'left' | 'right';
  component: React.ComponentType<{ api: PluginAPI }>;
}

/**
 * Menu item contribution
 */
export interface PluginMenuItem {
  id: string;
  label: string;
  icon?: React.ComponentType;
  onClick: (api: PluginAPI) => void;
  location: 'toolbar' | 'context' | 'settings';
}

/**
 * Map layer contribution
 */
export interface PluginMapLayer {
  id: string;
  name: string;
  type: 'overlay' | 'marker' | 'heatmap';
  component: React.ComponentType<{ api: PluginAPI }>;
}

// ============================================================================
// Plugin Settings
// ============================================================================

/**
 * Schema for plugin settings UI
 */
export interface PluginSettingsSchema {
  /** Schema version */
  version: 1;

  /** Settings fields */
  fields: PluginSettingsField[];
}

/**
 * A single settings field
 */
export interface PluginSettingsField {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'color';
  label: string;
  description?: string;
  defaultValue?: unknown;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    options?: { value: string; label: string }[];
  };
}

// ============================================================================
// Plugin Registry Types
// ============================================================================

/**
 * Registered plugin with runtime state
 */
export interface RegisteredPlugin {
  plugin: Plugin;
  state: PluginState;
  error?: Error;
  loadedAt?: Date;
  activatedAt?: Date;
}

/**
 * Plugin registry interface
 */
export interface PluginRegistry {
  /** Register a plugin */
  register(plugin: Plugin): void;

  /** Unregister a plugin */
  unregister(pluginId: string): void;

  /** Get a registered plugin */
  get(pluginId: string): RegisteredPlugin | undefined;

  /** Get all registered plugins */
  getAll(): RegisteredPlugin[];

  /** Activate a plugin */
  activate(pluginId: string): Promise<void>;

  /** Deactivate a plugin */
  deactivate(pluginId: string): Promise<void>;

  /** Check if a plugin is active */
  isActive(pluginId: string): boolean;
}
