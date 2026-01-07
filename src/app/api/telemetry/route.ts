/**
 * Telemetry API
 *
 * Paginated endpoint for retrieving telemetry data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { TelemetryRepository } from '@/lib/db/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);
    const offset = (page - 1) * limit;

    // Filter parameters
    const nodeId = searchParams.get('nodeId') || undefined;
    const startTime = searchParams.get('startTime')
      ? parseInt(searchParams.get('startTime')!, 10)
      : undefined;
    const endTime = searchParams.get('endTime')
      ? parseInt(searchParams.get('endTime')!, 10)
      : undefined;

    const db = getDatabase();
    const telemetryRepo = new TelemetryRepository(db);

    // Build filter object
    const filter: any = {};
    if (nodeId) filter.nodeId = nodeId;
    if (startTime) filter.since = startTime;

    // Use getPaginated method
    const result = telemetryRepo.getPaginated(filter, { limit, offset });

    // Additional time range filtering if endTime is provided
    let telemetry = result.data;
    let totalCount = result.total;

    if (endTime) {
      telemetry = telemetry.filter(t => t.timestamp <= endTime);
      totalCount = telemetry.length;
    }

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      success: true,
      data: {
        telemetry,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        filters: {
          nodeId,
          startTime,
          endTime
        }
      }
    });
  } catch (error) {
    console.error('Error fetching telemetry:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch telemetry'
      },
      { status: 500 }
    );
  }
}
