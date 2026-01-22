/**
 * Connection Configuration API
 *
 * REST API for persisting connection configurations server-side.
 * Uses SQLite database for storage, making settings available across all clients.
 *
 * GET /api/connections - List all saved connections
 * POST /api/connections - Save/update connections
 * DELETE /api/connections?id=xxx - Remove a connection
 */

import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { SettingsRepository } from "@/lib/db/repositories/settings";
import type { ConnectionConfig } from "@/lib/connections/types";

const CONNECTIONS_KEY = "namm-connections";

function getSettingsRepo() {
    const db = getDatabase();
    return new SettingsRepository(db);
}

/**
 * GET /api/connections
 * Returns all saved connection configurations
 */
export async function GET() {
    try {
        const repo = getSettingsRepo();
        const connections = repo.getJSON<ConnectionConfig[]>(CONNECTIONS_KEY) || [];

        return NextResponse.json({ connections });
    } catch (error) {
        console.error("[Connections API] GET error:", error);
        return NextResponse.json(
            { error: "Failed to fetch connections" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/connections
 * Save or update connection configurations
 *
 * Body can be:
 * - { connections: ConnectionConfig[] } - Replace all connections
 * - ConnectionConfig - Add/update a single connection
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const repo = getSettingsRepo();

        if (body.connections && Array.isArray(body.connections)) {
            // Replace all connections
            repo.setJSON(CONNECTIONS_KEY, body.connections);
            console.log(`[Connections API] Saved ${body.connections.length} connections`);
            return NextResponse.json({ success: true, count: body.connections.length });
        } else if (body.id && body.type) {
            // Add/update a single connection
            const existing = repo.getJSON<ConnectionConfig[]>(CONNECTIONS_KEY) || [];
            const index = existing.findIndex((c) => c.id === body.id);

            if (index >= 0) {
                existing[index] = { ...existing[index], ...body, updatedAt: Date.now() };
            } else {
                existing.push(body);
            }

            repo.setJSON(CONNECTIONS_KEY, existing);
            console.log(`[Connections API] Saved connection: ${body.name || body.id}`);
            return NextResponse.json({ success: true, connection: body });
        } else {
            return NextResponse.json(
                { error: "Invalid request body. Expected { connections: [] } or a ConnectionConfig object" },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error("[Connections API] POST error:", error);
        return NextResponse.json(
            { error: "Failed to save connections" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/connections?id=xxx
 * Remove a connection by ID
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Missing connection id" },
                { status: 400 }
            );
        }

        const repo = getSettingsRepo();
        const existing = repo.getJSON<ConnectionConfig[]>(CONNECTIONS_KEY) || [];
        const filtered = existing.filter((c) => c.id !== id);

        if (filtered.length === existing.length) {
            return NextResponse.json(
                { error: "Connection not found" },
                { status: 404 }
            );
        }

        repo.setJSON(CONNECTIONS_KEY, filtered);
        console.log(`[Connections API] Deleted connection: ${id}`);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Connections API] DELETE error:", error);
        return NextResponse.json(
            { error: "Failed to delete connection" },
            { status: 500 }
        );
    }
}
