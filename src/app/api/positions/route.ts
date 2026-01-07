/**
 * Positions API
 *
 * Paginated endpoint for retrieving position history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { PositionRepository } from '@/lib/db/db';

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

    // Geographic bounds
    const north = searchParams.get('north')
      ? parseFloat(searchParams.get('north')!)
      : undefined;
    const south = searchParams.get('south')
      ? parseFloat(searchParams.get('south')!)
      : undefined;
    const east = searchParams.get('east')
      ? parseFloat(searchParams.get('east')!)
      : undefined;
    const west = searchParams.get('west')
      ? parseFloat(searchParams.get('west')!)
      : undefined;

    const bounds = (north !== undefined && south !== undefined &&
                    east !== undefined && west !== undefined)
      ? { north, south, east, west }
      : undefined;

    const db = getDatabase();
    const posRepo = new PositionRepository(db);

    // Build filter object
    const filter: any = {};
    if (nodeId) filter.nodeId = nodeId;
    if (bounds) filter.bounds = bounds;
    if (startTime) filter.since = startTime;

    // Use getPaginated method
    const result = posRepo.getPaginated(filter, { limit, offset });

    // Additional time range filtering if endTime is provided
    let positions = result.data;
    let totalCount = result.total;

    if (endTime) {
      positions = positions.filter(pos => pos.timestamp <= endTime);
      totalCount = positions.length;
    }

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      success: true,
      data: {
        positions,
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
          bounds,
          startTime,
          endTime
        }
      }
    });
  } catch (error) {
    console.error('Error fetching positions:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch positions'
      },
      { status: 500 }
    );
  }
}
