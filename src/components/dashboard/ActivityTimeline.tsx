"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

interface ActivityDataPoint {
  timestamp: number;
  count: number;
  type?: "message" | "telemetry" | "position" | "all";
}

interface ActivityTimelineProps {
  data: ActivityDataPoint[];
  title?: string;
  description?: string;
  height?: number;
  bucketMinutes?: number;
}

export function ActivityTimeline({
  data,
  title = "Network Activity",
  description = "Message and telemetry activity over time",
  height = 100,
  bucketMinutes = 15,
}: ActivityTimelineProps) {
  // Group data into time buckets
  const { buckets, maxCount } = useMemo(() => {
    if (!data.length) return { buckets: [], maxCount: 0 };

    const bucketMs = bucketMinutes * 60 * 1000;
    const now = Date.now();
    const hoursToShow = 24;
    const startTime = now - (hoursToShow * 60 * 60 * 1000);
    const numBuckets = Math.ceil((hoursToShow * 60) / bucketMinutes);

    // Initialize buckets
    const bucketMap = new Map<number, number>();
    for (let i = 0; i < numBuckets; i++) {
      const bucketStart = startTime + (i * bucketMs);
      bucketMap.set(Math.floor(bucketStart / bucketMs), 0);
    }

    // Fill buckets with data
    data.forEach((point) => {
      const bucketKey = Math.floor(point.timestamp / bucketMs);
      if (bucketMap.has(bucketKey)) {
        bucketMap.set(bucketKey, (bucketMap.get(bucketKey) || 0) + point.count);
      }
    });

    const bucketArray = Array.from(bucketMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([key, count]) => ({
        timestamp: key * bucketMs,
        count,
      }));

    const max = Math.max(...bucketArray.map((b) => b.count), 1);

    return { buckets: bucketArray, maxCount: max };
  }, [data, bucketMinutes]);

  const formatHour = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Show time labels at regular intervals
  const labelIndices = useMemo(() => {
    const indices: number[] = [];
    const interval = Math.floor(buckets.length / 6); // ~6 labels
    for (let i = 0; i < buckets.length; i += interval) {
      indices.push(i);
    }
    return indices;
  }, [buckets]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {buckets.length === 0 ? (
          <div className="h-[100px] flex items-center justify-center text-[hsl(var(--muted-foreground))] text-sm">
            No activity data available
          </div>
        ) : (
          <div>
            {/* Bar chart */}
            <div
              className="flex items-end gap-[2px] w-full"
              style={{ height: `${height}px` }}
            >
              {buckets.map((bucket, i) => {
                const barHeight = (bucket.count / maxCount) * 100;
                const isActive = bucket.count > 0;

                return (
                  <div
                    key={i}
                    className="flex-1 min-w-[2px] group relative"
                    style={{ height: "100%" }}
                  >
                    <div
                      className={`absolute bottom-0 w-full rounded-t transition-all ${
                        isActive
                          ? "bg-[hsl(var(--green))] group-hover:bg-[hsl(var(--primary))]"
                          : "bg-[hsl(var(--muted))]"
                      }`}
                      style={{ height: `${Math.max(barHeight, 2)}%` }}
                    />
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] px-2 py-1 rounded text-xs whitespace-nowrap shadow-lg border border-[hsl(var(--border))]">
                        <div className="font-medium">{bucket.count} events</div>
                        <div className="text-[hsl(var(--muted-foreground))]">
                          {formatHour(bucket.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time labels */}
            <div className="flex justify-between mt-2 text-xs text-[hsl(var(--muted-foreground))]">
              {labelIndices.map((idx) => (
                <span key={idx}>{formatHour(buckets[idx]?.timestamp || 0)}</span>
              ))}
              <span>Now</span>
            </div>

            {/* Stats */}
            <div className="flex gap-4 mt-3 pt-3 border-t border-[hsl(var(--border))]">
              <div className="text-sm">
                <span className="text-[hsl(var(--muted-foreground))]">Total: </span>
                <span className="font-medium">
                  {buckets.reduce((sum, b) => sum + b.count, 0).toLocaleString()}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-[hsl(var(--muted-foreground))]">Peak: </span>
                <span className="font-medium">{maxCount.toLocaleString()}</span>
              </div>
              <div className="text-sm">
                <span className="text-[hsl(var(--muted-foreground))]">Avg: </span>
                <span className="font-medium">
                  {Math.round(
                    buckets.reduce((sum, b) => sum + b.count, 0) / buckets.length
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper component to create timeline from messages
interface MessageActivityTimelineProps {
  messages: { timestamp: number }[];
  title?: string;
}

export function MessageActivityTimeline({ messages, title = "Message Activity" }: MessageActivityTimelineProps) {
  const data = useMemo(() => {
    return messages.map((m) => ({
      timestamp: m.timestamp,
      count: 1,
      type: "message" as const,
    }));
  }, [messages]);

  return (
    <ActivityTimeline
      data={data}
      title={title}
      description="Messages over the last 24 hours"
    />
  );
}
