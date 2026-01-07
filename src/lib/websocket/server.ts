/**
 * WebSocket Server
 *
 * Integrates with Next.js API routes to provide WebSocket support
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { ConnectionManager } from './connection-manager';
import { Broadcaster } from './broadcaster';
import { randomUUID } from 'crypto';

// Use global variables to ensure singleton across Next.js API routes
// This is necessary because Next.js can create multiple module instances
declare global {
  // eslint-disable-next-line no-var
  var __wsServer: WebSocketServer | null;
  // eslint-disable-next-line no-var
  var __connectionManager: ConnectionManager | null;
  // eslint-disable-next-line no-var
  var __broadcaster: Broadcaster | null;
}

globalThis.__wsServer = globalThis.__wsServer || null;
globalThis.__connectionManager = globalThis.__connectionManager || null;
globalThis.__broadcaster = globalThis.__broadcaster || null;

/**
 * Initialize WebSocket server
 */
export function initWebSocketServer(server: any): void {
  if (globalThis.__wsServer) {
    console.log('WebSocket server already initialized');
    return;
  }

  console.log('Initializing WebSocket server...');

  // Create WebSocket server
  globalThis.__wsServer = new WebSocketServer({ noServer: true });

  // Create connection manager
  globalThis.__connectionManager = new ConnectionManager();

  // Create broadcaster
  globalThis.__broadcaster = new Broadcaster(globalThis.__connectionManager);

  // Handle upgrade requests
  server.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
    const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);

    if (pathname === '/api/ws') {
      globalThis.__wsServer!.handleUpgrade(request, socket, head, (ws) => {
        globalThis.__wsServer!.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Handle new connections
  globalThis.__wsServer.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    const connectionId = randomUUID();
    const clientIp = request.socket.remoteAddress || 'unknown';

    console.log(`New WebSocket connection: ${connectionId} from ${clientIp}`);

    // Log readyState after connection
    console.log(`[WS Debug] Initial readyState for ${connectionId}: ${ws.readyState}`);

    // Add early error listener
    ws.on('error', (error) => {
      console.error(`[WS Debug] Early error for ${connectionId}:`, error);
    });

    // Add connection to manager
    globalThis.__connectionManager!.add(connectionId, ws);

    // Log readyState after adding to manager
    console.log(`[WS Debug] After add readyState for ${connectionId}: ${ws.readyState}`);

    // Send initial snapshot
    globalThis.__broadcaster!.sendSnapshot(connectionId);

    // Log readyState after snapshot
    console.log(`[WS Debug] After snapshot readyState for ${connectionId}: ${ws.readyState}`);

    // Handle client messages (handled by ConnectionManager)
  });

  // Graceful shutdown
  process.on('SIGTERM', shutdownWebSocketServer);
  process.on('SIGINT', shutdownWebSocketServer);

  console.log('WebSocket server initialized');
}

/**
 * Get connection manager instance
 */
export function getConnectionManager(): ConnectionManager | null {
  return globalThis.__connectionManager;
}

/**
 * Get broadcaster instance
 */
export function getBroadcaster(): Broadcaster | null {
  return globalThis.__broadcaster;
}

/**
 * Get WebSocket server statistics
 */
export function getWebSocketStats() {
  if (!globalThis.__connectionManager || !globalThis.__broadcaster) {
    return {
      initialized: false,
      connections: 0
    };
  }

  return {
    initialized: true,
    connections: globalThis.__connectionManager.getCount(),
    connectionStats: globalThis.__connectionManager.getStats(),
    broadcasterStats: globalThis.__broadcaster.getStats()
  };
}

/**
 * Shutdown WebSocket server
 */
export function shutdownWebSocketServer(): void {
  if (!globalThis.__wsServer) return;

  console.log('Shutting down WebSocket server...');

  // Shutdown broadcaster
  if (globalThis.__broadcaster) {
    globalThis.__broadcaster.shutdown();
    globalThis.__broadcaster = null;
  }

  // Shutdown connection manager
  if (globalThis.__connectionManager) {
    globalThis.__connectionManager.shutdown();
    globalThis.__connectionManager = null;
  }

  // Close server
  globalThis.__wsServer.close(() => {
    console.log('WebSocket server closed');
  });

  globalThis.__wsServer = null;
}
