/**
 * Backup & Restore API
 *
 * GET /api/backup - Export settings and data as JSON
 * POST /api/backup - Import settings and data from JSON
 */

import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { SettingsRepository } from "@/lib/db/repositories/settings";
import { NodeRepository } from "@/lib/db/repositories/nodes";
import { ChannelRepository } from "@/lib/db/repositories/channels";
import { getAuthConfig, getAllUsers, User, setAuthConfig, createUser } from "@/lib/auth";
import { getChannelKeys, setChannelKey } from "../channels/keys/store";

interface BackupData {
  version: string;
  timestamp: number;
  settings: Record<string, unknown>;
  channels: {
    id: number;
    name: string;
    role: number;
    hasKey: boolean;
    psk?: string;
  }[];
  nodeAliases: {
    nodeId: string;
    alias: string;
    notes?: string;
  }[];
  authConfig?: {
    enabled: boolean;
    sessionTimeout: number;
    requireAuth: boolean;
  };
  users?: {
    username: string;
    displayName: string;
    role: "admin" | "user" | "viewer";
  }[];
}

/**
 * GET /api/backup
 * Export current settings as JSON
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeSecrets = searchParams.get("includeSecrets") === "true";
    const includeUsers = searchParams.get("includeUsers") === "true";

    const db = getDatabase();
    const settingsRepo = new SettingsRepository(db);
    const nodeRepo = new NodeRepository(db);
    const channelRepo = new ChannelRepository(db);

    // Get all settings
    const settingsRows = settingsRepo.getAll();
    const settings: Record<string, unknown> = {};
    for (const row of settingsRows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }

    // Get channel configuration
    const dbChannels = channelRepo.getAll();
    const channelKeys = getChannelKeys();

    const channels = dbChannels.map(ch => {
      const keyInfo = channelKeys.find(k => k.index === ch.id);
      return {
        id: ch.id,
        name: ch.name,
        role: ch.role || 2,
        hasKey: ch.has_key === 1,
        // Only include PSK if explicitly requested
        ...(includeSecrets && keyInfo?.psk ? { psk: keyInfo.psk } : {}),
      };
    });

    // Get node aliases
    const nodeAliasesRaw = settingsRepo.get("nodeAliases");
    const nodeAliases: BackupData["nodeAliases"] = nodeAliasesRaw
      ? JSON.parse(nodeAliasesRaw)
      : [];

    // Build backup object
    const backup: BackupData = {
      version: "1.0.0",
      timestamp: Date.now(),
      settings,
      channels,
      nodeAliases,
    };

    // Include auth config if requested
    if (includeUsers) {
      backup.authConfig = getAuthConfig();
      backup.users = getAllUsers().map(u => ({
        username: u.username,
        displayName: u.displayName,
        role: u.role,
      }));
    }

    // Return as downloadable JSON
    const filename = `namm-backup-${new Date().toISOString().split("T")[0]}.json`;

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Backup export error:", error);
    return NextResponse.json(
      { error: "Failed to create backup" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/backup
 * Import settings from JSON backup
 */
export async function POST(request: NextRequest) {
  try {
    const backup: BackupData = await request.json();

    // Validate backup format
    if (!backup.version || !backup.timestamp) {
      return NextResponse.json(
        { error: "Invalid backup format" },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const settingsRepo = new SettingsRepository(db);
    const channelRepo = new ChannelRepository(db);

    const results = {
      settings: 0,
      channels: 0,
      nodeAliases: 0,
      users: 0,
      errors: [] as string[],
    };

    // Restore settings
    if (backup.settings) {
      for (const [key, value] of Object.entries(backup.settings)) {
        try {
          const valueStr = typeof value === "string" ? value : JSON.stringify(value);
          settingsRepo.set(key, valueStr);
          results.settings++;
        } catch (e) {
          results.errors.push(`Failed to restore setting: ${key}`);
        }
      }
    }

    // Restore channels
    if (backup.channels) {
      for (const ch of backup.channels) {
        try {
          channelRepo.upsert(ch.id, ch.name, ch.role, ch.hasKey);

          // Restore PSK if provided
          if (ch.psk) {
            setChannelKey(ch.id, ch.name, ch.psk, ch.role);
          }

          results.channels++;
        } catch (e) {
          results.errors.push(`Failed to restore channel: ${ch.name}`);
        }
      }
    }

    // Restore node aliases
    if (backup.nodeAliases && backup.nodeAliases.length > 0) {
      try {
        settingsRepo.set("nodeAliases", JSON.stringify(backup.nodeAliases));
        results.nodeAliases = backup.nodeAliases.length;
      } catch (e) {
        results.errors.push("Failed to restore node aliases");
      }
    }

    // Restore auth config (if provided)
    if (backup.authConfig) {
      try {
        setAuthConfig(backup.authConfig);
      } catch (e) {
        results.errors.push("Failed to restore auth config");
      }
    }

    return NextResponse.json({
      success: true,
      message: "Backup restored successfully",
      results,
    });
  } catch (error) {
    console.error("Backup import error:", error);
    return NextResponse.json(
      { error: "Failed to restore backup" },
      { status: 500 }
    );
  }
}
