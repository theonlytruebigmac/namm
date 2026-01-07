"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMQTTServer } from "@/hooks/useMQTTServer";
import { processMQTTMessage } from "@/lib/mqtt-processor";
import { Activity, Radio, Trash2, MapPin, Users, MessageCircle, BarChart, Search, Filter, X, Pause, Play, Download } from "lucide-react";

interface MQTTMessage {
  id: number;
  topic: string;
  payload: string;
  timestamp: Date;
  type: string;
  parsedType?: string;
  nodeId?: string;
  data?: any;
}

export default function MQTTPage() {
  const { isConnected, error, messageCount } = useMQTTServer();
  const [messages, setMessages] = useState<MQTTMessage[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pausedMessagesRef = useRef<MQTTMessage[]>([]);

  useEffect(() => {
    // Connect to MQTT stream to receive messages
    const savedSettings = localStorage.getItem("namm-settings");

    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      if (settings.connectionType === "mqtt") {
        const mqttParams = new URLSearchParams({
          broker: settings.mqttBroker || "",
          topic: settings.mqttTopic || "msh/US/#",
        });

        if (settings.mqttUsername) mqttParams.append("username", settings.mqttUsername);
        if (settings.mqttPassword) mqttParams.append("password", settings.mqttPassword);

        const url = `/api/mqtt?${mqttParams.toString()}`;
        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "mqtt.message") {
              // Convert base64 payload back to Buffer for encrypted messages
              const payload = data.isBase64
                ? Buffer.from(data.payload, "base64")
                : data.payload;

              // Use server-side processed result for encrypted messages (crypto only works on server)
              // Fall back to client-side processing for JSON messages
              const processed = data.processed || processMQTTMessage(data.topic, payload);

              // Extract nodeId based on processed type
              let nodeId: string | undefined;
              let processedData: unknown = undefined;

              if (processed && 'data' in processed && processed.data) {
                processedData = processed.data;
                if (typeof processed.data === 'object' && processed.data !== null) {
                  if ('nodeId' in processed.data) {
                    nodeId = (processed.data as { nodeId: string }).nodeId;
                  } else if ('id' in processed.data) {
                    const id = (processed.data as { id: string | number }).id;
                    nodeId = typeof id === 'string' ? id : String(id);
                  } else if ('from' in processed.data) {
                    nodeId = (processed.data as { from: string }).from;
                  }
                }
              }

              // Determine display type
              const isEncryptedTopic = data.topic.includes("/e/");
              const isMapTopic = data.topic.includes("/map/");
              const wasDecrypted = isEncryptedTopic && processedData && !processed.type.includes("error") && !processed.type.includes("failed") && !processed.type.includes("unknown_channel");
              const displayType = wasDecrypted ? "decrypted" : (
                isMapTopic && processedData ? "mapreport" :
                data.topic.includes("/json/") ? "json" :
                isEncryptedTopic ? "encrypted" :
                data.topic.includes("/stat/") ? "status" : "unknown"
              );

              const newMessage: MQTTMessage = {
                id: Date.now(),
                topic: data.topic,
                payload: typeof payload === 'string' ? payload : `[Binary ${payload.length} bytes]`,
                timestamp: new Date(data.timestamp),
                type: displayType,
                parsedType: processed.type,
                nodeId,
                data: processedData,
              };

              setMessages((prev) => {
                if (isPaused) {
                  pausedMessagesRef.current = [newMessage, ...pausedMessagesRef.current].slice(0, 100);
                  return prev;
                }
                return [newMessage, ...prev].slice(0, 100);
              }); // Keep last 100 messages
            }
          } catch (error) {
            console.error("Error parsing message:", error);
          }
        };

        return () => {
          eventSource.close();
        };
      }
    }
  }, []);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [messages, autoScroll]);

  const clearMessages = () => {
    setMessages([]);
    pausedMessagesRef.current = [];
  };

  const togglePause = () => {
    if (isPaused) {
      // Resume - merge paused messages
      setMessages((prev) => [...pausedMessagesRef.current, ...prev].slice(0, 100));
      pausedMessagesRef.current = [];
    }
    setIsPaused(!isPaused);
  };

  // Calculate message type stats
  const messageStats = useMemo(() => {
    const stats: Record<string, number> = {};
    messages.forEach((m) => {
      const type = m.parsedType || m.type || "unknown";
      stats[type] = (stats[type] || 0) + 1;
    });
    return stats;
  }, [messages]);

  // Filter messages based on search and type
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      // Type filter
      if (filterType !== "all") {
        const msgType = m.parsedType || m.type;
        if (msgType !== filterType) return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchFields = [
          m.topic,
          m.nodeId,
          m.parsedType,
          m.payload,
          JSON.stringify(m.data),
        ].filter(Boolean).join(" ").toLowerCase();
        return searchFields.includes(query);
      }

      return true;
    });
  }, [messages, filterType, searchQuery]);

  // Export messages as JSON
  const exportMessages = () => {
    const data = JSON.stringify(filteredMessages, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mqtt-messages-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const messageTypes = ["all", "nodeinfo", "position", "telemetry", "text", "mapreport", "encrypted"];

  const formatPayload = (message: MQTTMessage) => {
    // Show parsed data if available
    if (message.data) {
      return JSON.stringify(message.data, null, 2);
    }

    // Otherwise show raw payload
    try {
      const parsed = JSON.parse(message.payload);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return message.payload;
    }
  };

  const getMessageIcon = (parsedType?: string) => {
    switch (parsedType) {
      case "nodeinfo":
        return <Users className="h-4 w-4" />;
      case "position":
        return <MapPin className="h-4 w-4" />;
      case "telemetry":
        return <BarChart className="h-4 w-4" />;
      case "text":
        return <MessageCircle className="h-4 w-4" />;
      case "mapreport":
        return <MapPin className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getMessageTitle = (message: MQTTMessage) => {
    // If decryption failed, show that status
    if (message.parsedType?.includes("error") || message.parsedType?.includes("failed")) {
      return `🔒 ${message.parsedType}`;
    }

    if (message.data) {
      switch (message.parsedType) {
        case "nodeinfo":
          return `Node: ${message.data.longName || message.data.id} (${message.data.shortName || "?"})`;
        case "position":
          const pos = message.data.position;
          if (pos?.latitude && pos?.longitude) {
            return `Position: ${message.nodeId} @ ${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}`;
          }
          return `Position: ${message.nodeId}`;
        case "telemetry":
          const batt = message.data.batteryLevel;
          return `Telemetry: ${message.nodeId}${batt ? ` (🔋 ${batt}%)` : ""}`;
        case "text":
          return `Message: ${message.data.from} → ${message.data.to}`;
        case "mapreport": {
          const mapPos = message.data.position;
          const name = message.data.longName || message.data.shortName || message.data.id;
          if (mapPos?.latitude && mapPos?.longitude) {
            return `MapReport: ${name} @ ${mapPos.latitude.toFixed(4)}, ${mapPos.longitude.toFixed(4)}`;
          }
          return `MapReport: ${name}`;
        }
        default:
          return message.nodeId || message.parsedType || "Unknown";
      }
    }

    return message.nodeId || "Raw Data";
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 pb-20 md:pb-6">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Radio className="h-8 w-8" />
            MQTT Messages
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "secondary"} className="gap-1">
              <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-gray-500"}`} />
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
            <Badge variant="outline">{messageCount} total</Badge>
          </div>
        </div>
        <p className="text-muted-foreground mt-2">
          Real-time MQTT messages from your configured broker
        </p>
      </div>

      {error && (
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      {messages.length > 0 && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Node Info</span>
              </div>
              <div className="text-2xl font-bold">{messageStats.nodeinfo || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Positions</span>
              </div>
              <div className="text-2xl font-bold">{messageStats.position || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <BarChart className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Telemetry</span>
              </div>
              <div className="text-2xl font-bold">{messageStats.telemetry || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Messages</span>
              </div>
              <div className="text-2xl font-bold">{messageStats.text || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Other</span>
              </div>
              <div className="text-2xl font-bold">
                {messages.length - (messageStats.nodeinfo || 0) - (messageStats.position || 0) - (messageStats.telemetry || 0) - (messageStats.text || 0)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Live Messages</CardTitle>
              <CardDescription>
                Showing {filteredMessages.length} of {messages.length} messages
                {isPaused && pausedMessagesRef.current.length > 0 && (
                  <span className="text-yellow-600 ml-2">
                    ({pausedMessagesRef.current.length} buffered)
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={isPaused ? "default" : "outline"}
                size="sm"
                onClick={togglePause}
              >
                {isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                {isPaused ? "Resume" : "Pause"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoScroll(!autoScroll)}
              >
                Auto-scroll: {autoScroll ? "On" : "Off"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportMessages}
                disabled={filteredMessages.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearMessages}
                disabled={messages.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex gap-1">
              {messageTypes.map((type) => (
                <Button
                  key={type}
                  variant={filterType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType(type)}
                  className="capitalize"
                >
                  {type}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]" ref={scrollRef}>
            {filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                <Activity className="h-12 w-12 mb-4 opacity-50" />
                {messages.length === 0 ? (
                  <>
                    <p>Waiting for MQTT messages...</p>
                    {!isConnected && (
                      <p className="text-sm mt-2">
                        Connect to an MQTT broker in Settings to receive messages
                      </p>
                    )}
                  </>
                ) : (
                  <p>No messages match your filter</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMessages.map((message) => (
                  <Card key={message.id} className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getMessageIcon(message.parsedType)}
                            <Badge
                              variant={
                                message.type === "decrypted" ? "default" :
                                message.parsedType === "encrypted" || message.type === "encrypted" ? "secondary" :
                                "outline"
                              }
                              className={`text-xs ${message.type === "decrypted" ? "bg-green-600" : ""}`}
                            >
                              {message.type === "decrypted" ? `🔓 ${message.parsedType}` : (message.parsedType || message.type)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {message.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm font-medium mb-1">
                            {getMessageTitle(message)}
                          </p>
                          <code className="text-xs text-muted-foreground font-mono">
                            {message.topic}
                          </code>
                        </div>
                      </div>
                      <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">
                        <code>{formatPayload(message)}</code>
                      </pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
