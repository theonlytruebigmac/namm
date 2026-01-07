import { NextRequest, NextResponse } from "next/server";
import {
  getUserById,
  updateUser,
  deleteUser,
  getUserBySession,
  getAuthConfig,
} from "@/lib/auth";

/**
 * GET /api/auth/users/[id] - Get a specific user
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const config = getAuthConfig();
    const { id } = await context.params;

    if (!config.enabled) {
      return NextResponse.json({ error: "Auth disabled" }, { status: 400 });
    }

    const sessionId = request.cookies.get("namm-session")?.value;
    if (!sessionId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const currentUser = getUserBySession(sessionId);
    if (!currentUser) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Users can only view themselves unless they're admin
    if (currentUser.role !== "admin" && currentUser.id !== id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const user = getUserById(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[Auth] Get user error:", error);
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
}

/**
 * PATCH /api/auth/users/[id] - Update a user
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const config = getAuthConfig();
    const { id } = await context.params;

    if (!config.enabled) {
      return NextResponse.json({ error: "Auth disabled" }, { status: 400 });
    }

    const sessionId = request.cookies.get("namm-session")?.value;
    if (!sessionId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const currentUser = getUserBySession(sessionId);
    if (!currentUser) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const body = await request.json();
    const { displayName, role, password } = body;

    // Users can update their own displayName and password
    // Only admins can update roles or other users
    if (currentUser.id !== id && currentUser.role !== "admin") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Non-admins can't change roles
    if (role && currentUser.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can change roles" },
        { status: 403 }
      );
    }

    const updates: { displayName?: string; role?: "admin" | "user" | "viewer"; password?: string } = {};
    if (displayName) updates.displayName = displayName;
    if (role) updates.role = role;
    if (password) updates.password = password;

    const user = updateUser(id, updates);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[Auth] Update user error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/users/[id] - Delete a user (admin only)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const config = getAuthConfig();
    const { id } = await context.params;

    if (!config.enabled) {
      return NextResponse.json({ error: "Auth disabled" }, { status: 400 });
    }

    const sessionId = request.cookies.get("namm-session")?.value;
    if (!sessionId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const currentUser = getUserBySession(sessionId);
    if (!currentUser) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Only admins can delete users
    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Prevent self-deletion
    if (currentUser.id === id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    const deleted = deleteUser(id);
    if (!deleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Auth] Delete user error:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
