/**
 * Node History API Endpoint
 *
 * GET /api/nodes/[id]/history - Get historical data for a node
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { TelemetryRepository } from '@/lib/db/repositories/telemetry';
import { PositionRepository } from '@/lib/db/repositories/positions';
import { MessageRepository } from '@/lib/db/repositories/messages';
import { TracerouteRepository } from '@/lib/db/repositories/traceroutes';

interface TimelineEvent {
  id: string;
  type: 'telemetry' | 'position' | 'message' | 'traceroute';
  timestamp: number;
  data: Record<string, unknown>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: nodeId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const since = searchParams.get('since');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const type = searchParams.get('type'); // telemetry, position, message, traceroute, or all

    const db = await getDatabase();
    const telemetryRepo = new TelemetryRepository(db);
    const positionRepo = new PositionRepository(db);
    const messageRepo = new MessageRepository(db);
    const tracerouteRepo = new TracerouteRepository(db);

    const events: TimelineEvent[] = [];
    const sinceTime = since ? parseInt(since, 10) : Date.now() - (7 * 24 * 60 * 60 * 1000); // Default: 7 days

    // Get telemetry history
    if (!type || type === 'all' || type === 'telemetry') {
      const telemetry = telemetryRepo.getAllForNode(nodeId, limit);
      for (const t of telemetry) {
        if (t.timestamp > sinceTime) {
          events.push({
            id: `telemetry-${t.id}`,
            type: 'telemetry',
            timestamp: t.timestamp,
            data: {
              batteryLevel: t.battery_level,
              voltage: t.voltage,
              channelUtilization: t.channel_utilization,
              airUtilTx: t.air_util_tx,
              uptime: t.uptime,
              temperature: t.temperature,
              snr: t.snr,
              rssi: t.rssi,
            },
          });
        }
      }
    }

    // Get position history
    if (!type || type === 'all' || type === 'position') {
      const positions = positionRepo.getAllForNode(nodeId, limit);
      for (const p of positions) {
        if (p.timestamp > sinceTime) {
          events.push({
            id: `position-${p.id}`,
            type: 'position',
            timestamp: p.timestamp,
            data: {
              latitude: p.latitude,
              longitude: p.longitude,
              altitude: p.altitude,
              snr: p.snr,
              rssi: p.rssi,
            },
          });
        }
      }
    }

    // Get messages sent by this node
    if (!type || type === 'all' || type === 'message') {
      const messages = messageRepo.getAll({ fromId: nodeId, since: sinceTime });
      for (const m of messages.slice(0, limit)) {
        events.push({
          id: `message-${m.id}`,
          type: 'message',
          timestamp: m.timestamp,
          data: {
            toId: m.to_id,
            channel: m.channel,
            text: m.text?.substring(0, 100), // Truncate for timeline
            hopsAway: m.hops_away,
          },
        });
      }
    }

    // Get traceroutes involving this node
    if (!type || type === 'all' || type === 'traceroute') {
      const traceroutes = tracerouteRepo.getForNode(nodeId, limit);
      for (const t of traceroutes) {
        if (t.timestamp > sinceTime) {
          events.push({
            id: `traceroute-${t.id}`,
            type: 'traceroute',
            timestamp: t.timestamp,
            data: {
              fromId: t.fromId,
              toId: t.toId,
              hops: t.hops,
              success: t.success,
              direction: t.fromId === nodeId ? 'outgoing' : 'incoming',
            },
          });
        }
      }
    }

    // Sort by timestamp descending
    events.sort((a, b) => b.timestamp - a.timestamp);

    // Limit total events
    const limitedEvents = events.slice(0, limit);

    // Calculate summary stats
    const telemetryCount = events.filter(e => e.type === 'telemetry').length;
    const positionCount = events.filter(e => e.type === 'position').length;
    const messageCount = events.filter(e => e.type === 'message').length;
    const tracerouteCount = events.filter(e => e.type === 'traceroute').length;

    return NextResponse.json({
      success: true,
      nodeId,
      events: limitedEvents,
      summary: {
        totalEvents: events.length,
        telemetryCount,
        positionCount,
        messageCount,
        tracerouteCount,
        since: sinceTime,
      },
    });
  } catch (error) {
    console.error('Node history error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get node history' },
      { status: 500 }
    );
  }
}
