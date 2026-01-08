/**
 * Collaboration System
 *
 * Exports the complete multi-user collaboration API
 */

// Core types
export type {
  CollaborationUser,
  UserStatus,
  UserPresence,
  MapViewport,
  CursorPosition,
  CollaborationSession,
  SessionSettings,
  SharedAnnotation,
  AnnotationTarget,
  SharedView,
  CollaborationEvent,
  CollaborationEventHandler,
  CollaborationAPI,
  CollaborationState,
} from './types';

// Utilities
export {
  DEFAULT_SESSION_SETTINGS,
  USER_COLORS,
  getUserColor,
  generateInviteCode,
} from './types';

// Session management
export {
  SessionManager,
  getSessionManager,
  resetSessionManager,
} from './session';

// Broadcasting
export {
  getCollaborationBroadcaster,
  resetCollaborationBroadcaster,
  type CollaborationSSEEvent,
} from './broadcaster';
