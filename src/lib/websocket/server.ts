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

let wsServer: WebSocketServer | null = null;
let connectionManager: ConnectionManager | null = null;
let broadcaster: Broadcaster | null = null;

/**
 * Initialize WebSocket server
 */
export function initWebSocketServer(server: any): void {
  if (wsServer) {
    console.log('WebSocket server already initialized');
    return;
  }

  console.log('Initializing WebSocket server...');

  // Create WebSocket server
  wsServer = new WebSocketServer({ noServer: true });

  // Create connection manager
  connectionManager = new ConnectionManager();

  // Create broadcaster
  broadcaster = new Broadcaster(connectionManager);

  // Handle upgrade requests
  server.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
    const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);

    if (pathname === '/api/ws') {
      wsServer!.handleUpgrade(request, socket, head, (ws) => {
        wsServer!.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Handle new connections
  wsServer.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    const connectionId = randomUUID();
    const clientIp = request.socket.remoteAddress || 'unknown';

    console.log(`New WebSocket connection: ${connectionId} from ${clientIp}`);

    // Add connection to manager
    connectionManager!.add(connectionId, ws);

    // Send initial snapshot
    broadcaster!.sendSnapshot(connectionId);

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
  return connectionManager;
}

/**
 * Get broadcaster instance
 */
export function getBroadcaster(): Broadcaster | null {
  return broadcaster;
}

/**
 * Get WebSocket server statistics
 */
export function getWebSocketStats() {
  if (!connectionManager || !broadcaster) {
    return {
      initialized: false,
      connections: 0
    };
  }

  return {
    initialized: true,
    connections: connectionManager.getCount(),
    connectionStats: connectionManager.getStats(),
    broadcasterStats: broadcaster.getStats()
  };
}

/**
 * Shutdown WebSocket server
 */
export function shutdownWebSocketServer(): void {
  if (!wsServer) return;

  console.log('Shutting down WebSocket server...');

  // Shutdown broadcaster
  if (broadcaster) {
    broadcaster.shutdown();
    broadcaster = null;
  }

  // Shutdown connection manager
  if (connectionManager) {
    connectionManager.shutdown();
    connectionManager = null;
  }

  // Close server
  wsServer.close(() => {
    console.log('WebSocket server closed');
  });

  wsServer = null;
}
