import { NextRequest, NextResponse } from "next/server";
import {
  authenticateUser,
  createSession,
  getUserBySession,
  deleteSession,
  getAuthConfig,
} from "@/lib/auth";

/**
 * POST /api/auth/login - Login and create session
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

    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password required" },
        { status: 400 }
      );
    }

    const user = authenticateUser(username, password);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const session = createSession(user.id);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    });

    // Set session cookie
    response.cookies.set("namm-session", session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: config.sessionTimeout / 1000,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[Auth] Login error:", error);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/login - Check current session
 */
export async function GET(request: NextRequest) {
  try {
    const config = getAuthConfig();
    if (!config.enabled) {
      return NextResponse.json({
        authenticated: false,
        authEnabled: false,
      });
    }

    const sessionId = request.cookies.get("namm-session")?.value;
    if (!sessionId) {
      return NextResponse.json({
        authenticated: false,
        authEnabled: true,
      });
    }

    const user = getUserBySession(sessionId);
    if (!user) {
      return NextResponse.json({
        authenticated: false,
        authEnabled: true,
      });
    }

    return NextResponse.json({
      authenticated: true,
      authEnabled: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[Auth] Session check error:", error);
    return NextResponse.json(
      { error: "Session check failed" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/login - Logout and delete session
 */
export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("namm-session")?.value;
    if (sessionId) {
      deleteSession(sessionId);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete("namm-session");
    return response;
  } catch (error) {
    console.error("[Auth] Logout error:", error);
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    );
  }
}
