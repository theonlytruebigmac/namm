import { NextRequest, NextResponse } from "next/server";
import {
  getAllUsers,
  createUser,
  getUserBySession,
  getAuthConfig,
} from "@/lib/auth";

/**
 * GET /api/auth/users - Get all users (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const config = getAuthConfig();

    // If auth is disabled, return empty list
    if (!config.enabled) {
      return NextResponse.json({ users: [], authEnabled: false });
    }

    // Check session
    const sessionId = request.cookies.get("namm-session")?.value;
    if (!sessionId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const currentUser = getUserBySession(sessionId);
    if (!currentUser) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Only admins can list users
    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const users = getAllUsers();
    return NextResponse.json({ users, authEnabled: true });
  } catch (error) {
    console.error("[Auth] Get users error:", error);
    return NextResponse.json({ error: "Failed to get users" }, { status: 500 });
  }
}

/**
 * POST /api/auth/users - Create a new user (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const config = getAuthConfig();

    if (!config.enabled) {
      return NextResponse.json(
        { error: "Authentication is disabled" },
        { status: 400 }
      );
    }

    // Check session
    const sessionId = request.cookies.get("namm-session")?.value;
    if (!sessionId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const currentUser = getUserBySession(sessionId);
    if (!currentUser) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Only admins can create users
    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { username, password, displayName, role } = body;

    if (!username || !password || !displayName) {
      return NextResponse.json(
        { error: "Username, password, and displayName are required" },
        { status: 400 }
      );
    }

    const validRoles = ["admin", "user", "viewer"];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be: admin, user, or viewer" },
        { status: 400 }
      );
    }

    const user = createUser(username, password, displayName, role || "user");
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Username already exists") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[Auth] Create user error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
