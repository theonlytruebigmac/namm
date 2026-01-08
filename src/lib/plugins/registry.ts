/**
 * Plugin Registry
 *
 * Central registry for managing plugin lifecycle and state
 */

import type {
  Plugin,
  PluginAPI,
  PluginRegistry,
  PluginState,
  RegisteredPlugin,
} from './types';
import { createPluginAPI } from './api';

/**
 * Create a plugin registry instance
 */
export function createPluginRegistry(): PluginRegistry {
  const plugins = new Map<string, RegisteredPlugin>();
  const apis = new Map<string, PluginAPI>();

  function getPluginAPI(pluginId: string): PluginAPI {
    let api = apis.get(pluginId);
    if (!api) {
      api = createPluginAPI(pluginId);
      apis.set(pluginId, api);
    }
    return api;
  }

  function updateState(pluginId: string, state: PluginState, error?: Error): void {
    const registered = plugins.get(pluginId);
    if (registered) {
      registered.state = state;
      registered.error = error;
      if (state === 'loaded') {
        registered.loadedAt = new Date();
      }
      if (state === 'active') {
        registered.activatedAt = new Date();
      }
    }
  }

  return {
    register(plugin: Plugin): void {
      const id = plugin.metadata.id;

      if (plugins.has(id)) {
        throw new Error(`Plugin with id "${id}" is already registered`);
      }

      plugins.set(id, {
        plugin,
        state: 'unloaded',
      });

      console.log(`[Plugins] Registered: ${plugin.metadata.name} v${plugin.metadata.version}`);
    },

    unregister(pluginId: string): void {
      const registered = plugins.get(pluginId);
      if (!registered) {
        return;
      }

      if (registered.state === 'active') {
        throw new Error(`Cannot unregister active plugin "${pluginId}". Deactivate first.`);
      }

      plugins.delete(pluginId);
      apis.delete(pluginId);

      console.log(`[Plugins] Unregistered: ${pluginId}`);
    },

    get(pluginId: string): RegisteredPlugin | undefined {
      return plugins.get(pluginId);
    },

    getAll(): RegisteredPlugin[] {
      return Array.from(plugins.values());
    },

    async activate(pluginId: string): Promise<void> {
      const registered = plugins.get(pluginId);
      if (!registered) {
        throw new Error(`Plugin "${pluginId}" not found`);
      }

      if (registered.state === 'active') {
        return; // Already active
      }

      const api = getPluginAPI(pluginId);
      const { plugin } = registered;

      try {
        // Load phase
        if (registered.state === 'unloaded') {
          if (plugin.onLoad) {
            await plugin.onLoad(api);
          }
          updateState(pluginId, 'loaded');
        }

        // Activate phase
        if (plugin.onActivate) {
          await plugin.onActivate(api);
        }
        updateState(pluginId, 'active');

        console.log(`[Plugins] Activated: ${plugin.metadata.name}`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        updateState(pluginId, 'error', err);
        console.error(`[Plugins] Failed to activate ${pluginId}:`, err);
        throw err;
      }
    },

    async deactivate(pluginId: string): Promise<void> {
      const registered = plugins.get(pluginId);
      if (!registered) {
        throw new Error(`Plugin "${pluginId}" not found`);
      }

      if (registered.state !== 'active') {
        return; // Not active
      }

      const api = getPluginAPI(pluginId);
      const { plugin } = registered;

      try {
        if (plugin.onDeactivate) {
          await plugin.onDeactivate(api);
        }
        updateState(pluginId, 'loaded');

        console.log(`[Plugins] Deactivated: ${plugin.metadata.name}`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        updateState(pluginId, 'error', err);
        console.error(`[Plugins] Failed to deactivate ${pluginId}:`, err);
        throw err;
      }
    },

    isActive(pluginId: string): boolean {
      const registered = plugins.get(pluginId);
      return registered?.state === 'active';
    },
  };
}

// Singleton registry instance
let registryInstance: PluginRegistry | null = null;

/**
 * Get the global plugin registry instance
 */
export function getPluginRegistry(): PluginRegistry {
  if (!registryInstance) {
    registryInstance = createPluginRegistry();
  }
  return registryInstance;
}

/**
 * Reset the registry (mainly for testing)
 */
export function resetPluginRegistry(): void {
  registryInstance = null;
}
