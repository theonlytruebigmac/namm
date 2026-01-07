import { NextRequest, NextResponse } from "next/server";
import {
  getAuthConfig,
  setAuthConfig,
  getUserBySession,
  getSessionCount,
  getAllUsers,
} from "@/lib/auth";

/**
 * GET /api/auth/config - Get auth configuration
 */
export async function GET(request: NextRequest) {
  try {
    const config = getAuthConfig();
    const sessionCount = getSessionCount();
    const userCount = getAllUsers().length;

    return NextResponse.json({
      config,
      stats: {
        activeSessions: sessionCount,
        totalUsers: userCount,
      },
    });
  } catch (error) {
    console.error("[Auth] Get config error:", error);
    return NextResponse.json({ error: "Failed to get config" }, { status: 500 });
  }
}

/**
 * PATCH /api/auth/config - Update auth configuration (admin only when auth is enabled)
 */
export async function PATCH(request: NextRequest) {
  try {
    const currentConfig = getAuthConfig();

    // If auth is enabled, require admin
    if (currentConfig.enabled) {
      const sessionId = request.cookies.get("namm-session")?.value;
      if (!sessionId) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      const currentUser = getUserBySession(sessionId);
      if (!currentUser) {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
      }

      if (currentUser.role !== "admin") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { enabled, sessionTimeout, requireAuth } = body;

    const updates: Partial<{ enabled: boolean; sessionTimeout: number; requireAuth: boolean }> = {};

    if (typeof enabled === "boolean") updates.enabled = enabled;
    if (typeof sessionTimeout === "number" && sessionTimeout > 0) {
      updates.sessionTimeout = sessionTimeout;
    }
    if (typeof requireAuth === "boolean") updates.requireAuth = requireAuth;

    const newConfig = setAuthConfig(updates);
    return NextResponse.json({ config: newConfig });
  } catch (error) {
    console.error("[Auth] Update config error:", error);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
