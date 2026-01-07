/**
 * PCAP Capture Download API
 *
 * GET /api/captures/[filename] - Download a capture file
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPCAPWriter } from '@/lib/pcap/pcap-writer';
import fs from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Validate filename to prevent path traversal
    if (
      filename.includes('/') ||
      filename.includes('\\') ||
      !filename.endsWith('.pcap')
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid filename' },
        { status: 400 }
      );
    }

    const pcapWriter = getPCAPWriter();
    const filePath = pcapWriter.getCaptureFilePath(filename);

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: 'Capture file not found' },
        { status: 404 }
      );
    }

    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.tcpdump.pcap',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': stats.size.toString(),
      },
    });
  } catch (error) {
    console.error('Capture download error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to download capture' },
      { status: 500 }
    );
  }
}
