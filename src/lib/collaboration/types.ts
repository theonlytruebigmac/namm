/**
 * Multi-User Collaboration Types
 *
 * Provides real-time collaboration between multiple users viewing the mesh network
 */

// ============================================================================
// User & Presence Types
// ============================================================================

/**
 * Represents a collaborating user
 */
export interface CollaborationUser {
  /** Unique user identifier */
  id: string;
  /** Display name */
  name: string;
  /** Avatar URL or initials */
  avatar?: string;
  /** User's assigned color for cursors/highlights */
  color: string;
  /** When user joined the session */
  joinedAt: Date;
  /** Last activity timestamp */
  lastActiveAt: Date;
  /** Current online status */
  status: UserStatus;
}

/**
 * User online status
 */
export type UserStatus = 'online' | 'away' | 'offline';

/**
 * User's current presence state (what they're viewing/doing)
 */
export interface UserPresence {
  /** User ID */
  userId: string;
  /** Current page/route */
  currentPage: string;
  /** Currently selected node (if any) */
  selectedNodeId?: string;
  /** Current map viewport (if on map page) */
  mapViewport?: MapViewport;
  /** Mouse position (for cursor sharing) */
  cursorPosition?: CursorPosition;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Map viewport state
 */
export interface MapViewport {
  center: { lat: number; lng: number };
  zoom: number;
}

/**
 * Cursor position for sharing
 */
export interface CursorPosition {
  x: number;
  y: number;
  /** Element ID cursor is over */
  elementId?: string;
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * Collaboration session
 */
export interface CollaborationSession {
  /** Unique session ID */
  id: string;
  /** Session name */
  name: string;
  /** Session creator */
  ownerId: string;
  /** Users in the session */
  users: CollaborationUser[];
  /** Session settings */
  settings: SessionSettings;
  /** Created timestamp */
  createdAt: Date;
  /** Session expiry (null = permanent) */
  expiresAt?: Date;
  /** Invite code for joining */
  inviteCode?: string;
}

/**
 * Session configuration
 */
export interface SessionSettings {
  /** Allow cursor sharing */
  shareCursors: boolean;
  /** Allow viewport following */
  shareViewport: boolean;
  /** Allow annotation editing */
  allowAnnotations: boolean;
  /** Session visibility */
  visibility: 'private' | 'invite-only' | 'public';
  /** Max users (0 = unlimited) */
  maxUsers: number;
}

// ============================================================================
// Shared Content Types
// ============================================================================

/**
 * Shared annotation on a node or map
 */
export interface SharedAnnotation {
  /** Annotation ID */
  id: string;
  /** Creator user ID */
  createdBy: string;
  /** Annotation type */
  type: 'note' | 'marker' | 'highlight' | 'drawing';
  /** Target (node ID or map coordinates) */
  target: AnnotationTarget;
  /** Content */
  content: string;
  /** Color */
  color: string;
  /** Created timestamp */
  createdAt: Date;
  /** Last update */
  updatedAt: Date;
}

/**
 * Annotation target
 */
export type AnnotationTarget =
  | { type: 'node'; nodeId: string }
  | { type: 'map'; lat: number; lng: number }
  | { type: 'message'; messageId: string };

/**
 * Shared view configuration
 */
export interface SharedView {
  /** View ID */
  id: string;
  /** View name */
  name: string;
  /** Creator */
  createdBy: string;
  /** View type */
  type: 'map' | 'nodes' | 'messages' | 'dashboard';
  /** View state to restore */
  state: Record<string, unknown>;
  /** Annotations on this view */
  annotations: SharedAnnotation[];
  /** Created timestamp */
  createdAt: Date;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Collaboration events for real-time sync
 */
export type CollaborationEvent =
  | { type: 'user-joined'; user: CollaborationUser }
  | { type: 'user-left'; userId: string }
  | { type: 'user-status-changed'; userId: string; status: UserStatus }
  | { type: 'presence-updated'; presence: UserPresence }
  | { type: 'annotation-created'; annotation: SharedAnnotation }
  | { type: 'annotation-updated'; annotation: SharedAnnotation }
  | { type: 'annotation-deleted'; annotationId: string }
  | { type: 'view-shared'; view: SharedView }
  | { type: 'follow-user'; targetUserId: string }
  | { type: 'unfollow-user'; targetUserId: string }
  | { type: 'cursor-moved'; userId: string; position: CursorPosition };

/**
 * Collaboration event handler
 */
export type CollaborationEventHandler = (event: CollaborationEvent) => void;

// ============================================================================
// API Types
// ============================================================================

/**
 * Collaboration API interface
 */
export interface CollaborationAPI {
  /** Current session */
  session: CollaborationSession | null;

  /** Current user */
  currentUser: CollaborationUser | null;

  /** All users in session */
  users: CollaborationUser[];

  /** Create a new session */
  createSession(name: string, settings?: Partial<SessionSettings>): Promise<CollaborationSession>;

  /** Join an existing session */
  joinSession(sessionId: string, inviteCode?: string): Promise<CollaborationSession>;

  /** Leave current session */
  leaveSession(): Promise<void>;

  /** Update presence */
  updatePresence(presence: Partial<UserPresence>): void;

  /** Create annotation */
  createAnnotation(annotation: Omit<SharedAnnotation, 'id' | 'createdAt' | 'updatedAt'>): Promise<SharedAnnotation>;

  /** Update annotation */
  updateAnnotation(id: string, updates: Partial<SharedAnnotation>): Promise<SharedAnnotation>;

  /** Delete annotation */
  deleteAnnotation(id: string): Promise<void>;

  /** Share current view */
  shareView(name: string): Promise<SharedView>;

  /** Follow another user's view */
  followUser(userId: string): void;

  /** Stop following */
  unfollowUser(): void;

  /** Subscribe to events */
  subscribe(handler: CollaborationEventHandler): () => void;
}

// ============================================================================
// State Types
// ============================================================================

/**
 * Collaboration state for React context
 */
export interface CollaborationState {
  /** Connection status */
  connected: boolean;

  /** Loading state */
  loading: boolean;

  /** Error state */
  error: string | null;

  /** Current session */
  session: CollaborationSession | null;

  /** Current user */
  currentUser: CollaborationUser | null;

  /** All users */
  users: CollaborationUser[];

  /** User presences */
  presences: Map<string, UserPresence>;

  /** Annotations */
  annotations: SharedAnnotation[];

  /** User we're following */
  followingUserId: string | null;
}

/**
 * Default session settings
 */
export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  shareCursors: true,
  shareViewport: true,
  allowAnnotations: true,
  visibility: 'invite-only',
  maxUsers: 10,
};

/**
 * Predefined user colors for cursor/highlight assignment
 */
export const USER_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
];

/**
 * Get a color for a user based on their index
 */
export function getUserColor(index: number): string {
  return USER_COLORS[index % USER_COLORS.length];
}

/**
 * Generate a random session invite code
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
