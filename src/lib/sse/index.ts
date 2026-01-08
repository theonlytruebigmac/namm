/**
 * SSE Module Exports
 *
 * Provides Server-Sent Events broadcasting for real-time updates
 */

import { SSEBroadcaster } from './broadcaster';

// Global singleton for SSE broadcaster
declare global {
  // eslint-disable-next-line no-var
  var __sseBroadcaster: SSEBroadcaster | null;
}

globalThis.__sseBroadcaster = globalThis.__sseBroadcaster || null;

/**
 * Get or create SSE broadcaster singleton
 */
export function getSSEBroadcaster(): SSEBroadcaster {
  if (!globalThis.__sseBroadcaster) {
    console.log('[SSE] Initializing broadcaster...');
    globalThis.__sseBroadcaster = new SSEBroadcaster();
  }
  return globalThis.__sseBroadcaster;
}

/**
 * Get SSE broadcaster stats
 */
export function getSSEStats() {
  if (!globalThis.__sseBroadcaster) {
    return {
      initialized: false,
      clients: 0
    };
  }
  return {
    initialized: true,
    ...globalThis.__sseBroadcaster.getStats()
  };
}

/**
 * Shutdown SSE broadcaster
 */
export function shutdownSSE(): void {
  if (globalThis.__sseBroadcaster) {
    globalThis.__sseBroadcaster.shutdown();
    globalThis.__sseBroadcaster = null;
  }
}

export { SSEBroadcaster } from './broadcaster';
export type { SSEEvent, SSEEventType } from './broadcaster';
