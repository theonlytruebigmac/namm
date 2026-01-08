/**
 * Collaboration Session Manager
 *
 * Manages collaboration sessions and user state
 */

import {
  type CollaborationSession,
  type CollaborationUser,
  type SessionSettings,
  type UserPresence,
  type SharedAnnotation,
  type SharedView,
  type CollaborationEvent,
  type CollaborationEventHandler,
  DEFAULT_SESSION_SETTINGS,
  getUserColor,
  generateInviteCode,
} from './types';

/**
 * Session manager class
 */
export class SessionManager {
  private session: CollaborationSession | null = null;
  private currentUser: CollaborationUser | null = null;
  private users: Map<string, CollaborationUser> = new Map();
  private presences: Map<string, UserPresence> = new Map();
  private annotations: Map<string, SharedAnnotation> = new Map();
  private eventHandlers: Set<CollaborationEventHandler> = new Set();
  private presenceInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Create a new collaboration session
   */
  createSession(
    name: string,
    userId: string,
    userName: string,
    settings?: Partial<SessionSettings>
  ): CollaborationSession {
    const sessionId = this.generateId();
    const now = new Date();

    // Create current user
    this.currentUser = {
      id: userId,
      name: userName,
      color: getUserColor(0),
      joinedAt: now,
      lastActiveAt: now,
      status: 'online',
    };

    // Create session
    this.session = {
      id: sessionId,
      name,
      ownerId: userId,
      users: [this.currentUser],
      settings: { ...DEFAULT_SESSION_SETTINGS, ...settings },
      createdAt: now,
      inviteCode: generateInviteCode(),
    };

    // Store user
    this.users.set(userId, this.currentUser);

    // Start presence updates
    this.startPresenceUpdates();

    console.log(`[Collaboration] Created session: ${name} (${sessionId})`);

    return this.session;
  }

  /**
   * Join an existing session
   */
  joinSession(
    session: CollaborationSession,
    userId: string,
    userName: string
  ): CollaborationUser {
    const userIndex = session.users.length;
    const now = new Date();

    // Create current user
    this.currentUser = {
      id: userId,
      name: userName,
      color: getUserColor(userIndex),
      joinedAt: now,
      lastActiveAt: now,
      status: 'online',
    };

    // Update session
    this.session = {
      ...session,
      users: [...session.users, this.currentUser],
    };

    // Store all users
    for (const user of this.session.users) {
      this.users.set(user.id, user);
    }

    // Emit join event
    this.emit({ type: 'user-joined', user: this.currentUser });

    // Start presence updates
    this.startPresenceUpdates();

    console.log(`[Collaboration] Joined session: ${session.name}`);

    return this.currentUser;
  }

  /**
   * Leave the current session
   */
  leaveSession(): void {
    if (!this.session || !this.currentUser) {
      return;
    }

    const userId = this.currentUser.id;

    // Emit leave event
    this.emit({ type: 'user-left', userId });

    // Stop presence updates
    this.stopPresenceUpdates();

    // Clear state
    this.session = null;
    this.currentUser = null;
    this.users.clear();
    this.presences.clear();
    this.annotations.clear();

    console.log(`[Collaboration] Left session`);
  }

  /**
   * Get current session
   */
  getSession(): CollaborationSession | null {
    return this.session;
  }

  /**
   * Get current user
   */
  getCurrentUser(): CollaborationUser | null {
    return this.currentUser;
  }

  /**
   * Get all users
   */
  getUsers(): CollaborationUser[] {
    return Array.from(this.users.values());
  }

  /**
   * Get user by ID
   */
  getUser(userId: string): CollaborationUser | undefined {
    return this.users.get(userId);
  }

  /**
   * Update user presence
   */
  updatePresence(presence: Partial<UserPresence>): void {
    if (!this.currentUser) {
      return;
    }

    const existing = this.presences.get(this.currentUser.id);
    const updated: UserPresence = {
      userId: this.currentUser.id,
      currentPage: presence.currentPage ?? existing?.currentPage ?? '/',
      selectedNodeId: presence.selectedNodeId ?? existing?.selectedNodeId,
      mapViewport: presence.mapViewport ?? existing?.mapViewport,
      cursorPosition: presence.cursorPosition ?? existing?.cursorPosition,
      updatedAt: new Date(),
    };

    this.presences.set(this.currentUser.id, updated);

    // Emit presence update
    this.emit({ type: 'presence-updated', presence: updated });

    // Update last active time
    this.currentUser.lastActiveAt = new Date();
  }

  /**
   * Get user presence
   */
  getPresence(userId: string): UserPresence | undefined {
    return this.presences.get(userId);
  }

  /**
   * Get all presences
   */
  getAllPresences(): Map<string, UserPresence> {
    return this.presences;
  }

  /**
   * Handle incoming presence from another user
   */
  handleRemotePresence(presence: UserPresence): void {
    this.presences.set(presence.userId, presence);

    // Update user's last active time
    const user = this.users.get(presence.userId);
    if (user) {
      user.lastActiveAt = new Date();
    }
  }

  /**
   * Create annotation
   */
  createAnnotation(
    annotation: Omit<SharedAnnotation, 'id' | 'createdAt' | 'updatedAt'>
  ): SharedAnnotation {
    const id = this.generateId();
    const now = new Date();

    const newAnnotation: SharedAnnotation = {
      ...annotation,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.annotations.set(id, newAnnotation);

    // Emit event
    this.emit({ type: 'annotation-created', annotation: newAnnotation });

    return newAnnotation;
  }

  /**
   * Update annotation
   */
  updateAnnotation(
    id: string,
    updates: Partial<SharedAnnotation>
  ): SharedAnnotation | null {
    const existing = this.annotations.get(id);
    if (!existing) {
      return null;
    }

    const updated: SharedAnnotation = {
      ...existing,
      ...updates,
      id: existing.id, // Preserve ID
      createdAt: existing.createdAt, // Preserve created time
      updatedAt: new Date(),
    };

    this.annotations.set(id, updated);

    // Emit event
    this.emit({ type: 'annotation-updated', annotation: updated });

    return updated;
  }

  /**
   * Delete annotation
   */
  deleteAnnotation(id: string): boolean {
    if (!this.annotations.has(id)) {
      return false;
    }

    this.annotations.delete(id);

    // Emit event
    this.emit({ type: 'annotation-deleted', annotationId: id });

    return true;
  }

  /**
   * Get all annotations
   */
  getAnnotations(): SharedAnnotation[] {
    return Array.from(this.annotations.values());
  }

  /**
   * Handle remote user joining
   */
  handleUserJoined(user: CollaborationUser): void {
    this.users.set(user.id, user);

    if (this.session) {
      this.session.users = Array.from(this.users.values());
    }
  }

  /**
   * Handle remote user leaving
   */
  handleUserLeft(userId: string): void {
    this.users.delete(userId);
    this.presences.delete(userId);

    if (this.session) {
      this.session.users = Array.from(this.users.values());
    }
  }

  /**
   * Handle remote annotation
   */
  handleRemoteAnnotation(annotation: SharedAnnotation): void {
    this.annotations.set(annotation.id, annotation);
  }

  /**
   * Handle remote annotation deletion
   */
  handleRemoteAnnotationDeleted(annotationId: string): void {
    this.annotations.delete(annotationId);
  }

  /**
   * Subscribe to events
   */
  subscribe(handler: CollaborationEventHandler): () => void {
    this.eventHandlers.add(handler);

    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Emit an event to all handlers
   */
  private emit(event: CollaborationEvent): void {
    this.eventHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (err) {
        console.error('[Collaboration] Event handler error:', err);
      }
    });
  }

  /**
   * Start periodic presence updates
   */
  private startPresenceUpdates(): void {
    // Update presence every 30 seconds to show activity
    this.presenceInterval = setInterval(() => {
      if (this.currentUser) {
        this.currentUser.lastActiveAt = new Date();
      }
    }, 30000);
  }

  /**
   * Stop presence updates
   */
  private stopPresenceUpdates(): void {
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Singleton instance
let sessionManagerInstance: SessionManager | null = null;

/**
 * Get the session manager instance
 */
export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}

/**
 * Reset session manager (for testing)
 */
export function resetSessionManager(): void {
  if (sessionManagerInstance) {
    sessionManagerInstance.leaveSession();
  }
  sessionManagerInstance = null;
}
