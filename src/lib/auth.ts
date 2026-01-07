/**
 * Local Authentication System
 * Simple session-based authentication for NAMM
 */

import { cookies } from "next/headers";
import crypto from "crypto";

// Types
export interface User {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user" | "viewer";
  createdAt: number;
  lastLogin?: number;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: number;
  createdAt: number;
}

export interface AuthConfig {
  enabled: boolean;
  sessionTimeout: number; // in milliseconds
  requireAuth: boolean;
}

// Constants
const SESSION_COOKIE_NAME = "namm-session";
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
const AUTH_STORAGE_KEY = "namm-auth-config";
const USERS_STORAGE_KEY = "namm-users";
const SESSIONS_STORAGE_KEY = "namm-sessions";

// In-memory storage (for server-side - will be backed by SQLite in production)
let users: Map<string, User & { passwordHash: string }> = new Map();
let sessions: Map<string, Session> = new Map();
let authConfig: AuthConfig = {
  enabled: false,
  sessionTimeout: SESSION_TIMEOUT,
  requireAuth: false,
};

/**
 * Hash a password using SHA-256 with salt
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, actualSalt, 100000, 64, "sha512")
    .toString("hex");
  return { hash, salt: actualSalt };
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const result = hashPassword(password, salt);
  return result.hash === hash;
}

/**
 * Generate a secure session ID
 */
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Generate a user ID
 */
export function generateUserId(): string {
  return crypto.randomBytes(8).toString("hex");
}

/**
 * Create a new user
 */
export function createUser(
  username: string,
  password: string,
  displayName: string,
  role: User["role"] = "user"
): User {
  const existingUser = Array.from(users.values()).find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
  if (existingUser) {
    throw new Error("Username already exists");
  }

  const { hash, salt } = hashPassword(password);
  const user: User & { passwordHash: string } = {
    id: generateUserId(),
    username: username.toLowerCase(),
    displayName,
    role,
    createdAt: Date.now(),
    passwordHash: `${salt}:${hash}`,
  };

  users.set(user.id, user);
  return { id: user.id, username: user.username, displayName: user.displayName, role: user.role, createdAt: user.createdAt };
}

/**
 * Authenticate a user
 */
export function authenticateUser(username: string, password: string): User | null {
  const user = Array.from(users.values()).find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
  if (!user) return null;

  const [salt, hash] = user.passwordHash.split(":");
  if (!verifyPassword(password, hash, salt)) return null;

  // Update last login
  user.lastLogin = Date.now();
  users.set(user.id, user);

  return { id: user.id, username: user.username, displayName: user.displayName, role: user.role, createdAt: user.createdAt, lastLogin: user.lastLogin };
}

/**
 * Create a new session
 */
export function createSession(userId: string): Session {
  const session: Session = {
    id: generateSessionId(),
    userId,
    expiresAt: Date.now() + authConfig.sessionTimeout,
    createdAt: Date.now(),
  };

  sessions.set(session.id, session);
  return session;
}

/**
 * Validate a session
 */
export function validateSession(sessionId: string): Session | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

/**
 * Get user by session ID
 */
export function getUserBySession(sessionId: string): User | null {
  const session = validateSession(sessionId);
  if (!session) return null;

  const user = users.get(session.userId);
  if (!user) return null;

  return { id: user.id, username: user.username, displayName: user.displayName, role: user.role, createdAt: user.createdAt, lastLogin: user.lastLogin };
}

/**
 * Delete a session (logout)
 */
export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * Delete all sessions for a user
 */
export function deleteUserSessions(userId: string): void {
  for (const [id, session] of sessions.entries()) {
    if (session.userId === userId) {
      sessions.delete(id);
    }
  }
}

/**
 * Get all users (without passwords)
 */
export function getAllUsers(): User[] {
  return Array.from(users.values()).map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    createdAt: u.createdAt,
    lastLogin: u.lastLogin,
  }));
}

/**
 * Get a user by ID
 */
export function getUserById(userId: string): User | null {
  const user = users.get(userId);
  if (!user) return null;
  return { id: user.id, username: user.username, displayName: user.displayName, role: user.role, createdAt: user.createdAt, lastLogin: user.lastLogin };
}

/**
 * Update a user
 */
export function updateUser(
  userId: string,
  updates: Partial<{ displayName: string; role: User["role"]; password: string }>
): User | null {
  const user = users.get(userId);
  if (!user) return null;

  if (updates.displayName) user.displayName = updates.displayName;
  if (updates.role) user.role = updates.role;
  if (updates.password) {
    const { hash, salt } = hashPassword(updates.password);
    user.passwordHash = `${salt}:${hash}`;
  }

  users.set(userId, user);
  return { id: user.id, username: user.username, displayName: user.displayName, role: user.role, createdAt: user.createdAt, lastLogin: user.lastLogin };
}

/**
 * Delete a user
 */
export function deleteUser(userId: string): boolean {
  deleteUserSessions(userId);
  return users.delete(userId);
}

/**
 * Get auth config
 */
export function getAuthConfig(): AuthConfig {
  return { ...authConfig };
}

/**
 * Update auth config
 */
export function setAuthConfig(config: Partial<AuthConfig>): AuthConfig {
  authConfig = { ...authConfig, ...config };
  return { ...authConfig };
}

/**
 * Check if authentication is required for a given path
 */
export function isAuthRequired(path: string): boolean {
  if (!authConfig.enabled || !authConfig.requireAuth) return false;

  // Public paths that don't require auth
  const publicPaths = ["/login", "/api/auth/login", "/api/auth/status"];
  return !publicPaths.some((p) => path.startsWith(p));
}

/**
 * Initialize default admin user if no users exist
 */
export function initializeDefaultAdmin(): void {
  if (users.size === 0) {
    createUser("admin", "admin", "Administrator", "admin");
    console.log("[Auth] Created default admin user (username: admin, password: admin)");
  }
}

/**
 * Get session count
 */
export function getSessionCount(): number {
  // Clean expired sessions first
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(id);
    }
  }
  return sessions.size;
}

/**
 * Middleware helper to check authentication
 */
export async function requireAuth(request: Request): Promise<{ user: User | null; error: string | null }> {
  if (!authConfig.enabled) {
    return { user: null, error: null };
  }

  const sessionId = request.headers.get("cookie")?.match(/namm-session=([^;]+)/)?.[1];
  if (!sessionId) {
    return { user: null, error: "Not authenticated" };
  }

  const user = getUserBySession(sessionId);
  if (!user) {
    return { user: null, error: "Invalid session" };
  }

  return { user, error: null };
}

// Initialize on module load
initializeDefaultAdmin();
