/**
 * Path Analysis API Endpoint
 *
 * POST /api/paths - Find optimal path between two nodes
 * GET /api/paths - Get network graph statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { TracerouteRepository } from '@/lib/db/repositories/traceroutes';
import {
  buildNetworkGraph,
  dijkstraShortestPath,
  findAllPaths,
  getGraphStats,
} from '@/lib/utils/path-analysis';

/**
 * GET /api/paths - Get network graph statistics
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const tracerouteRepo = new TracerouteRepository(db);

    // Get recent traceroutes for graph building
    const traceroutes = tracerouteRepo.getRecent(500);
    const graph = buildNetworkGraph(traceroutes);
    const stats = getGraphStats(graph);

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        tracerouteCount: traceroutes.length,
      },
      nodes: Array.from(graph.nodes).map(num => ({
        nodeNum: num,
        nodeId: graph.reverseMap.get(num) || `!${num.toString(16).padStart(8, '0')}`,
      })),
    });
  } catch (error) {
    console.error('Path analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get network graph' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/paths - Find path between two nodes
 * Body: { fromId: string, toId: string, findAll?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromId, toId, findAll = false } = body;

    if (!fromId || !toId) {
      return NextResponse.json(
        { success: false, error: 'fromId and toId are required' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const tracerouteRepo = new TracerouteRepository(db);

    // Get recent traceroutes for graph building
    const traceroutes = tracerouteRepo.getRecent(500);

    if (traceroutes.length === 0) {
      return NextResponse.json({
        success: true,
        path: null,
        message: 'No traceroute data available to build network graph',
      });
    }

    const graph = buildNetworkGraph(traceroutes);

    // Convert hex IDs to node numbers
    const fromNum = hexToNum(fromId);
    const toNum = hexToNum(toId);

    if (!graph.nodes.has(fromNum)) {
      return NextResponse.json({
        success: true,
        path: null,
        message: `Source node ${fromId} not found in network graph`,
      });
    }

    if (!graph.nodes.has(toNum)) {
      return NextResponse.json({
        success: true,
        path: null,
        message: `Destination node ${toId} not found in network graph`,
      });
    }

    if (findAll) {
      // Find all paths between nodes
      const paths = findAllPaths(graph, fromNum, toNum, 7);
      return NextResponse.json({
        success: true,
        paths: paths.map(path => ({
          path: path.map(num => graph.reverseMap.get(num) || `!${num.toString(16).padStart(8, '0')}`),
          pathNums: path,
          hopCount: path.length - 1,
        })),
        stats: getGraphStats(graph),
      });
    } else {
      // Find shortest path using Dijkstra's algorithm
      const result = dijkstraShortestPath(graph, fromNum, toNum);

      if (!result) {
        return NextResponse.json({
          success: true,
          path: null,
          message: 'No path found between the specified nodes',
        });
      }

      return NextResponse.json({
        success: true,
        path: {
          nodes: result.path.map(num => graph.reverseMap.get(num) || `!${num.toString(16).padStart(8, '0')}`),
          nodeNums: result.path,
          hopCount: result.hopCount,
          weight: result.totalWeight,
          reliable: result.reliable,
        },
        stats: getGraphStats(graph),
      });
    }
  } catch (error) {
    console.error('Path analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate path' },
      { status: 500 }
    );
  }
}

/**
 * Convert hex node ID to number
 */
function hexToNum(hexId: string): number {
  const clean = hexId.startsWith('!') ? hexId.slice(1) : hexId;
  return parseInt(clean, 16);
}
