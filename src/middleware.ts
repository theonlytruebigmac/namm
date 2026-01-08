/**
 * Next.js Middleware for Authentication
 *
 * Protects routes when authentication is enabled
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/status",
  "/_next",
  "/favicon.ico",
];

// API paths that should always be accessible (for SSE, etc.)
const PUBLIC_API_PATHS = [
  "/api/sse/stream",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Skip public API paths
  if (PUBLIC_API_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Skip static files
  if (pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2)$/)) {
    return NextResponse.next();
  }

  // Check auth status by calling the auth API
  try {
    const sessionCookie = request.cookies.get("namm-session");

    // Make internal request to check auth config and session
    const authCheckUrl = new URL("/api/auth/login", request.url);
    const authResponse = await fetch(authCheckUrl, {
      headers: {
        Cookie: sessionCookie ? `namm-session=${sessionCookie.value}` : "",
      },
    });

    const authData = await authResponse.json();

    // If auth is not enabled, allow all requests
    if (!authData.authEnabled) {
      return NextResponse.next();
    }

    // If authenticated, allow the request
    if (authData.authenticated) {
      return NextResponse.next();
    }

    // Not authenticated and auth is required - redirect to login
    // For API routes, return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // For page routes, redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  } catch (error) {
    console.error("[Middleware] Auth check error:", error);
    // On error, allow the request (fail open for development)
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (files in public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
