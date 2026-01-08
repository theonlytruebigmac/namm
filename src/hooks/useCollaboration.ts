'use client';

/**
 * useCollaboration Hook
 *
 * React hook for multi-user collaboration features
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  getSessionManager,
  getCollaborationBroadcaster,
  type CollaborationSession,
  type CollaborationUser,
  type UserPresence,
  type SharedAnnotation,
  type CollaborationEvent,
  type SessionSettings,
} from '@/lib/collaboration';

interface UseCollaborationResult {
  /** Whether connected to a session */
  connected: boolean;

  /** Loading state */
  loading: boolean;

  /** Error message if any */
  error: string | null;

  /** Current session */
  session: CollaborationSession | null;

  /** Current user */
  currentUser: CollaborationUser | null;

  /** All users in session */
  users: CollaborationUser[];

  /** User presences */
  presences: Map<string, UserPresence>;

  /** User we're following */
  followingUser: CollaborationUser | null;

  /** Annotations */
  annotations: SharedAnnotation[];

  /** Create a new session */
  createSession: (name: string, settings?: Partial<SessionSettings>) => Promise<void>;

  /** Join existing session */
  joinSession: (sessionId: string, inviteCode?: string) => Promise<void>;

  /** Leave session */
  leaveSession: () => void;

  /** Update cursor position */
  updateCursor: (x: number, y: number) => void;

  /** Select a node */
  selectNode: (nodeId: string | undefined) => void;

  /** Create annotation */
  createAnnotation: (
    type: SharedAnnotation['type'],
    target: SharedAnnotation['target'],
    content: string,
    color?: string
  ) => SharedAnnotation | null;

  /** Delete annotation */
  deleteAnnotation: (id: string) => void;

  /** Follow a user */
  followUser: (userId: string) => void;

  /** Stop following */
  unfollowUser: () => void;
}

/**
 * Generate a random user ID
 */
function generateUserId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get stored user ID or create new one
 */
function getOrCreateUserId(): string {
  if (typeof localStorage === 'undefined') {
    return generateUserId();
  }

  let userId = localStorage.getItem('collaboration-user-id');
  if (!userId) {
    userId = generateUserId();
    localStorage.setItem('collaboration-user-id', userId);
  }
  return userId;
}

/**
 * Get stored user name
 */
function getUserName(): string {
  if (typeof localStorage === 'undefined') {
    return 'Anonymous';
  }
  return localStorage.getItem('collaboration-user-name') || 'Anonymous';
}

export function useCollaboration(): UseCollaborationResult {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [currentUser, setCurrentUser] = useState<CollaborationUser | null>(null);
  const [users, setUsers] = useState<CollaborationUser[]>([]);
  const [presences, setPresences] = useState<Map<string, UserPresence>>(new Map());
  const [annotations, setAnnotations] = useState<SharedAnnotation[]>([]);
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);

  const pathname = usePathname();
  const sessionManagerRef = useRef(getSessionManager());
  const broadcasterRef = useRef(getCollaborationBroadcaster());
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Update presence when pathname changes
  useEffect(() => {
    if (connected && currentUser) {
      sessionManagerRef.current.updatePresence({ currentPage: pathname });
    }
  }, [pathname, connected, currentUser]);

  // Subscribe to events
  useEffect(() => {
    const handleEvent = (event: CollaborationEvent) => {
      switch (event.type) {
        case 'user-joined':
          setUsers((prev) => [...prev, event.user]);
          break;

        case 'user-left':
          setUsers((prev) => prev.filter((u) => u.id !== event.userId));
          setPresences((prev) => {
            const next = new Map(prev);
            next.delete(event.userId);
            return next;
          });
          break;

        case 'presence-updated':
          setPresences((prev) => {
            const next = new Map(prev);
            next.set(event.presence.userId, event.presence);
            return next;
          });
          break;

        case 'annotation-created':
        case 'annotation-updated':
          setAnnotations((prev) => {
            const existing = prev.findIndex((a) => a.id === event.annotation.id);
            if (existing >= 0) {
              const next = [...prev];
              next[existing] = event.annotation;
              return next;
            }
            return [...prev, event.annotation];
          });
          break;

        case 'annotation-deleted':
          setAnnotations((prev) =>
            prev.filter((a) => a.id !== event.annotationId)
          );
          break;

        case 'follow-user':
          // Another user started following someone
          break;

        case 'unfollow-user':
          // Another user stopped following
          break;

        case 'cursor-moved':
          // Update cursor in presences
          setPresences((prev) => {
            const existing = prev.get(event.userId);
            if (existing) {
              const next = new Map(prev);
              next.set(event.userId, {
                ...existing,
                cursorPosition: event.position,
              });
              return next;
            }
            return prev;
          });
          break;
      }
    };

    unsubscribeRef.current = sessionManagerRef.current.subscribe(handleEvent);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const createSession = useCallback(
    async (name: string, settings?: Partial<SessionSettings>) => {
      setLoading(true);
      setError(null);

      try {
        const userId = getOrCreateUserId();
        const userName = getUserName();

        const newSession = sessionManagerRef.current.createSession(
          name,
          userId,
          userName,
          settings
        );

        setSession(newSession);
        setCurrentUser(sessionManagerRef.current.getCurrentUser());
        setUsers(sessionManagerRef.current.getUsers());
        setConnected(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create session');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const joinSession = useCallback(
    async (sessionId: string, inviteCode?: string) => {
      setLoading(true);
      setError(null);

      try {
        // In a real implementation, this would fetch the session from the server
        // For now, we'll simulate it
        const mockSession: CollaborationSession = {
          id: sessionId,
          name: 'Shared Session',
          ownerId: 'unknown',
          users: [],
          settings: {
            shareCursors: true,
            shareViewport: true,
            allowAnnotations: true,
            visibility: 'invite-only',
            maxUsers: 10,
          },
          createdAt: new Date(),
          inviteCode,
        };

        const userId = getOrCreateUserId();
        const userName = getUserName();

        sessionManagerRef.current.joinSession(mockSession, userId, userName);

        setSession(sessionManagerRef.current.getSession());
        setCurrentUser(sessionManagerRef.current.getCurrentUser());
        setUsers(sessionManagerRef.current.getUsers());
        setConnected(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join session');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const leaveSession = useCallback(() => {
    sessionManagerRef.current.leaveSession();
    setSession(null);
    setCurrentUser(null);
    setUsers([]);
    setPresences(new Map());
    setAnnotations([]);
    setFollowingUserId(null);
    setConnected(false);
  }, []);

  const updateCursor = useCallback(
    (x: number, y: number) => {
      if (!connected || !session || !currentUser) {
        return;
      }

      sessionManagerRef.current.updatePresence({
        cursorPosition: { x, y },
      });

      broadcasterRef.current.queueCursorUpdate(session.id, currentUser.id, x, y);
    },
    [connected, session, currentUser]
  );

  const selectNode = useCallback(
    (nodeId: string | undefined) => {
      if (!connected) {
        return;
      }

      sessionManagerRef.current.updatePresence({ selectedNodeId: nodeId });
    },
    [connected]
  );

  const createAnnotation = useCallback(
    (
      type: SharedAnnotation['type'],
      target: SharedAnnotation['target'],
      content: string,
      color?: string
    ): SharedAnnotation | null => {
      if (!connected || !currentUser) {
        return null;
      }

      const annotation = sessionManagerRef.current.createAnnotation({
        type,
        target,
        content,
        color: color || currentUser.color,
        createdBy: currentUser.id,
      });

      if (session) {
        broadcasterRef.current.broadcastAnnotation(session.id, annotation);
      }

      return annotation;
    },
    [connected, currentUser, session]
  );

  const deleteAnnotation = useCallback(
    (id: string) => {
      if (!connected || !currentUser || !session) {
        return;
      }

      sessionManagerRef.current.deleteAnnotation(id);
      broadcasterRef.current.broadcastAnnotationDeleted(
        session.id,
        id,
        currentUser.id
      );
    },
    [connected, currentUser, session]
  );

  const followUser = useCallback((userId: string) => {
    setFollowingUserId(userId);
  }, []);

  const unfollowUser = useCallback(() => {
    setFollowingUserId(null);
  }, []);

  const followingUser = followingUserId
    ? users.find((u) => u.id === followingUserId) || null
    : null;

  return {
    connected,
    loading,
    error,
    session,
    currentUser,
    users,
    presences,
    followingUser,
    annotations,
    createSession,
    joinSession,
    leaveSession,
    updateCursor,
    selectNode,
    createAnnotation,
    deleteAnnotation,
    followUser,
    unfollowUser,
  };
}

export default useCollaboration;
