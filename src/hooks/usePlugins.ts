'use client';

/**
 * usePlugins Hook
 *
 * React hook for managing plugins in components
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getPluginRegistry,
  getPluginLoader,
  type RegisteredPlugin,
  type PluginLoaderConfig,
} from '@/lib/plugins';

interface UsePluginsResult {
  plugins: RegisteredPlugin[];
  activePlugins: RegisteredPlugin[];
  isLoading: boolean;
  error: Error | null;
  activatePlugin: (pluginId: string) => Promise<void>;
  deactivatePlugin: (pluginId: string) => Promise<void>;
  refreshPlugins: () => void;
}

/**
 * Hook for managing plugins
 */
export function usePlugins(config?: PluginLoaderConfig): UsePluginsResult {
  const [plugins, setPlugins] = useState<RegisteredPlugin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshPlugins = useCallback(() => {
    try {
      const registry = getPluginRegistry();
      setPlugins(registry.getAll());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  useEffect(() => {
    // Initialize loader with config
    getPluginLoader(config);

    // Get initial plugins
    refreshPlugins();
    setIsLoading(false);

    // Set up interval to refresh plugins periodically
    const interval = setInterval(refreshPlugins, 5000);

    return () => clearInterval(interval);
  }, [config, refreshPlugins]);

  const activatePlugin = useCallback(async (pluginId: string) => {
    try {
      const loader = getPluginLoader();
      await loader.activatePlugin(pluginId);
      refreshPlugins();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [refreshPlugins]);

  const deactivatePlugin = useCallback(async (pluginId: string) => {
    try {
      const loader = getPluginLoader();
      await loader.deactivatePlugin(pluginId);
      refreshPlugins();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [refreshPlugins]);

  const activePlugins = plugins.filter(p => p.state === 'active');

  return {
    plugins,
    activePlugins,
    isLoading,
    error,
    activatePlugin,
    deactivatePlugin,
    refreshPlugins,
  };
}

export default usePlugins;
