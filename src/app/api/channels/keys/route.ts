import { NextRequest, NextResponse } from "next/server";
import { setChannelKey, getChannelKeys } from "./store";

/**
 * POST /api/channels/keys
 * Store a channel key received from a serial-connected device
 * This allows MQTT messages on this channel to be decrypted
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { index, name, psk, role } = body;

    if (typeof index !== "number") {
      return NextResponse.json({ error: "Channel index is required" }, { status: 400 });
    }

    // Store the key
    setChannelKey(index, name || '', psk || '', role || 0);

    const channelName = name || (index === 0 ? "LongFast" : `Channel${index}`);
    console.log(`[Channels API] Stored channel "${channelName}" (index ${index}, role ${role}, hasKey: ${!!psk})`);

    return NextResponse.json({
      success: true,
      channel: { index, name: channelName, role, hasKey: !!psk }
    });
  } catch (error) {
    console.error("API Error - POST /api/channels/keys:", error);
    return NextResponse.json(
      { error: "Failed to store channel key" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/channels/keys
 * List all stored channel keys (without exposing the actual keys)
 */
export async function GET() {
  try {
    const channels = getChannelKeys();
    return NextResponse.json({ channels, count: channels.length });
  } catch (error) {
    console.error("API Error - GET /api/channels/keys:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel keys" },
      { status: 500 }
    );
  }
}
