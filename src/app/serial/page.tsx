"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWebSerial } from "@/hooks/useWebSerial";
import {
  Usb,
  Trash2,
  MapPin,
  Users,
  MessageCircle,
  BarChart,
  Search,
  X,
  Pause,
  Play,
  Download,
  Plug,
  Unplug,
  Activity,
  Settings,
  Package,
  Radio,
  Thermometer,
  Battery,
  Navigation,
  Route,
} from "lucide-react";

// Lazy-load the packet decoder to avoid bundler issues
let packetDecoder: typeof import("@/lib/webserial/packet-decoder") | null = null;

async function getPacketDecoder() {
  if (!packetDecoder) {
    packetDecoder = await import("@/lib/webserial/packet-decoder");
  }
  return packetDecoder;
}

// Type for decoded payload (inline to avoid import issues)
interface DecodedPayload {
  type: string;
  portnum: number;
  portnumName: string;
  [key: string]: unknown;
}

interface SerialMessage {
  id: number;
  type: string;
  timestamp: Date;
  data: Record<string, unknown>;
  raw?: string;
  decodedPayload?: DecodedPayload;
}

export default function SerialPage() {
  const { isConnected, isSupported, connect, disconnect } = useWebSerial();
  const [messages, setMessages] = useState<SerialMessage[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedMessagesRef = useRef<SerialMessage[]>([]);
  const messageIdRef = useRef(0);

  // Subscribe to serial messages from the webSerial instance
  useEffect(() => {
    // Import the webSerial singleton to listen for messages
    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const { webSerial } = await import("@/lib/webserial/web-serial");
        const decoder = await getPacketDecoder();

        unsubscribe = webSerial.onMessage((message) => {
          // Decode packet payload if this is a packet message
          let decodedPayload: DecodedPayload | undefined;
          if (message.type === "packet" && message.data.packet) {
            const packet = message.data.packet as Record<string, unknown>;
            if (packet.decoded && typeof packet.decoded === "object") {
              const decoded = packet.decoded as Record<string, unknown>;
              const portnum = decoded.portnum as number;
              const payload = decoded.payload;
              if (portnum !== undefined && payload) {
                try {
                  decodedPayload = decoder.decodePacketPayload(portnum, payload as Record<string, number>) as DecodedPayload;
                } catch (e) {
                  console.error("Failed to decode payload:", e);
                }
              }
            }
          }

          const newMessage: SerialMessage = {
            id: messageIdRef.current++,
            type: message.type,
            timestamp: new Date(),
            data: message.data,
            raw: message.raw ? `[${message.raw.length} bytes]` : undefined,
            decodedPayload,
          };

          setMessages((prev) => {
            if (isPaused) {
              pausedMessagesRef.current = [newMessage, ...pausedMessagesRef.current].slice(0, 100);
              return prev;
            }
            return [newMessage, ...prev].slice(0, 100);
          });
        });
      } catch (error) {
        console.error("Failed to setup serial message listener:", error);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isPaused]);

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

  const handleConnect = useCallback(async () => {
    try {
      await connect();
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  }, [connect]);

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  }, [disconnect]);

  // Calculate message type stats (including decoded packet types)
  const messageStats = useMemo(() => {
    const stats: Record<string, number> = {};
    messages.forEach((m) => {
      // Use the more specific filter type for stats
      const type = getFilterType(m);
      stats[type] = (stats[type] || 0) + 1;
    });
    return stats;
  }, [messages]);

  // Filter messages based on search and type
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      // Type filter
      if (filterType !== "all") {
        const msgType = getFilterType(m);
        if (msgType !== filterType) return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchFields = [
          m.type,
          JSON.stringify(m.data),
          m.decodedPayload ? JSON.stringify(m.decodedPayload) : "",
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
    a.download = `serial-messages-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const messageTypes = ["all", "myInfo", "nodeInfo", "packet", "position", "telemetry", "text", "channel", "config", "configComplete", "metadata", "unknown"];

  // Get a more specific type for filtering based on decoded payload
  const getFilterType = (message: SerialMessage): string => {
    if (message.type === "packet" && message.decodedPayload) {
      switch (message.decodedPayload.portnum) {
        case PORTNUM.TEXT_MESSAGE_APP:
          return "text";
        case PORTNUM.POSITION_APP:
          return "position";
        case PORTNUM.TELEMETRY_APP:
          return "telemetry";
        default:
          return "packet";
      }
    }
    return message.type;
  };

  const formatPayload = (message: SerialMessage) => {
    // If we have decoded payload, show that in a more readable format
    if (message.decodedPayload) {
      const decoded = message.decodedPayload;
      const formatted: Record<string, unknown> = {
        portnum: `${decoded.portnum} (${decoded.portnumName})`,
      };

      if (decoded.text) {
        formatted.text = decoded.text;
      }
      if (decoded.position) {
        formatted.position = {
          latitude: decoded.position.latitude?.toFixed(6),
          longitude: decoded.position.longitude?.toFixed(6),
          altitude: decoded.position.altitude,
          time: decoded.position.time ? new Date(decoded.position.time * 1000).toISOString() : undefined,
        };
      }
      if (decoded.user) {
        formatted.user = {
          id: decoded.user.id,
          longName: decoded.user.longName,
          shortName: decoded.user.shortName,
          hwModel: decoded.user.hwModelName,
          role: decoded.user.role,
        };
      }
      if (decoded.telemetry) {
        formatted.telemetry = {};
        if (decoded.telemetry.deviceMetrics) {
          (formatted.telemetry as Record<string, unknown>).device = {
            battery: decoded.telemetry.deviceMetrics.batteryLevel !== undefined
              ? `${decoded.telemetry.deviceMetrics.batteryLevel}%`
              : undefined,
            voltage: decoded.telemetry.deviceMetrics.voltage?.toFixed(2),
            channelUtilization: decoded.telemetry.deviceMetrics.channelUtilization?.toFixed(1),
            airUtilTx: decoded.telemetry.deviceMetrics.airUtilTx?.toFixed(1),
            uptime: decoded.telemetry.deviceMetrics.uptimeSeconds,
          };
        }
        if (decoded.telemetry.environmentMetrics) {
          (formatted.telemetry as Record<string, unknown>).environment = {
            temperature: decoded.telemetry.environmentMetrics.temperature?.toFixed(1),
            humidity: decoded.telemetry.environmentMetrics.relativeHumidity?.toFixed(1),
            pressure: decoded.telemetry.environmentMetrics.barometricPressure?.toFixed(1),
          };
        }
      }
      if (decoded.neighborInfo) {
        formatted.neighborInfo = {
          nodeId: decoded.neighborInfo.nodeId ? nodeNumToId(decoded.neighborInfo.nodeId) : undefined,
          neighbors: decoded.neighborInfo.neighbors?.map(n => ({
            nodeId: nodeNumToId(n.nodeId),
            snr: n.snr?.toFixed(1),
          })),
        };
      }
      if (decoded.routing) {
        formatted.routing = decoded.routing;
      }
      if (decoded.traceroute) {
        formatted.traceroute = {
          route: decoded.traceroute.route?.map(n => nodeNumToId(n)),
          routeBack: decoded.traceroute.routeBack?.map(n => nodeNumToId(n)),
        };
      }

      // Also include the original packet metadata
      if (message.data.packet) {
        const packet = message.data.packet as Record<string, unknown>;
        formatted.from = nodeNumToId(packet.from as number);
        formatted.to = packet.to === 0xffffffff ? "BROADCAST" : nodeNumToId(packet.to as number);
        if (packet.channel !== undefined) formatted.channel = packet.channel;
        if (packet.rxSnr !== undefined) formatted.snr = packet.rxSnr;
        if (packet.rxRssi !== undefined) formatted.rssi = packet.rxRssi;
      }

      return JSON.stringify(formatted, null, 2);
    }

    if (message.data) {
      return JSON.stringify(message.data, null, 2);
    }
    return message.raw || "No data";
  };

  const getMessageIcon = (type: string, decodedPayload?: DecodedPayload) => {
    // For packets, use portnum-specific icons
    if (type === "packet" && decodedPayload) {
      switch (decodedPayload.portnum) {
        case PORTNUM.TEXT_MESSAGE_APP:
          return <MessageCircle className="h-4 w-4" />;
        case PORTNUM.POSITION_APP:
          return <MapPin className="h-4 w-4" />;
        case PORTNUM.NODEINFO_APP:
          return <Users className="h-4 w-4" />;
        case PORTNUM.TELEMETRY_APP:
          return <BarChart className="h-4 w-4" />;
        case PORTNUM.NEIGHBORINFO_APP:
          return <Users className="h-4 w-4" />;
        case PORTNUM.TRACEROUTE_APP:
          return <Route className="h-4 w-4" />;
        case PORTNUM.ROUTING_APP:
          return <Navigation className="h-4 w-4" />;
        default:
          return <Package className="h-4 w-4" />;
      }
    }

    switch (type) {
      case "myInfo":
        return <Settings className="h-4 w-4" />;
      case "nodeInfo":
        return <Users className="h-4 w-4" />;
      case "packet":
        return <Package className="h-4 w-4" />;
      case "channel":
        return <Radio className="h-4 w-4" />;
      case "config":
      case "configComplete":
        return <Settings className="h-4 w-4" />;
      case "metadata":
        return <Activity className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getMessageTitle = (message: SerialMessage) => {
    const { type, data, decodedPayload } = message;

    switch (type) {
      case "myInfo":
        return `My Node: ${data.myNodeNum || "Unknown"}`;
      case "nodeInfo":
        if (data.user && typeof data.user === "object") {
          const user = data.user as Record<string, unknown>;
          return `Node: ${user.longName || user.shortName || data.num || "Unknown"}`;
        }
        return `Node: ${data.num || "Unknown"}`;
      case "packet":
        if (data.packet && typeof data.packet === "object") {
          const packet = data.packet as Record<string, unknown>;
          const from = nodeNumToId(packet.from as number);
          const to = packet.to === 0xffffffff ? "BROADCAST" : nodeNumToId(packet.to as number);

          // Use decoded payload for better description
          if (decodedPayload) {
            switch (decodedPayload.portnum) {
              case PORTNUM.TEXT_MESSAGE_APP:
                const preview = decodedPayload.text?.substring(0, 30) || "";
                return `Message: ${from} → ${to}: "${preview}${preview.length >= 30 ? "..." : ""}"`;
              case PORTNUM.POSITION_APP:
                if (decodedPayload.position?.latitude && decodedPayload.position?.longitude) {
                  return `Position: ${from} (${decodedPayload.position.latitude.toFixed(4)}, ${decodedPayload.position.longitude.toFixed(4)})`;
                }
                return `Position: ${from}`;
              case PORTNUM.NODEINFO_APP:
                if (decodedPayload.user) {
                  return `NodeInfo: ${decodedPayload.user.longName || decodedPayload.user.shortName || from}`;
                }
                return `NodeInfo: ${from}`;
              case PORTNUM.TELEMETRY_APP:
                if (decodedPayload.telemetry?.deviceMetrics) {
                  const dm = decodedPayload.telemetry.deviceMetrics;
                  const battery = dm.batteryLevel !== undefined ? `${dm.batteryLevel}%` : "";
                  return `Telemetry: ${from} ${battery}`;
                }
                if (decodedPayload.telemetry?.environmentMetrics) {
                  const em = decodedPayload.telemetry.environmentMetrics;
                  const temp = em.temperature !== undefined ? `${em.temperature.toFixed(1)}°C` : "";
                  return `Environment: ${from} ${temp}`;
                }
                return `Telemetry: ${from}`;
              case PORTNUM.NEIGHBORINFO_APP:
                const count = decodedPayload.neighborInfo?.neighbors?.length || 0;
                return `NeighborInfo: ${from} (${count} neighbors)`;
              case PORTNUM.TRACEROUTE_APP:
                const hops = decodedPayload.traceroute?.route?.length || 0;
                return `Traceroute: ${from} (${hops} hops)`;
              case PORTNUM.ROUTING_APP:
                return `Routing: ${from} → ${to} (${decodedPayload.routing?.errorReasonName || "ACK"})`;
              default:
                return `${decodedPayload.portnumName}: ${from} → ${to}`;
            }
          }

          // Fallback to basic info
          if (packet.decoded && typeof packet.decoded === "object") {
            const decoded = packet.decoded as Record<string, unknown>;
            const portnum = decoded.portnum || "unknown";
            return `Packet: ${from} → ${to} (${getPortnumName(portnum as number)})`;
          }
          return `Packet: ${from} → ${to}`;
        }
        return `Packet: ${data.from || "?"} → ${data.to || "?"}`;
      case "channel":
        if (data.settings && typeof data.settings === "object") {
          const settings = data.settings as Record<string, unknown>;
          return `Channel ${data.index}: ${settings.name || "Unnamed"}`;
        }
        return `Channel: ${data.index || "?"}`;
      case "config":
        return `Config: ${Object.keys(data)[0] || "Settings"}`;
      case "configComplete":
        return "Configuration Complete";
      case "metadata":
        return `Metadata: ${data.firmwareVersion || "Unknown version"}`;
      default:
        return type || "Unknown";
    }
  };

  const getTypeBadgeVariant = (type: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (type) {
      case "packet":
        return "default";
      case "nodeInfo":
        return "secondary";
      case "myInfo":
      case "config":
      case "configComplete":
        return "outline";
      default:
        return "secondary";
    }
  };

  if (!isSupported) {
    return (
      <div className="flex-1 space-y-6 p-4 md:p-6 pb-20 md:pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Usb className="h-8 w-8" />
            Serial Messages
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitor raw serial data from your Meshtastic device
          </p>
        </div>

        <Card className="border-yellow-500">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Usb className="h-8 w-8 text-yellow-500 shrink-0" />
              <div>
                <h3 className="font-semibold text-lg">Web Serial Not Supported</h3>
                <p className="text-muted-foreground mt-1">
                  Your browser doesn&apos;t support the Web Serial API. Please use a Chromium-based browser
                  (Chrome, Edge, Brave, Opera) to connect to Meshtastic devices via USB.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Additionally, Web Serial requires a secure context (HTTPS or localhost).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 pb-20 md:pb-6">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Usb className="h-8 w-8" />
            Serial Messages
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "secondary"} className="gap-1">
              <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-gray-500"}`} />
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
            <Badge variant="outline">{messages.length} messages</Badge>
            {isConnected ? (
              <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                <Unplug className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            ) : (
              <Button variant="default" size="sm" onClick={handleConnect}>
                <Plug className="h-4 w-4 mr-2" />
                Connect
              </Button>
            )}
          </div>
        </div>
        <p className="text-muted-foreground mt-2">
          Real-time serial data from your connected Meshtastic device
        </p>
      </div>

      {/* Stats Cards */}
      {messages.length > 0 && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Position</span>
              </div>
              <div className="text-2xl font-bold">{messageStats.position || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <BarChart className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Telemetry</span>
              </div>
              <div className="text-2xl font-bold">{messageStats.telemetry || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Text</span>
              </div>
              <div className="text-2xl font-bold">{messageStats.text || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Node Info</span>
              </div>
              <div className="text-2xl font-bold">{messageStats.nodeInfo || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Other Packets</span>
              </div>
              <div className="text-2xl font-bold">
                {(messageStats.packet || 0) + (messageStats.myInfo || 0) + (messageStats.channel || 0) + (messageStats.config || 0) + (messageStats.configComplete || 0) + (messageStats.metadata || 0)}
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
            <div className="flex gap-1 flex-wrap">
              {messageTypes.map((type) => (
                <Button
                  key={type}
                  variant={filterType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType(type)}
                  className="text-xs"
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
                <Usb className="h-12 w-12 mb-4 opacity-50" />
                {messages.length === 0 ? (
                  <>
                    <p>Waiting for serial messages...</p>
                    {!isConnected && (
                      <p className="text-sm mt-2">
                        Click &quot;Connect&quot; to connect to a Meshtastic device via USB
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
                            {getMessageIcon(message.type, message.decodedPayload)}
                            <Badge variant={getTypeBadgeVariant(message.type)} className="text-xs">
                              {message.decodedPayload ? message.decodedPayload.portnumName : message.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {message.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm font-medium mb-1">
                            {getMessageTitle(message)}
                          </p>
                          {message.raw && (
                            <code className="text-xs text-muted-foreground font-mono">
                              {message.raw}
                            </code>
                          )}
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
