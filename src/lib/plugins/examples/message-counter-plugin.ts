/**
 * Message Counter Plugin
 *
 * Example plugin that counts messages and provides statistics
 */

import type { Plugin, PluginAPI, MessagePacket } from '../types';

interface MessageStats {
  totalMessages: number;
  messagesPerChannel: Map<number, number>;
  messagesPerNode: Map<string, number>;
  lastMessage: MessagePacket | null;
  messagesLast24h: number;
}

/**
 * Create a message counter plugin
 */
export function createMessageCounterPlugin(): Plugin {
  let stats: MessageStats = {
    totalMessages: 0,
    messagesPerChannel: new Map(),
    messagesPerNode: new Map(),
    lastMessage: null,
    messagesLast24h: 0,
  };

  let unsubscribe: (() => void) | null = null;
  let api: PluginAPI | null = null;

  function updateStats(messages: MessagePacket[]): void {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    const channelCounts = new Map<number, number>();
    const nodeCounts = new Map<string, number>();
    let last24h = 0;

    for (const msg of messages) {
      // Count by channel
      const channel = msg.channel ?? 0;
      channelCounts.set(channel, (channelCounts.get(channel) ?? 0) + 1);

      // Count by sender
      const sender = msg.from.toString();
      nodeCounts.set(sender, (nodeCounts.get(sender) ?? 0) + 1);

      // Count last 24h (use rxTime or timestamp)
      const msgTime = msg.rxTime ?? msg.timestamp;
      if (msgTime && msgTime * 1000 > dayAgo) {
        last24h++;
      }
    }

    stats = {
      totalMessages: messages.length,
      messagesPerChannel: channelCounts,
      messagesPerNode: nodeCounts,
      lastMessage: messages[messages.length - 1] ?? null,
      messagesLast24h: last24h,
    };
  }

  return {
    metadata: {
      id: 'namm-message-counter',
      name: 'Message Counter',
      version: '1.0.0',
      description: 'Counts and tracks message statistics across channels',
      author: 'NAMM Team',
      category: 'analysis',
    },

    onLoad(pluginApi: PluginAPI) {
      api = pluginApi;
      api.log.info('Message Counter plugin loaded');
    },

    onActivate(pluginApi: PluginAPI) {
      api = pluginApi;

      // Calculate initial stats
      const messages = api.messages.getAll();
      updateStats(messages);

      // Subscribe to new messages
      unsubscribe = api.events.onMessage((message: MessagePacket) => {
        const messages = api!.messages.getAll();
        updateStats(messages);

        // Check if should notify
        const notifyOnMilestone = api!.settings.get('notifyOnMilestone', true);
        if (notifyOnMilestone) {
          const total = stats.totalMessages;
          if (total % 100 === 0) {
            api!.ui.showToast(`📊 Milestone: ${total} messages received!`, 'info');
          }
        }

        api!.log.debug('New message received', { from: message.from, channel: message.channel });
      });

      api.ui.showToast('Message Counter plugin activated', 'success');
      api.log.info('Message Counter plugin activated', { initialCount: stats.totalMessages });
    },

    onDeactivate(pluginApi: PluginAPI) {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      pluginApi.log.info('Message Counter plugin deactivated');
    },

    settingsSchema: {
      version: 1,
      fields: [
        {
          key: 'notifyOnMilestone',
          type: 'boolean',
          label: 'Notify on Milestones',
          description: 'Show a notification when message count reaches milestones (100, 200, etc.)',
          defaultValue: true,
        },
        {
          key: 'trackChannels',
          type: 'boolean',
          label: 'Track Per-Channel Stats',
          description: 'Maintain separate statistics for each channel',
          defaultValue: true,
        },
        {
          key: 'retentionDays',
          type: 'number',
          label: 'Retention Period (days)',
          description: 'How many days of history to track',
          defaultValue: 7,
          validation: {
            min: 1,
            max: 30,
          },
        },
      ],
    },
  };
}

// Export for testing
export function getMessageStats(): MessageStats {
  return {
    totalMessages: 0,
    messagesPerChannel: new Map(),
    messagesPerNode: new Map(),
    lastMessage: null,
    messagesLast24h: 0,
  };
}
