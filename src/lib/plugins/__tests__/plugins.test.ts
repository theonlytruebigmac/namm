/**
 * Plugin System Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createPluginRegistry,
  resetPluginRegistry,
  type Plugin,
  type PluginAPI,
} from '../index';

// Mock plugin for testing
function createMockPlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    metadata: {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'A test plugin',
      author: 'Test Author',
      category: 'other',
      ...overrides.metadata,
    },
    onLoad: vi.fn(),
    onActivate: vi.fn(),
    onDeactivate: vi.fn(),
    onUnload: vi.fn(),
    ...overrides,
  };
}

describe('Plugin Registry', () => {
  beforeEach(() => {
    resetPluginRegistry();
  });

  describe('register', () => {
    it('should register a plugin', () => {
      const registry = createPluginRegistry();
      const plugin = createMockPlugin();

      registry.register(plugin);

      const registered = registry.get('test-plugin');
      expect(registered).toBeDefined();
      expect(registered?.plugin).toBe(plugin);
      expect(registered?.state).toBe('unloaded');
    });

    it('should throw when registering duplicate plugin', () => {
      const registry = createPluginRegistry();
      const plugin = createMockPlugin();

      registry.register(plugin);

      expect(() => registry.register(plugin)).toThrow('already registered');
    });
  });

  describe('unregister', () => {
    it('should unregister a plugin', () => {
      const registry = createPluginRegistry();
      const plugin = createMockPlugin();

      registry.register(plugin);
      registry.unregister('test-plugin');

      expect(registry.get('test-plugin')).toBeUndefined();
    });

    it('should throw when unregistering active plugin', async () => {
      const registry = createPluginRegistry();
      const plugin = createMockPlugin();

      registry.register(plugin);
      await registry.activate('test-plugin');

      expect(() => registry.unregister('test-plugin')).toThrow('Deactivate first');
    });
  });

  describe('activate', () => {
    it('should activate a plugin', async () => {
      const registry = createPluginRegistry();
      const plugin = createMockPlugin();

      registry.register(plugin);
      await registry.activate('test-plugin');

      const registered = registry.get('test-plugin');
      expect(registered?.state).toBe('active');
      expect(plugin.onLoad).toHaveBeenCalled();
      expect(plugin.onActivate).toHaveBeenCalled();
    });

    it('should pass API to lifecycle hooks', async () => {
      const registry = createPluginRegistry();
      let capturedApi: PluginAPI | null = null;

      const plugin = createMockPlugin({
        onLoad: (api) => {
          capturedApi = api;
        },
      });

      registry.register(plugin);
      await registry.activate('test-plugin');

      expect(capturedApi).not.toBeNull();
      // Use non-null assertion after the check
      const api = capturedApi!;
      expect(api.nodes).toBeDefined();
      expect(api.messages).toBeDefined();
      expect(api.settings).toBeDefined();
      expect(api.events).toBeDefined();
      expect(api.ui).toBeDefined();
      expect(api.storage).toBeDefined();
      expect(api.log).toBeDefined();
    });

    it('should handle activation errors', async () => {
      const registry = createPluginRegistry();
      const plugin = createMockPlugin({
        onActivate: () => {
          throw new Error('Activation failed');
        },
      });

      registry.register(plugin);

      await expect(registry.activate('test-plugin')).rejects.toThrow('Activation failed');

      const registered = registry.get('test-plugin');
      expect(registered?.state).toBe('error');
      expect(registered?.error?.message).toBe('Activation failed');
    });

    it('should throw for unknown plugin', async () => {
      const registry = createPluginRegistry();

      await expect(registry.activate('unknown')).rejects.toThrow('not found');
    });
  });

  describe('deactivate', () => {
    it('should deactivate a plugin', async () => {
      const registry = createPluginRegistry();
      const plugin = createMockPlugin();

      registry.register(plugin);
      await registry.activate('test-plugin');
      await registry.deactivate('test-plugin');

      const registered = registry.get('test-plugin');
      expect(registered?.state).toBe('loaded');
      expect(plugin.onDeactivate).toHaveBeenCalled();
    });

    it('should handle deactivation errors', async () => {
      const registry = createPluginRegistry();
      const plugin = createMockPlugin({
        onDeactivate: () => {
          throw new Error('Deactivation failed');
        },
      });

      registry.register(plugin);
      await registry.activate('test-plugin');

      await expect(registry.deactivate('test-plugin')).rejects.toThrow('Deactivation failed');

      const registered = registry.get('test-plugin');
      expect(registered?.state).toBe('error');
    });
  });

  describe('getAll', () => {
    it('should return all registered plugins', () => {
      const registry = createPluginRegistry();

      registry.register(createMockPlugin({ metadata: { id: 'plugin-1', name: 'Plugin 1', version: '1.0.0', description: 'Test', author: 'Test' } }));
      registry.register(createMockPlugin({ metadata: { id: 'plugin-2', name: 'Plugin 2', version: '1.0.0', description: 'Test', author: 'Test' } }));
      registry.register(createMockPlugin({ metadata: { id: 'plugin-3', name: 'Plugin 3', version: '1.0.0', description: 'Test', author: 'Test' } }));

      const all = registry.getAll();
      expect(all).toHaveLength(3);
    });
  });

  describe('isActive', () => {
    it('should return true for active plugins', async () => {
      const registry = createPluginRegistry();
      const plugin = createMockPlugin();

      registry.register(plugin);

      expect(registry.isActive('test-plugin')).toBe(false);

      await registry.activate('test-plugin');

      expect(registry.isActive('test-plugin')).toBe(true);
    });

    it('should return false for unknown plugins', () => {
      const registry = createPluginRegistry();

      expect(registry.isActive('unknown')).toBe(false);
    });
  });
});

describe('Plugin API', () => {
  beforeEach(() => {
    resetPluginRegistry();
  });

  describe('settings', () => {
    it('should get and set plugin settings', async () => {
      const registry = createPluginRegistry();
      let api: PluginAPI | null = null;

      const plugin = createMockPlugin({
        onActivate: (pluginApi) => {
          api = pluginApi;
        },
      });

      registry.register(plugin);
      await registry.activate('test-plugin');

      expect(api).not.toBeNull();
      const settings = api!.settings;

      // Default value
      expect(settings.get('key', 'default')).toBe('default');

      // Set value
      settings.set('key', 'value');
      expect(settings.get('key', 'default')).toBe('value');
    });
  });

  describe('log', () => {
    it('should log messages with plugin prefix', async () => {
      const registry = createPluginRegistry();
      let api: PluginAPI | null = null;

      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      const plugin = createMockPlugin({
        onActivate: (pluginApi) => {
          api = pluginApi;
          pluginApi.log.info('Test message');
        },
      });

      registry.register(plugin);
      await registry.activate('test-plugin');

      expect(consoleSpy).toHaveBeenCalledWith('[Plugin:test-plugin] Test message');

      consoleSpy.mockRestore();
    });
  });

  describe('storage', () => {
    it('should get and set storage values', async () => {
      const registry = createPluginRegistry();
      let api: PluginAPI | null = null;

      const plugin = createMockPlugin({
        onActivate: (pluginApi) => {
          api = pluginApi;
        },
      });

      registry.register(plugin);
      await registry.activate('test-plugin');

      expect(api).not.toBeNull();
      const storage = api!.storage;

      // Initially undefined
      expect(storage.get('data')).toBeUndefined();

      // Set value
      storage.set('data', { foo: 'bar' });
      expect(storage.get('data')).toEqual({ foo: 'bar' });

      // Remove value
      storage.remove('data');
      expect(storage.get('data')).toBeUndefined();
    });
  });
});
