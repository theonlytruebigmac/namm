/**
 * Collaboration Broadcaster
 *
 * Broadcasts collaboration events via SSE to other users
 */

import type {
  CollaborationEvent,
  UserPresence,
  CollaborationUser,
  SharedAnnotation,
} from './types';

/**
 * Event types for SSE
 */
export type CollaborationSSEEvent =
  | 'collab:user-joined'
  | 'collab:user-left'
  | 'collab:presence'
  | 'collab:annotation'
  | 'collab:cursor';

/**
 * Subscriber for collaboration events
 */
interface CollaborationSubscriber {
  sessionId: string;
  userId: string;
  send: (event: string, data: unknown) => void;
}

/**
 * Collaboration Broadcaster
 */
class CollaborationBroadcaster {
  private subscribers: Map<string, CollaborationSubscriber[]> = new Map();
  private presenceBuffer: Map<string, UserPresence> = new Map();
  private cursorBuffer: Map<string, { userId: string; x: number; y: number }> = new Map();
  private broadcastInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start broadcast interval for batched updates
    this.startBroadcastInterval();
  }

  /**
   * Subscribe to a session
   */
  subscribe(
    sessionId: string,
    userId: string,
    send: (event: string, data: unknown) => void
  ): () => void {
    const subscriber: CollaborationSubscriber = { sessionId, userId, send };

    let sessionSubscribers = this.subscribers.get(sessionId);
    if (!sessionSubscribers) {
      sessionSubscribers = [];
      this.subscribers.set(sessionId, sessionSubscribers);
    }

    sessionSubscribers.push(subscriber);

    console.log(
      `[Collaboration] User ${userId} subscribed to session ${sessionId}`
    );

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(sessionId);
      if (subs) {
        const index = subs.findIndex((s) => s.userId === userId);
        if (index >= 0) {
          subs.splice(index, 1);
        }
        if (subs.length === 0) {
          this.subscribers.delete(sessionId);
        }
      }
      console.log(
        `[Collaboration] User ${userId} unsubscribed from session ${sessionId}`
      );
    };
  }

  /**
   * Broadcast user joined
   */
  broadcastUserJoined(sessionId: string, user: CollaborationUser): void {
    this.broadcast(sessionId, 'collab:user-joined', user, user.id);
  }

  /**
   * Broadcast user left
   */
  broadcastUserLeft(sessionId: string, userId: string): void {
    this.broadcast(sessionId, 'collab:user-left', { userId }, userId);
  }

  /**
   * Queue presence update (batched)
   */
  queuePresenceUpdate(sessionId: string, presence: UserPresence): void {
    const key = `${sessionId}:${presence.userId}`;
    this.presenceBuffer.set(key, presence);
  }

  /**
   * Queue cursor update (batched, high frequency)
   */
  queueCursorUpdate(
    sessionId: string,
    userId: string,
    x: number,
    y: number
  ): void {
    const key = `${sessionId}:${userId}`;
    this.cursorBuffer.set(key, { userId, x, y });
  }

  /**
   * Broadcast annotation created/updated
   */
  broadcastAnnotation(sessionId: string, annotation: SharedAnnotation): void {
    this.broadcast(sessionId, 'collab:annotation', annotation, annotation.createdBy);
  }

  /**
   * Broadcast annotation deleted
   */
  broadcastAnnotationDeleted(
    sessionId: string,
    annotationId: string,
    deletedBy: string
  ): void {
    this.broadcast(
      sessionId,
      'collab:annotation',
      { deleted: true, id: annotationId },
      deletedBy
    );
  }

  /**
   * Broadcast to all subscribers in a session except the sender
   */
  private broadcast(
    sessionId: string,
    event: string,
    data: unknown,
    excludeUserId?: string
  ): void {
    const subscribers = this.subscribers.get(sessionId);
    if (!subscribers) {
      return;
    }

    for (const subscriber of subscribers) {
      if (subscriber.userId !== excludeUserId) {
        try {
          subscriber.send(event, data);
        } catch (err) {
          console.error(
            `[Collaboration] Failed to send to ${subscriber.userId}:`,
            err
          );
        }
      }
    }
  }

  /**
   * Start the broadcast interval
   */
  private startBroadcastInterval(): void {
    // Broadcast batched updates every 50ms for smooth cursor movement
    this.broadcastInterval = setInterval(() => {
      this.flushBuffers();
    }, 50);
  }

  /**
   * Flush buffered updates
   */
  private flushBuffers(): void {
    // Group by session
    const presenceBySession = new Map<string, UserPresence[]>();
    const cursorsBySession = new Map<
      string,
      Array<{ userId: string; x: number; y: number }>
    >();

    // Group presence updates
    for (const [key, presence] of this.presenceBuffer) {
      const [sessionId] = key.split(':');
      let list = presenceBySession.get(sessionId);
      if (!list) {
        list = [];
        presenceBySession.set(sessionId, list);
      }
      list.push(presence);
    }
    this.presenceBuffer.clear();

    // Group cursor updates
    for (const [key, cursor] of this.cursorBuffer) {
      const [sessionId] = key.split(':');
      let list = cursorsBySession.get(sessionId);
      if (!list) {
        list = [];
        cursorsBySession.set(sessionId, list);
      }
      list.push(cursor);
    }
    this.cursorBuffer.clear();

    // Broadcast presence updates
    for (const [sessionId, presences] of presenceBySession) {
      for (const presence of presences) {
        this.broadcast(sessionId, 'collab:presence', presence, presence.userId);
      }
    }

    // Broadcast cursor updates
    for (const [sessionId, cursors] of cursorsBySession) {
      for (const cursor of cursors) {
        this.broadcast(sessionId, 'collab:cursor', cursor, cursor.userId);
      }
    }
  }

  /**
   * Get subscriber count for a session
   */
  getSubscriberCount(sessionId: string): number {
    return this.subscribers.get(sessionId)?.length ?? 0;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.subscribers.keys());
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
    this.subscribers.clear();
    this.presenceBuffer.clear();
    this.cursorBuffer.clear();
  }
}

// Singleton instance
let broadcasterInstance: CollaborationBroadcaster | null = null;

/**
 * Get the collaboration broadcaster instance
 */
export function getCollaborationBroadcaster(): CollaborationBroadcaster {
  if (!broadcasterInstance) {
    broadcasterInstance = new CollaborationBroadcaster();
  }
  return broadcasterInstance;
}

/**
 * Reset broadcaster (for testing)
 */
export function resetCollaborationBroadcaster(): void {
  if (broadcasterInstance) {
    broadcasterInstance.destroy();
  }
  broadcasterInstance = null;
}
