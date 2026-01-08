'use client';

/**
 * Node Stats Widget Component
 *
 * Displays node statistics in a dashboard widget
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PluginWidgetProps } from '../types';

interface Stats {
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  nodesWithGPS: number;
}

export default function NodeStatsWidget({ api }: PluginWidgetProps) {
  const [stats, setStats] = useState<Stats>({
    totalNodes: 0,
    onlineNodes: 0,
    offlineNodes: 0,
    nodesWithGPS: 0,
  });

  const showOffline = api.settings.get('showOfflineNodes', true);
  const threshold = api.settings.get('onlineThreshold', 15);

  useEffect(() => {
    function calculateStats() {
      const nodes = api.nodes.getAll();
      const now = Date.now();
      const thresholdMs = (threshold as number) * 60 * 1000;

      let online = 0;
      let gps = 0;

      for (const node of nodes) {
        const lastHeard = node.lastHeard;
        if (lastHeard && (now - lastHeard * 1000) < thresholdMs) {
          online++;
        }
        if (node.position?.latitude && node.position?.longitude) {
          gps++;
        }
      }

      setStats({
        totalNodes: nodes.length,
        onlineNodes: online,
        offlineNodes: nodes.length - online,
        nodesWithGPS: gps,
      });
    }

    // Initial calculation
    calculateStats();

    // Subscribe to updates
    const unsubscribe = api.events.onNodeUpdate(() => {
      calculateStats();
    });

    return unsubscribe;
  }, [api, threshold]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Network Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-2xl font-bold">{stats.totalNodes}</p>
            <p className="text-xs text-muted-foreground">Total Nodes</p>
          </div>

          <div className="space-y-1">
            <p className="text-2xl font-bold text-green-500">{stats.onlineNodes}</p>
            <p className="text-xs text-muted-foreground">Online</p>
          </div>

          {showOffline && (
            <div className="space-y-1">
              <p className="text-2xl font-bold text-red-500">{stats.offlineNodes}</p>
              <p className="text-xs text-muted-foreground">Offline</p>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-2xl font-bold text-blue-500">{stats.nodesWithGPS}</p>
            <p className="text-xs text-muted-foreground">With GPS</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
