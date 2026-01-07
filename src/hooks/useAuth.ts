"use client";

import { useState, useEffect, useCallback } from "react";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user" | "viewer";
}

export interface AuthState {
  authenticated: boolean;
  authEnabled: boolean;
  user: AuthUser | null;
  loading: boolean;
}

/**
 * Hook for authentication state and actions
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    authenticated: false,
    authEnabled: false,
    user: null,
    loading: true,
  });

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

  // Check current session
  const checkSession = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true }));
      const res = await fetch("/api/auth/login");
      const data = await res.json();

      setState({
        authenticated: data.authenticated ?? false,
        authEnabled: data.authEnabled ?? false,
        user: data.user ?? null,
        loading: false,
      });
    } catch (error) {
      console.error("[Auth] Session check error:", error);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  // Login
  const login = useCallback(
    async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          return { success: false, error: data.error || "Login failed" };
        }

        setState({
          authenticated: true,
          authEnabled: true,
          user: data.user,
          loading: false,
        });

        return { success: true };
      } catch (error) {
        console.error("[Auth] Login error:", error);
        return { success: false, error: "Login failed" };
      }
    },
    []
  );

  // Logout
  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch("/api/auth/login", { method: "DELETE" });
      setState({
        authenticated: false,
        authEnabled: state.authEnabled,
        user: null,
        loading: false,
      });
    } catch (error) {
      console.error("[Auth] Logout error:", error);
    }
  }, [state.authEnabled]);

  return {
    ...state,
    login,
    logout,
    checkSession,
    isAdmin: state.user?.role === "admin",
    isUser: state.user?.role === "user" || state.user?.role === "admin",
  };
}

/**
 * Hook for auth configuration
 */
export function useAuthConfig() {
  const [config, setConfig] = useState<{
    enabled: boolean;
    sessionTimeout: number;
    requireAuth: boolean;
  } | null>(null);
  const [stats, setStats] = useState<{
    activeSessions: number;
    totalUsers: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch config
  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/config");
      const data = await res.json();
      setConfig(data.config);
      setStats(data.stats);
    } catch (error) {
      console.error("[Auth] Config fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Update config
  const updateConfig = useCallback(
    async (updates: Partial<{ enabled: boolean; sessionTimeout: number; requireAuth: boolean }>) => {
      try {
        const res = await fetch("/api/auth/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (res.ok) {
          setConfig(data.config);
        }
        return res.ok;
      } catch (error) {
        console.error("[Auth] Config update error:", error);
        return false;
      }
    },
    []
  );

  return {
    config,
    stats,
    loading,
    updateConfig,
    refetch: fetchConfig,
  };
}

/**
 * Hook for user management (admin only)
 */
export function useUsers() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("[Auth] Users fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Create user
  const createUser = useCallback(
    async (user: { username: string; password: string; displayName: string; role?: string }) => {
      try {
        const res = await fetch("/api/auth/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });
        if (res.ok) {
          await fetchUsers();
          return { success: true };
        }
        const data = await res.json();
        return { success: false, error: data.error };
      } catch (error) {
        console.error("[Auth] Create user error:", error);
        return { success: false, error: "Failed to create user" };
      }
    },
    [fetchUsers]
  );

  // Update user
  const updateUser = useCallback(
    async (id: string, updates: { displayName?: string; role?: string; password?: string }) => {
      try {
        const res = await fetch(`/api/auth/users/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          await fetchUsers();
          return { success: true };
        }
        const data = await res.json();
        return { success: false, error: data.error };
      } catch (error) {
        console.error("[Auth] Update user error:", error);
        return { success: false, error: "Failed to update user" };
      }
    },
    [fetchUsers]
  );

  // Delete user
  const deleteUser = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/auth/users/${id}`, { method: "DELETE" });
        if (res.ok) {
          await fetchUsers();
          return { success: true };
        }
        const data = await res.json();
        return { success: false, error: data.error };
      } catch (error) {
        console.error("[Auth] Delete user error:", error);
        return { success: false, error: "Failed to delete user" };
      }
    },
    [fetchUsers]
  );

  return {
    users,
    loading,
    createUser,
    updateUser,
    deleteUser,
    refetch: fetchUsers,
  };
}
