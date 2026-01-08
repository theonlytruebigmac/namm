/**
 * Plugin API Implementation
 *
 * Provides the API surface that plugins use to interact with the application
 */

import type {
  PluginAPI,
  NodesAPI,
  MessagesAPI,
  SettingsAPI,
  EventsAPI,
  UIAPI,
  StorageAPI,
  LogAPI,
  PluginWidget,
  NodeInfo,
  MessagePacket,
  Telemetry,
  Position,
} from './types';

// ============================================================================
// Plugin Event Emitter
// ============================================================================

type EventCallback<T = unknown> = (data: T) => void;
type EventType = 'node-update' | 'message' | 'telemetry' | 'position' | 'connection';

const eventListeners = new Map<EventType, Set<EventCallback>>();

/**
 * Emit an event to all subscribed plugins
 */
export function emitPluginEvent<T>(event: EventType, data: T): void {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`[Plugins] Event handler error for ${event}:`, err);
      }
    });
  }
}

function subscribeEvent<T>(event: EventType, callback: EventCallback<T>): () => void {
  let listeners = eventListeners.get(event);
  if (!listeners) {
    listeners = new Set();
    eventListeners.set(event, listeners);
  }
  listeners.add(callback as EventCallback);

  return () => {
    listeners?.delete(callback as EventCallback);
  };
}

// ============================================================================
// Plugin Storage
// ============================================================================

const pluginStorage = new Map<string, Map<string, unknown>>();

function getPluginStorage(pluginId: string): Map<string, unknown> {
  let storage = pluginStorage.get(pluginId);
  if (!storage) {
    storage = new Map();
    pluginStorage.set(pluginId, storage);

    // Try to load from localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(`plugin-storage-${pluginId}`);
        if (saved) {
          const data = JSON.parse(saved);
          Object.entries(data).forEach(([k, v]) => storage!.set(k, v));
        }
      } catch {
        // Ignore parse errors
      }
    }
  }
  return storage;
}

function savePluginStorage(pluginId: string): void {
  const storage = pluginStorage.get(pluginId);
  if (storage && typeof localStorage !== 'undefined') {
    try {
      const data = Object.fromEntries(storage.entries());
      localStorage.setItem(`plugin-storage-${pluginId}`, JSON.stringify(data));
    } catch {
      // Ignore quota errors
    }
  }
}

// ============================================================================
// Widget Registry
// ============================================================================

const registeredWidgets = new Map<string, PluginWidget>();
const registeredPanels = new Map<string, React.ComponentType>();

export function getRegisteredWidgets(): PluginWidget[] {
  return Array.from(registeredWidgets.values());
}

export function getRegisteredPanels(): Map<string, React.ComponentType> {
  return registeredPanels;
}

// ============================================================================
// Data Accessors (will be connected to actual stores)
// ============================================================================

// These will be set by the app when stores are available
let nodesAccessor: (() => NodeInfo[]) | null = null;
let messagesAccessor: (() => MessagePacket[]) | null = null;
let positionsAccessor: (() => Map<string, Position>) | null = null;
let telemetryAccessor: ((nodeId: string) => Telemetry | undefined) | null = null;
let messageSender: ((text: string, channelId?: number, destination?: string) => Promise<boolean>) | null = null;
let toastShower: ((message: string, type?: 'info' | 'success' | 'warning' | 'error') => void) | null = null;

export function setNodesAccessor(accessor: () => NodeInfo[]): void {
  nodesAccessor = accessor;
}

export function setMessagesAccessor(accessor: () => MessagePacket[]): void {
  messagesAccessor = accessor;
}

export function setPositionsAccessor(accessor: () => Map<string, Position>): void {
  positionsAccessor = accessor;
}

export function setTelemetryAccessor(accessor: (nodeId: string) => Telemetry | undefined): void {
  telemetryAccessor = accessor;
}

export function setMessageSender(sender: (text: string, channelId?: number, destination?: string) => Promise<boolean>): void {
  messageSender = sender;
}

export function setToastShower(shower: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void): void {
  toastShower = shower;
}

// ============================================================================
// Create Plugin API
// ============================================================================

/**
 * Create an API instance for a specific plugin
 */
export function createPluginAPI(pluginId: string): PluginAPI {
  const prefix = `[Plugin:${pluginId}]`;

  // Nodes API
  const nodes: NodesAPI = {
    getAll(): NodeInfo[] {
      return nodesAccessor?.() ?? [];
    },

    getById(nodeId: string): NodeInfo | undefined {
      return nodesAccessor?.().find(n => n.nodeNum?.toString() === nodeId || n.id === nodeId);
    },

    getByFilter(filter: (node: NodeInfo) => boolean): NodeInfo[] {
      return nodesAccessor?.().filter(filter) ?? [];
    },

    getPositions(): Map<string, Position> {
      return positionsAccessor?.() ?? new Map();
    },

    getTelemetry(nodeId: string): Telemetry | undefined {
      return telemetryAccessor?.(nodeId);
    },
  };

  // Messages API
  const messages: MessagesAPI = {
    getAll(): MessagePacket[] {
      return messagesAccessor?.() ?? [];
    },

    getByChannel(channelId: number): MessagePacket[] {
      return messagesAccessor?.().filter(m => m.channel === channelId) ?? [];
    },

    async send(text: string, channelId?: number, destination?: string): Promise<boolean> {
      if (!messageSender) {
        console.warn(`${prefix} Message sending not available`);
        return false;
      }
      return messageSender(text, channelId, destination);
    },
  };

  // Settings API (per-plugin settings)
  const pluginSettings = new Map<string, unknown>();

  const settings: SettingsAPI = {
    get<T>(key: string, defaultValue: T): T {
      if (pluginSettings.has(key)) {
        return pluginSettings.get(key) as T;
      }

      // Try localStorage
      if (typeof localStorage !== 'undefined') {
        try {
          const saved = localStorage.getItem(`plugin-settings-${pluginId}`);
          if (saved) {
            const data = JSON.parse(saved);
            if (key in data) {
              return data[key] as T;
            }
          }
        } catch {
          // Ignore
        }
      }

      return defaultValue;
    },

    set<T>(key: string, value: T): void {
      pluginSettings.set(key, value);

      // Persist to localStorage
      if (typeof localStorage !== 'undefined') {
        try {
          const saved = localStorage.getItem(`plugin-settings-${pluginId}`);
          const data = saved ? JSON.parse(saved) : {};
          data[key] = value;
          localStorage.setItem(`plugin-settings-${pluginId}`, JSON.stringify(data));
        } catch {
          // Ignore quota errors
        }
      }
    },

    getAll(): Record<string, unknown> {
      const result: Record<string, unknown> = {};

      // Load from localStorage
      if (typeof localStorage !== 'undefined') {
        try {
          const saved = localStorage.getItem(`plugin-settings-${pluginId}`);
          if (saved) {
            Object.assign(result, JSON.parse(saved));
          }
        } catch {
          // Ignore
        }
      }

      // Override with in-memory values
      pluginSettings.forEach((value, key) => {
        result[key] = value;
      });

      return result;
    },
  };

  // Events API
  const events: EventsAPI = {
    onNodeUpdate(callback: (node: NodeInfo) => void): () => void {
      return subscribeEvent('node-update', callback);
    },

    onMessage(callback: (message: MessagePacket) => void): () => void {
      return subscribeEvent('message', callback);
    },

    onTelemetry(callback: (nodeId: string, telemetry: Telemetry) => void): () => void {
      return subscribeEvent('telemetry', (data: { nodeId: string; telemetry: Telemetry }) => {
        callback(data.nodeId, data.telemetry);
      });
    },

    onPosition(callback: (nodeId: string, position: Position) => void): () => void {
      return subscribeEvent('position', (data: { nodeId: string; position: Position }) => {
        callback(data.nodeId, data.position);
      });
    },

    onConnectionChange(callback: (connected: boolean) => void): () => void {
      return subscribeEvent('connection', callback);
    },
  };

  // UI API
  const ui: UIAPI = {
    showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
      if (toastShower) {
        toastShower(message, type);
      } else {
        console.log(`${prefix} Toast (${type}): ${message}`);
      }
    },

    registerPanel(id: string, component: React.ComponentType): void {
      const fullId = `${pluginId}:${id}`;
      registeredPanels.set(fullId, component);
      console.log(`${prefix} Registered panel: ${id}`);
    },

    registerWidget(widget: PluginWidget): void {
      const fullId = `${pluginId}:${widget.id}`;
      registeredWidgets.set(fullId, { ...widget, id: fullId });
      console.log(`${prefix} Registered widget: ${widget.title}`);
    },

    unregisterPanel(id: string): void {
      const fullId = `${pluginId}:${id}`;
      registeredPanels.delete(fullId);
    },

    unregisterWidget(id: string): void {
      const fullId = `${pluginId}:${id}`;
      registeredWidgets.delete(fullId);
    },
  };

  // Storage API
  const storage: StorageAPI = {
    get<T>(key: string): T | undefined {
      return getPluginStorage(pluginId).get(key) as T | undefined;
    },

    set<T>(key: string, value: T): void {
      getPluginStorage(pluginId).set(key, value);
      savePluginStorage(pluginId);
    },

    remove(key: string): void {
      getPluginStorage(pluginId).delete(key);
      savePluginStorage(pluginId);
    },

    clear(): void {
      pluginStorage.delete(pluginId);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`plugin-storage-${pluginId}`);
      }
    },
  };

  // Log API
  const log: LogAPI = {
    debug(message: string, ...args: unknown[]): void {
      console.debug(`${prefix} ${message}`, ...args);
    },
    info(message: string, ...args: unknown[]): void {
      console.info(`${prefix} ${message}`, ...args);
    },
    warn(message: string, ...args: unknown[]): void {
      console.warn(`${prefix} ${message}`, ...args);
    },
    error(message: string, ...args: unknown[]): void {
      console.error(`${prefix} ${message}`, ...args);
    },
  };

  return {
    nodes,
    messages,
    settings,
    events,
    ui,
    storage,
    log,
  };
}
