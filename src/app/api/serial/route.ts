/**
 * Serial API Routes
 *
 * Endpoints for managing serial connection to Meshtastic device:
 * - GET /api/serial/ports - List available serial ports
 * - POST /api/serial/connect - Connect to a serial port
 * - POST /api/serial/disconnect - Disconnect from serial port
 * - GET /api/serial/status - Get connection status
 *
 * Note: Serial port functionality requires native modules that may not
 * be available in all environments. The API gracefully handles this.
 */

import { NextRequest, NextResponse } from 'next/server';

// Track if serial module is available
let serialModuleAvailable: boolean | null = null;
let serialModule: typeof import('@/lib/serial/serial-worker') | null = null;

/**
 * Dynamically load the serial module
 * Returns null if native modules aren't available
 */
async function loadSerialModule() {
  if (serialModuleAvailable === false) {
    return null;
  }

  if (serialModule) {
    return serialModule;
  }

  try {
    // Dynamic import to avoid build-time bundling issues
    serialModule = await import('@/lib/serial/serial-worker');
    serialModuleAvailable = true;
    return serialModule;
  } catch (error) {
    console.warn('[Serial API] Serial module not available:', error);
    serialModuleAvailable = false;
    return null;
  }
}

/**
 * GET /api/serial
 * Returns available serial ports and current connection status
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  const serial = await loadSerialModule();

  if (!serial) {
    return NextResponse.json({
      error: 'Serial functionality not available',
      details: 'Native serial port module not found. This may happen in containerized or serverless environments.',
      connected: false,
      stats: null,
      ports: [],
    }, { status: 503 });
  }

  if (action === 'ports') {
    // List available serial ports
    try {
      const ports = await serial.listSerialPorts();
      return NextResponse.json({ ports });
    } catch (error) {
      console.error('[Serial API] Error listing ports:', error);
      return NextResponse.json(
        { error: 'Failed to list serial ports', details: String(error) },
        { status: 500 }
      );
    }
  }

  // Default: return status
  const worker = serial.getSerialWorker();

  if (!worker) {
    return NextResponse.json({
      connected: false,
      stats: null,
    });
  }

  return NextResponse.json({
    connected: worker.isConnected(),
    stats: worker.getStats(),
  });
}

/**
 * POST /api/serial
 * Connect or disconnect from serial port
 */
export async function POST(request: NextRequest) {
  const serial = await loadSerialModule();

  if (!serial) {
    return NextResponse.json({
      error: 'Serial functionality not available',
      details: 'Native serial port module not found. This may happen in containerized or serverless environments.',
    }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { action, port, baudRate } = body;

    if (action === 'connect') {
      if (!port) {
        return NextResponse.json(
          { error: 'Port is required' },
          { status: 400 }
        );
      }

      console.log(`[Serial API] Connecting to ${port} at ${baudRate || 115200} baud`);

      try {
        const worker = await serial.startSerialWorker({
          port,
          baudRate: baudRate || 115200,
        });

        return NextResponse.json({
          success: true,
          connected: worker.isConnected(),
          stats: worker.getStats(),
        });
      } catch (error) {
        console.error('[Serial API] Connection error:', error);
        return NextResponse.json(
          { error: 'Failed to connect', details: String(error) },
          { status: 500 }
        );
      }
    }

    if (action === 'disconnect') {
      console.log('[Serial API] Disconnecting...');

      try {
        await serial.stopSerialWorker();
        return NextResponse.json({ success: true, connected: false });
      } catch (error) {
        console.error('[Serial API] Disconnect error:', error);
        return NextResponse.json(
          { error: 'Failed to disconnect', details: String(error) },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "connect" or "disconnect"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Serial API] Error:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
