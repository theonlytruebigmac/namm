"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTimestamp } from "@/lib/utils";
import { apiGet, apiPost, apiDelete } from "@/lib/api/http";
import {
  Radio,
  Play,
  Square,
  Download,
  Trash2,
  FileAudio,
  Clock,
  HardDrive,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";

interface CaptureSession {
  id: string;
  filename: string;
  startTime: number;
  endTime?: number;
  packetCount: number;
  byteCount: number;
  status: "active" | "stopped" | "error";
}

interface CaptureFile {
  filename: string;
  size: number;
  created: number;
}

interface CaptureStatusResponse {
  success: boolean;
  capturing: boolean;
  session: CaptureSession | null;
}

interface CapturesListResponse {
  success: boolean;
  captures: CaptureFile[];
}

function useCaptureStatus() {
  return useQuery({
    queryKey: ["captures", "status"],
    queryFn: async (): Promise<CaptureStatusResponse> => {
      return apiGet<CaptureStatusResponse>("/api/captures?action=status");
    },
    refetchInterval: 2000, // Poll every 2 seconds
  });
}

function useCapturesList() {
  return useQuery({
    queryKey: ["captures", "list"],
    queryFn: async (): Promise<CapturesListResponse> => {
      return apiGet<CapturesListResponse>("/api/captures");
    },
    refetchInterval: 5000,
  });
}

function useStartCapture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (filter?: { nodeIds?: string[]; channels?: number[]; portnums?: number[] }) => {
      return apiPost("/api/captures", { action: "start", filter });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["captures"] });
    },
  });
}

function useStopCapture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return apiPost("/api/captures", { action: "stop" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["captures"] });
    },
  });
}

function useDeleteCapture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (filename: string) => {
      return apiDelete(`/api/captures?filename=${encodeURIComponent(filename)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["captures", "list"] });
    },
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(startTime: number, endTime?: number): string {
  const end = endTime || Date.now();
  const durationMs = end - startTime;
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export default function CapturesPage() {
  const { data: status, isLoading: statusLoading } = useCaptureStatus();
  const { data: capturesData, isLoading: capturesLoading } = useCapturesList();
  const startCapture = useStartCapture();
  const stopCapture = useStopCapture();
  const deleteCapture = useDeleteCapture();

  const isCapturing = status?.capturing || false;
  const currentSession = status?.session;
  const captures = capturesData?.captures || [];

  const handleDownload = (filename: string) => {
    window.open(`/api/captures/${encodeURIComponent(filename)}`, "_blank");
  };

  if (statusLoading || capturesLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">
          Packet Capture
        </h1>
        <p className="text-[hsl(var(--muted-foreground))]">
          Capture mesh network traffic in Wireshark-compatible PCAP format for analysis
        </p>
      </div>

      {/* Capture Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Capture Control
          </CardTitle>
          <CardDescription>
            Start or stop packet capture. Captured packets can be analyzed in Wireshark.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {isCapturing ? (
              <>
                <Button
                  variant="destructive"
                  onClick={() => stopCapture.mutate()}
                  disabled={stopCapture.isPending}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop Capture
                </Button>
                <div className="flex items-center gap-4">
                  <Badge variant="default" className="animate-pulse">
                    Recording
                  </Badge>
                  {currentSession && (
                    <>
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">
                        {currentSession.packetCount} packets
                      </span>
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">
                        {formatBytes(currentSession.byteCount)}
                      </span>
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">
                        {formatDuration(currentSession.startTime)}
                      </span>
                    </>
                  )}
                </div>
              </>
            ) : (
              <Button
                onClick={() => startCapture.mutate(undefined)}
                disabled={startCapture.isPending}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Capture
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-[hsl(var(--blue))]" />
            PCAP Format
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-[hsl(var(--muted-foreground))]">
            <p>
              Captures use a custom Meshtastic packet format (DLT_USER0 / Link Type 147).
              Each packet includes:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>16-byte metadata header (Node ID, Channel, Portnum, SNR, RSSI, Hop info)</li>
              <li>Raw encrypted or decrypted packet payload</li>
            </ul>
            <p className="mt-3">
              To analyze in Wireshark, you may need to create a custom dissector for the Meshtastic protocol.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Saved Captures */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileAudio className="h-5 w-5" />
            Saved Captures
          </CardTitle>
          <CardDescription>
            {captures.length} capture{captures.length !== 1 ? "s" : ""} saved
          </CardDescription>
        </CardHeader>
        <CardContent>
          {captures.length === 0 ? (
            <EmptyState
              icon={FileAudio}
              title="No captures yet"
              description="Start a capture to record mesh network traffic for analysis."
            />
          ) : (
            <div className="space-y-2">
              {captures.map((capture) => (
                <div
                  key={capture.filename}
                  className="flex items-center justify-between p-4 bg-[hsl(var(--muted))] rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <FileAudio className="h-8 w-8 text-[hsl(var(--primary))]" />
                    <div>
                      <div className="font-mono text-sm font-medium text-[hsl(var(--foreground))]">
                        {capture.filename}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[hsl(var(--muted-foreground))]">
                        <span className="flex items-center gap-1">
                          <HardDrive className="h-3 w-3" />
                          {formatBytes(capture.size)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(capture.created)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(capture.filename)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCapture.mutate(capture.filename)}
                      disabled={deleteCapture.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
