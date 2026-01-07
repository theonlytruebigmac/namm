/**
 * PCAP Captures API
 *
 * GET /api/captures - List all captures
 * POST /api/captures - Start/stop capture
 * DELETE /api/captures - Delete a capture
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPCAPWriter, type CaptureFilter } from '@/lib/pcap/pcap-writer';

/**
 * GET /api/captures - List captures or get current status
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    const pcapWriter = getPCAPWriter();

    if (action === 'status') {
      // Get current capture status
      const session = pcapWriter.getSession();
      return NextResponse.json({
        success: true,
        capturing: session?.status === 'active',
        session,
      });
    }

    // List all captures
    const captures = pcapWriter.listCaptures();
    return NextResponse.json({
      success: true,
      captures,
    });
  } catch (error) {
    console.error('Captures API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get captures' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/captures - Start or stop capture
 * Body: { action: 'start' | 'stop', filter?: CaptureFilter }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, filter } = body;

    const pcapWriter = getPCAPWriter();

    if (action === 'start') {
      // Start a new capture
      const currentSession = pcapWriter.getSession();
      if (currentSession?.status === 'active') {
        return NextResponse.json(
          { success: false, error: 'Capture already in progress' },
          { status: 400 }
        );
      }

      const captureFilter: CaptureFilter | undefined = filter
        ? {
            nodeIds: filter.nodeIds,
            channels: filter.channels,
            portnums: filter.portnums,
            minSnr: filter.minSnr,
          }
        : undefined;

      const session = pcapWriter.startCapture(captureFilter);
      return NextResponse.json({
        success: true,
        message: 'Capture started',
        session,
      });
    } else if (action === 'stop') {
      // Stop current capture
      const session = pcapWriter.stopCapture();
      if (!session) {
        return NextResponse.json(
          { success: false, error: 'No active capture to stop' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Capture stopped',
        session,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "start" or "stop"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Captures API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process capture action' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/captures - Delete a capture file
 * Query: ?filename=capture_xxx.pcap
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json(
        { success: false, error: 'Filename is required' },
        { status: 400 }
      );
    }

    // Validate filename to prevent path traversal
    if (filename.includes('/') || filename.includes('\\') || !filename.endsWith('.pcap')) {
      return NextResponse.json(
        { success: false, error: 'Invalid filename' },
        { status: 400 }
      );
    }

    const pcapWriter = getPCAPWriter();
    const deleted = pcapWriter.deleteCapture(filename);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Capture file not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Capture deleted',
    });
  } catch (error) {
    console.error('Captures API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete capture' },
      { status: 500 }
    );
  }
}
