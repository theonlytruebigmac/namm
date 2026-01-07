/**
 * WebSocket Connection Manager
 *
 * Manages WebSocket client connections, heartbeats, and subscriptions
 */

import type { WebSocket } from 'ws';
import type {
  ConnectionState,
  SubscriptionFilter,
  WSClientMessage,
  WSServerMessage
} from './protocol';
import { compressIfNeeded } from '@/lib/utils/compression';

export class ConnectionManager {
  private connections = new Map<string, WebSocket>();
  private states = new Map<string, ConnectionState>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private heartbeatMs: number = 30000,
    private timeoutMs: number = 60000
  ) {
    this.startHeartbeat();
    this.startCleanup();
  }

  /**
   * Add a new connection
   */
  add(id: string, ws: WebSocket): void {
    this.connections.set(id, ws);
    this.states.set(id, {
      id,
      connectedAt: Date.now(),
      lastPing: Date.now(),
      messagesSent: 0,
      bytesTransmitted: 0
    });

    // Set up message handler
    ws.on('message', (data) => {
      this.handleClientMessage(id, data.toString());
    });

    // Set up close handler
    ws.on('close', (code, reason) => {
      console.log(`[WS Close] Connection ${id} closed with code=${code}, reason="${reason?.toString() || 'none'}"`);
      this.remove(id);
    });

    // Set up error handler
    ws.on('error', (error) => {
      console.error(`WebSocket error for ${id}:`, error);
      this.remove(id);
    });

    console.log(`WebSocket connection added: ${id}`);
  }

  /**
   * Remove a connection
   */
  remove(id: string): void {
    const ws = this.connections.get(id);
    if (ws) {
      ws.close();
      this.connections.delete(id);
      this.states.delete(id);
      console.log(`WebSocket connection removed: ${id}`);
    }
  }

  /**
   * Get a connection
   */
  get(id: string): WebSocket | undefined {
    return this.connections.get(id);
  }

  /**
   * Get connection state
   */
  getState(id: string): ConnectionState | undefined {
    return this.states.get(id);
  }

  /**
   * Get all connection IDs
   */
  getConnectionIds(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Get count of active connections
   */
  getCount(): number {
    return this.connections.size;
  }

  /**
   * Send message to specific connection
   * Note: Compression disabled - browser client doesn't support gzip decompression
   */
  send(id: string, message: WSServerMessage, useCompression: boolean = false): boolean {
    const ws = this.connections.get(id);
    const state = this.states.get(id);

    if (!ws || !state) return false;
    if (ws.readyState !== ws.OPEN) {
      console.log(`[WS Send] Connection ${id} not open (readyState: ${ws.readyState})`);
      return false;
    }

    try {
      const payload = JSON.stringify(message);
      console.log(`[WS Send] Sending ${payload.length} bytes to ${id} (type: ${message.type})`);

      // Always send as text for browser compatibility
      ws.send(payload, (err) => {
        if (err) {
          console.error(`[WS Send] Error in send callback for ${id}:`, err);
        } else {
          console.log(`[WS Send] Successfully sent ${payload.length} bytes to ${id}`);
        }
      });
      state.bytesTransmitted += payload.length;

      // Update stats
      state.messagesSent++;

      return true;
    } catch (error) {
      console.error(`Error sending to ${id}:`, error);
      return false;
    }
  }

  /**
   * Broadcast message to all connections (or filtered subset)
   */
  broadcast(
    message: WSServerMessage,
    options?: {
      excludeId?: string;
      filterFn?: (state: ConnectionState) => boolean;
    }
  ): number {
    let sent = 0;

    for (const [id, ws] of this.connections) {
      // Skip excluded connection
      if (options?.excludeId === id) continue;

      // Apply filter if provided
      const state = this.states.get(id);
      if (options?.filterFn && state && !options.filterFn(state)) {
        continue;
      }

      // Send message
      if (this.send(id, message)) {
        sent++;
      }
    }

    return sent;
  }

  /**
   * Update connection filter/subscription
   */
  updateFilter(id: string, filter?: SubscriptionFilter): void {
    const state = this.states.get(id);
    if (state) {
      state.filter = filter;
    }
  }

  /**
   * Handle incoming client message
   */
  private handleClientMessage(id: string, data: string): void {
    try {
      const message = JSON.parse(data) as WSClientMessage;
      const state = this.states.get(id);
      if (!state) return;

      switch (message.type) {
        case 'ping':
          state.lastPing = Date.now();
          this.send(id, { type: 'pong', timestamp: Date.now() });
          break;

        case 'subscribe':
          this.updateFilter(id, message.filter);
          break;

        case 'unsubscribe':
          this.updateFilter(id, undefined);
          break;

        case 'request_snapshot':
          // Will be handled by broadcaster
          break;
      }
    } catch (error) {
      console.error(`Error parsing client message from ${id}:`, error);
    }
  }

  /**
   * Start heartbeat timer
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();

      for (const [id, state] of this.states) {
        // Check if connection is stale
        if (now - state.lastPing > this.timeoutMs) {
          console.log(`Connection ${id} timed out`);
          this.remove(id);
          continue;
        }

        // Send ping
        this.send(id, { type: 'pong', timestamp: now });
      }
    }, this.heartbeatMs);
  }

  /**
   * Start cleanup timer
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      // Remove dead connections
      for (const [id, ws] of this.connections) {
        if (ws.readyState === ws.CLOSED || ws.readyState === ws.CLOSING) {
          this.remove(id);
        }
      }
    }, 60000); // Clean up every minute
  }

  /**
   * Stop timers
   */
  private stopTimers(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const states = Array.from(this.states.values());
    const totalMessages = states.reduce((sum, s) => sum + s.messagesSent, 0);
    const totalBytes = states.reduce((sum, s) => sum + s.bytesTransmitted, 0);

    return {
      connections: this.connections.size,
      totalMessagesSent: totalMessages,
      totalBytesTransmitted: totalBytes,
      avgMessagesPerConnection: states.length > 0 ? totalMessages / states.length : 0,
      avgBytesPerConnection: states.length > 0 ? totalBytes / states.length : 0
    };
  }

  /**
   * Shutdown and close all connections
   */
  shutdown(): void {
    console.log('Shutting down connection manager...');
    this.stopTimers();

    for (const [id, ws] of this.connections) {
      try {
        ws.close();
      } catch (error) {
        console.error(`Error closing connection ${id}:`, error);
      }
    }

    this.connections.clear();
    this.states.clear();
    console.log('Connection manager shutdown complete');
  }
}
