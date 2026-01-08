/**
 * Plugin Loader
 *
 * Handles dynamic loading and initialization of plugins
 */

import type { Plugin, PluginRegistry } from './types';
import { getPluginRegistry } from './registry';

/**
 * Plugin loader configuration
 */
export interface PluginLoaderConfig {
  /** Auto-activate plugins on load */
  autoActivate?: boolean;
  /** Enable plugins that were previously enabled */
  restoreState?: boolean;
}

const ENABLED_PLUGINS_KEY = 'enabled-plugins';

/**
 * Get list of previously enabled plugins from localStorage
 */
function getEnabledPlugins(): string[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const saved = localStorage.getItem(ENABLED_PLUGINS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

/**
 * Save list of enabled plugins to localStorage
 */
function saveEnabledPlugins(pluginIds: string[]): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(ENABLED_PLUGINS_KEY, JSON.stringify(pluginIds));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Plugin Loader class
 */
export class PluginLoader {
  private registry: PluginRegistry;
  private config: PluginLoaderConfig;
  private loadedPlugins: Set<string> = new Set();

  constructor(config: PluginLoaderConfig = {}) {
    this.registry = getPluginRegistry();
    this.config = {
      autoActivate: false,
      restoreState: true,
      ...config,
    };
  }

  /**
   * Load a plugin
   */
  async loadPlugin(plugin: Plugin): Promise<void> {
    const { id } = plugin.metadata;

    if (this.loadedPlugins.has(id)) {
      console.warn(`[PluginLoader] Plugin "${id}" already loaded`);
      return;
    }

    // Register the plugin
    this.registry.register(plugin);
    this.loadedPlugins.add(id);

    // Check if should auto-activate
    const shouldActivate = this.config.autoActivate ||
      (this.config.restoreState && getEnabledPlugins().includes(id));

    if (shouldActivate) {
      await this.activatePlugin(id);
    }
  }

  /**
   * Load multiple plugins
   */
  async loadPlugins(plugins: Plugin[]): Promise<void> {
    for (const plugin of plugins) {
      await this.loadPlugin(plugin);
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    if (!this.loadedPlugins.has(pluginId)) {
      return;
    }

    // Deactivate first if active
    if (this.registry.isActive(pluginId)) {
      await this.deactivatePlugin(pluginId);
    }

    // Unregister
    this.registry.unregister(pluginId);
    this.loadedPlugins.delete(pluginId);
  }

  /**
   * Activate a plugin
   */
  async activatePlugin(pluginId: string): Promise<void> {
    await this.registry.activate(pluginId);

    // Update enabled plugins list
    const enabled = getEnabledPlugins();
    if (!enabled.includes(pluginId)) {
      enabled.push(pluginId);
      saveEnabledPlugins(enabled);
    }
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(pluginId: string): Promise<void> {
    await this.registry.deactivate(pluginId);

    // Update enabled plugins list
    const enabled = getEnabledPlugins();
    const index = enabled.indexOf(pluginId);
    if (index >= 0) {
      enabled.splice(index, 1);
      saveEnabledPlugins(enabled);
    }
  }

  /**
   * Get all loaded plugin IDs
   */
  getLoadedPlugins(): string[] {
    return Array.from(this.loadedPlugins);
  }

  /**
   * Check if a plugin is loaded
   */
  isLoaded(pluginId: string): boolean {
    return this.loadedPlugins.has(pluginId);
  }
}

// Singleton loader instance
let loaderInstance: PluginLoader | null = null;

/**
 * Get the global plugin loader instance
 */
export function getPluginLoader(config?: PluginLoaderConfig): PluginLoader {
  if (!loaderInstance) {
    loaderInstance = new PluginLoader(config);
  }
  return loaderInstance;
}

/**
 * Reset the plugin loader (mainly for testing)
 */
export function resetPluginLoader(): void {
  loaderInstance = null;
}
