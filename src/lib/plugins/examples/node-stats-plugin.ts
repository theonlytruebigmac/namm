/**
 * Node Stats Plugin
 *
 * Example plugin that tracks node statistics and provides a dashboard widget
 */

import type { Plugin, PluginAPI, NodeInfo } from '../types';

interface NodeStats {
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  nodesWithGPS: number;
  lastUpdated: Date;
}

/**
 * Create a node statistics plugin
 */
export function createNodeStatsPlugin(): Plugin {
  let stats: NodeStats = {
    totalNodes: 0,
    onlineNodes: 0,
    offlineNodes: 0,
    nodesWithGPS: 0,
    lastUpdated: new Date(),
  };

  let unsubscribe: (() => void) | null = null;

  function calculateStats(nodes: NodeInfo[]): NodeStats {
    const now = Date.now();
    const ONLINE_THRESHOLD = 15 * 60 * 1000; // 15 minutes

    let onlineCount = 0;
    let gpsCount = 0;

    for (const node of nodes) {
      // Check if online (has been seen recently)
      const lastHeard = node.lastHeard;
      if (lastHeard && (now - lastHeard * 1000) < ONLINE_THRESHOLD) {
        onlineCount++;
      }

      // Check if has GPS position
      if (node.position?.latitude && node.position?.longitude) {
        gpsCount++;
      }
    }

    return {
      totalNodes: nodes.length,
      onlineNodes: onlineCount,
      offlineNodes: nodes.length - onlineCount,
      nodesWithGPS: gpsCount,
      lastUpdated: new Date(),
    };
  }

  return {
    metadata: {
      id: 'namm-node-stats',
      name: 'Node Statistics',
      version: '1.0.0',
      description: 'Tracks and displays node statistics including online/offline counts and GPS availability',
      author: 'NAMM Team',
      category: 'analysis',
    },

    onLoad(api: PluginAPI) {
      api.log.info('Node Stats plugin loaded');
    },

    onActivate(api: PluginAPI) {
      // Calculate initial stats
      const nodes = api.nodes.getAll();
      stats = calculateStats(nodes);

      // Subscribe to node updates
      unsubscribe = api.events.onNodeUpdate(() => {
        const updatedNodes = api.nodes.getAll();
        stats = calculateStats(updatedNodes);
        api.log.debug('Stats updated', stats);
      });

      // Show activation notification
      api.ui.showToast('Node Statistics plugin activated', 'success');

      api.log.info('Node Stats plugin activated');
    },

    onDeactivate(api: PluginAPI) {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      api.log.info('Node Stats plugin deactivated');
    },

    settingsSchema: {
      version: 1,
      fields: [
        {
          key: 'onlineThreshold',
          type: 'number',
          label: 'Online Threshold (minutes)',
          description: 'Consider a node offline if not seen within this time',
          defaultValue: 15,
          validation: {
            min: 1,
            max: 60,
          },
        },
        {
          key: 'showOfflineNodes',
          type: 'boolean',
          label: 'Show Offline Count',
          description: 'Display the count of offline nodes',
          defaultValue: true,
        },
      ],
    },

    contributions: {
      // Widgets are registered separately during activation
      // This is a declaration of what the plugin provides
    },
  };
}

// Export current stats for the widget
export function getNodeStats(): NodeStats {
  // This would normally be managed by the plugin instance
  // For now, return placeholder
  return {
    totalNodes: 0,
    onlineNodes: 0,
    offlineNodes: 0,
    nodesWithGPS: 0,
    lastUpdated: new Date(),
  };
}
