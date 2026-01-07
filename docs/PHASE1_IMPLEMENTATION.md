# NAMM Phase 1 Implementation Guide

## Frontend Development with Mock Data

This guide provides step-by-step instructions for building the NAMM frontend. Follow these sections in order for best results.

---

## Section 1: Project Initialization

### Step 1.1: Create Next.js Project

```bash
cd /home/fraziersystems/Documents/projects/naam/NAMM

# Create Next.js 15 project
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Verify installation
npm run dev
```

### Step 1.2: Install Core Dependencies

```bash
# UI Components
npm install @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-popover
npm install @radix-ui/react-select @radix-ui/react-switch @radix-ui/react-avatar
npm install class-variance-authority clsx tailwind-merge

# State Management
npm install @tanstack/react-query zustand

# Forms & Validation
npm install react-hook-form @hookform/resolvers zod

# Icons & Animations
npm install lucide-react framer-motion

# Charts
npm install recharts

# Maps (with SSR disabled imports)
npm install leaflet react-leaflet
npm install -D @types/leaflet

# Network Graph
npm install react-force-graph-2d

# Date handling
npm install date-fns
```

### Step 1.3: Configure Tailwind for Catppuccin

Update `tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Catppuccin Mocha
        rosewater: "#f5e0dc",
        flamingo: "#f2cdcd",
        pink: "#f5c2e7",
        mauve: "#cba6f7",
        red: "#f38ba8",
        maroon: "#eba0ac",
        peach: "#fab387",
        yellow: "#f9e2af",
        green: "#a6e3a1",
        teal: "#94e2d5",
        sky: "#89dceb",
        sapphire: "#74c7ec",
        blue: "#89b4fa",
        lavender: "#b4befe",
        text: "#cdd6f4",
        subtext1: "#bac2de",
        subtext0: "#a6adc8",
        overlay2: "#9399b2",
        overlay1: "#7f849c",
        overlay0: "#6c7086",
        surface2: "#585b70",
        surface1: "#45475a",
        surface0: "#313244",
        base: "#1e1e2e",
        mantle: "#181825",
        crust: "#11111b",

        // Semantic aliases
        background: "#1e1e2e",
        foreground: "#cdd6f4",
        card: "#181825",
        "card-foreground": "#cdd6f4",
        primary: "#cba6f7",
        "primary-foreground": "#1e1e2e",
        secondary: "#313244",
        "secondary-foreground": "#cdd6f4",
        muted: "#313244",
        "muted-foreground": "#a6adc8",
        accent: "#45475a",
        "accent-foreground": "#cdd6f4",
        destructive: "#f38ba8",
        "destructive-foreground": "#1e1e2e",
        border: "#45475a",
        input: "#45475a",
        ring: "#cba6f7",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
```

### Step 1.4: Create Utility Functions

Create `src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;

  // Less than 1 minute
  if (diff < 60000) return "Just now";

  // Less than 1 hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }

  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  // More than 24 hours
  return date.toLocaleDateString();
}

export function formatNodeId(id: string): string {
  return id.startsWith("!") ? id : `!${id}`;
}

export function formatBatteryLevel(level: number | undefined): string {
  if (level === undefined) return "N/A";
  return `${level}%`;
}

export function formatSignalStrength(rssi: number | undefined): string {
  if (rssi === undefined) return "N/A";
  if (rssi >= -50) return "Excellent";
  if (rssi >= -70) return "Good";
  if (rssi >= -85) return "Fair";
  return "Poor";
}
```

---

## Section 2: Type Definitions

### Step 2.1: Create Core Types

Create `src/types/node.ts`:

```typescript
export interface Node {
  id: string;
  nodeNum: number;
  shortName: string;
  longName: string;
  hwModel: HardwareModel;
  role: NodeRole;
  batteryLevel?: number;
  voltage?: number;
  snr?: number;
  rssi?: number;
  lastHeard: number;
  position?: Position;
  hopsAway?: number;
  isMobile?: boolean;
  isFavorite?: boolean;
  channelUtilization?: number;
  airUtilTx?: number;
  uptime?: number;
}

export interface Position {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  timestamp?: number;
}

export type NodeRole =
  | "CLIENT"
  | "CLIENT_MUTE"
  | "ROUTER"
  | "ROUTER_CLIENT"
  | "REPEATER"
  | "TRACKER"
  | "SENSOR"
  | "TAK"
  | "CLIENT_HIDDEN"
  | "LOST_AND_FOUND"
  | "TAK_TRACKER";

export type HardwareModel =
  | "HELTEC_V3"
  | "TBEAM"
  | "TBEAM_S3_CORE"
  | "TLORA_V2"
  | "STATION_G2"
  | "RAK4631"
  | "RAK11200"
  | "NANO_G2_ULTRA"
  | "LILYGO_TWATCH_S3"
  | "PORTDUINO"
  | "UNSET"
  | string;

export const NODE_ROLE_LABELS: Record<NodeRole, string> = {
  CLIENT: "Client",
  CLIENT_MUTE: "Client Mute",
  ROUTER: "Router",
  ROUTER_CLIENT: "Router Client",
  REPEATER: "Repeater",
  TRACKER: "Tracker",
  SENSOR: "Sensor",
  TAK: "TAK",
  CLIENT_HIDDEN: "Client Hidden",
  LOST_AND_FOUND: "Lost and Found",
  TAK_TRACKER: "TAK Tracker",
};

export const HARDWARE_MODEL_LABELS: Record<string, string> = {
  HELTEC_V3: "Heltec V3",
  TBEAM: "T-Beam",
  TBEAM_S3_CORE: "T-Beam S3 Core",
  TLORA_V2: "T-LoRa V2",
  STATION_G2: "Station G2",
  RAK4631: "RAK 4631",
  RAK11200: "RAK 11200",
  NANO_G2_ULTRA: "Nano G2 Ultra",
  LILYGO_TWATCH_S3: "LilyGo T-Watch S3",
  PORTDUINO: "Native/Portduino",
  UNSET: "Unknown",
};
```

Create `src/types/message.ts`:

```typescript
export interface Message {
  id: string;
  fromNode: string;
  toNode: string;
  text: string;
  channel: number;
  timestamp: number;
  reactions?: Reaction[];
  replyTo?: string;
  status?: MessageStatus;
  hopStart?: number;
  hopLimit?: number;
}

export interface Reaction {
  emoji: ReactionEmoji;
  fromNodes: string[];
}

export type ReactionEmoji = "👍" | "👎" | "❓" | "❗" | "😂" | "😢" | "💩";

export type MessageStatus = "pending" | "sent" | "delivered" | "failed";

export const REACTION_EMOJIS: ReactionEmoji[] = [
  "👍",
  "👎",
  "❓",
  "❗",
  "😂",
  "😢",
  "💩",
];
```

Create `src/types/channel.ts`:

```typescript
export interface Channel {
  index: number;
  name: string;
  psk?: string;
  isEncrypted: boolean;
  uplinkEnabled: boolean;
  downlinkEnabled: boolean;
  unreadCount: number;
  lastMessage?: string;
  lastMessageTime?: number;
}

export const DEFAULT_CHANNEL_NAMES = [
  "Primary",
  "Secondary",
  "Admin",
  "Direct",
  "Channel 4",
  "Channel 5",
  "Channel 6",
  "Channel 7",
];
```

Create `src/types/index.ts`:

```typescript
export * from "./node";
export * from "./message";
export * from "./channel";
```

---

## Section 3: Mock Data

### Step 3.1: Create Mock Nodes

Create `src/lib/mock/nodes.ts`:

```typescript
import { Node, NodeRole, HardwareModel } from "@/types";

const createNode = (
  num: number,
  shortName: string,
  longName: string,
  role: NodeRole,
  hwModel: HardwareModel,
  options: Partial<Node> = {}
): Node => ({
  id: `!${num.toString(16).padStart(8, "0")}`,
  nodeNum: num,
  shortName,
  longName,
  role,
  hwModel,
  lastHeard: Date.now() - Math.random() * 3600000, // Random time in last hour
  batteryLevel: Math.floor(Math.random() * 40) + 60,
  voltage: 3.7 + Math.random() * 0.5,
  snr: Math.random() * 20 - 5,
  rssi: Math.floor(Math.random() * 50) - 90,
  hopsAway: Math.floor(Math.random() * 3),
  ...options,
});

export const mockNodes: Node[] = [
  // Local node (self)
  createNode(0xabcd1234, "BASE", "Base Station Alpha", "ROUTER", "STATION_G2", {
    hopsAway: 0,
    batteryLevel: 100,
    position: { latitude: 37.7749, longitude: -122.4194, altitude: 10 },
    isFavorite: true,
  }),

  // Nearby routers
  createNode(0xdef56789, "RTR1", "Router One", "ROUTER", "HELTEC_V3", {
    hopsAway: 1,
    position: { latitude: 37.7849, longitude: -122.4094, altitude: 25 },
    isFavorite: true,
  }),
  createNode(0xghi90123, "RTR2", "Router Two", "ROUTER_CLIENT", "RAK4631", {
    hopsAway: 1,
    position: { latitude: 37.7649, longitude: -122.4294, altitude: 50 },
  }),

  // Client nodes
  createNode(0x11111111, "JOE", "Joe's Heltec", "CLIENT", "HELTEC_V3", {
    hopsAway: 2,
    position: { latitude: 37.7800, longitude: -122.4100, altitude: 5 },
    isMobile: true,
  }),
  createNode(0x22222222, "SARA", "Sara's T-Beam", "CLIENT", "TBEAM", {
    hopsAway: 2,
    position: { latitude: 37.7700, longitude: -122.4300, altitude: 15 },
  }),
  createNode(0x33333333, "BOB", "Bob's Radio", "CLIENT", "TBEAM_S3_CORE", {
    hopsAway: 3,
    position: { latitude: 37.7600, longitude: -122.4400, altitude: 8 },
  }),
  createNode(0x44444444, "MIKE", "Mike Mobile", "TRACKER", "TLORA_V2", {
    hopsAway: 2,
    isMobile: true,
    position: { latitude: 37.7550, longitude: -122.4250, altitude: 3 },
  }),

  // Repeaters
  createNode(0x55555555, "REP1", "Hilltop Repeater", "REPEATER", "STATION_G2", {
    hopsAway: 1,
    batteryLevel: undefined, // Solar powered
    position: { latitude: 37.7950, longitude: -122.4050, altitude: 200 },
  }),
  createNode(0x66666666, "REP2", "Valley Repeater", "REPEATER", "RAK4631", {
    hopsAway: 2,
    position: { latitude: 37.7450, longitude: -122.4450, altitude: 150 },
  }),

  // Sensors
  createNode(0x77777777, "WX01", "Weather Station 1", "SENSOR", "HELTEC_V3", {
    hopsAway: 2,
    position: { latitude: 37.7850, longitude: -122.4350, altitude: 30 },
  }),

  // More clients for testing
  ...Array.from({ length: 15 }, (_, i) =>
    createNode(
      0x88880000 + i,
      `N${String(i + 1).padStart(2, "0")}`,
      `Node ${i + 1}`,
      ["CLIENT", "CLIENT_MUTE", "TRACKER"][i % 3] as NodeRole,
      ["HELTEC_V3", "TBEAM", "RAK4631"][i % 3] as HardwareModel,
      {
        hopsAway: Math.floor(Math.random() * 4) + 1,
        position: i % 3 === 0 ? {
          latitude: 37.7749 + (Math.random() - 0.5) * 0.1,
          longitude: -122.4194 + (Math.random() - 0.5) * 0.1,
          altitude: Math.floor(Math.random() * 100),
        } : undefined,
      }
    )
  ),
];

// Helper to get node by ID
export function getNodeById(id: string): Node | undefined {
  return mockNodes.find(n => n.id === id);
}

// Helper to get node by nodeNum
export function getNodeByNum(num: number): Node | undefined {
  return mockNodes.find(n => n.nodeNum === num);
}
```

### Step 3.2: Create Mock Messages

Create `src/lib/mock/messages.ts`:

```typescript
import { Message, Reaction, REACTION_EMOJIS } from "@/types";
import { mockNodes } from "./nodes";

const nodeIds = mockNodes.map(n => n.id);

function randomNodeId(): string {
  return nodeIds[Math.floor(Math.random() * nodeIds.length)];
}

function generateMessages(): Message[] {
  const messages: Message[] = [];
  const now = Date.now();

  // Channel 0 (Primary) messages
  const channel0Texts = [
    "Good morning everyone! 👋",
    "Network looks healthy today",
    "Anyone seeing the packet storm?",
    "Testing from the hilltop",
    "Can someone relay to BOB?",
    "Signal is great here!",
    "Battery at 45%, heading home soon",
    "Weather station showing 72°F",
    "Just updated to latest firmware",
    "CQ CQ CQ anyone copy?",
  ];

  for (let i = 0; i < 50; i++) {
    const fromNode = randomNodeId();
    const timestamp = now - (50 - i) * 600000; // Every 10 minutes

    messages.push({
      id: `msg-ch0-${i}`,
      fromNode,
      toNode: "broadcast",
      text: channel0Texts[i % channel0Texts.length],
      channel: 0,
      timestamp,
      status: "delivered",
      reactions: i % 5 === 0 ? [
        {
          emoji: REACTION_EMOJIS[i % REACTION_EMOJIS.length],
          fromNodes: [randomNodeId(), randomNodeId()],
        }
      ] : undefined,
      replyTo: i > 5 && i % 7 === 0 ? `msg-ch0-${i - 3}` : undefined,
    });
  }

  // Channel 1 (Secondary) messages
  for (let i = 0; i < 20; i++) {
    messages.push({
      id: `msg-ch1-${i}`,
      fromNode: randomNodeId(),
      toNode: "broadcast",
      text: `Secondary channel message ${i + 1}`,
      channel: 1,
      timestamp: now - (20 - i) * 1800000, // Every 30 minutes
      status: "delivered",
    });
  }

  // Direct messages between specific nodes
  const dmPairs = [
    [nodeIds[0], nodeIds[1]],
    [nodeIds[0], nodeIds[3]],
    [nodeIds[2], nodeIds[4]],
  ];

  dmPairs.forEach(([a, b], pairIdx) => {
    for (let i = 0; i < 10; i++) {
      const isFromA = i % 2 === 0;
      messages.push({
        id: `dm-${pairIdx}-${i}`,
        fromNode: isFromA ? a : b,
        toNode: isFromA ? b : a,
        text: `Direct message ${i + 1} between nodes`,
        channel: 0,
        timestamp: now - (10 - i) * 300000, // Every 5 minutes
        status: "delivered",
      });
    }
  });

  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

export const mockMessages: Message[] = generateMessages();

// Get messages for a specific channel
export function getChannelMessages(channel: number): Message[] {
  return mockMessages.filter(
    m => m.channel === channel && m.toNode === "broadcast"
  );
}

// Get DM messages between two nodes
export function getDirectMessages(nodeA: string, nodeB: string): Message[] {
  return mockMessages.filter(
    m =>
      (m.fromNode === nodeA && m.toNode === nodeB) ||
      (m.fromNode === nodeB && m.toNode === nodeA)
  );
}

// Get all DM conversations for a node
export function getDMConversations(nodeId: string): { nodeId: string; lastMessage: Message }[] {
  const dms = mockMessages.filter(
    m => (m.fromNode === nodeId || m.toNode === nodeId) && m.toNode !== "broadcast"
  );

  const conversations = new Map<string, Message>();

  dms.forEach(m => {
    const otherId = m.fromNode === nodeId ? m.toNode : m.fromNode;
    const existing = conversations.get(otherId);
    if (!existing || m.timestamp > existing.timestamp) {
      conversations.set(otherId, m);
    }
  });

  return Array.from(conversations.entries())
    .map(([nodeId, lastMessage]) => ({ nodeId, lastMessage }))
    .sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
}
```

### Step 3.3: Create Mock Channels

Create `src/lib/mock/channels.ts`:

```typescript
import { Channel, DEFAULT_CHANNEL_NAMES } from "@/types";
import { mockMessages } from "./messages";

function generateChannels(): Channel[] {
  return DEFAULT_CHANNEL_NAMES.map((name, index) => {
    const channelMessages = mockMessages.filter(
      m => m.channel === index && m.toNode === "broadcast"
    );
    const lastMsg = channelMessages[channelMessages.length - 1];

    return {
      index,
      name,
      isEncrypted: index !== 0, // Primary is unencrypted
      uplinkEnabled: index < 4,
      downlinkEnabled: index < 4,
      unreadCount: index < 2 ? Math.floor(Math.random() * 5) : 0,
      lastMessage: lastMsg?.text,
      lastMessageTime: lastMsg?.timestamp,
    };
  });
}

export const mockChannels: Channel[] = generateChannels();

export function getChannel(index: number): Channel | undefined {
  return mockChannels.find(c => c.index === index);
}
```

### Step 3.4: Export All Mocks

Create `src/lib/mock/index.ts`:

```typescript
export * from "./nodes";
export * from "./messages";
export * from "./channels";
```

---

## Section 4: API Layer

### Step 4.1: Create API Client

Create `src/lib/api/client.ts`:

```typescript
// In Phase 1, this uses mock data
// In Phase 2, this will make real HTTP requests

const MOCK_DELAY = 300; // Simulate network latency

export async function delay(ms: number = MOCK_DELAY): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

export class APIError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "APIError";
  }
}

// Base URL for Phase 2
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
```

### Step 4.2: Create Node API

Create `src/lib/api/nodes.ts`:

```typescript
import { Node } from "@/types";
import { mockNodes, getNodeById as getMockNodeById } from "@/lib/mock";
import { delay } from "./client";

export async function getNodes(): Promise<Node[]> {
  await delay();
  return [...mockNodes].sort((a, b) => b.lastHeard - a.lastHeard);
}

export async function getNode(id: string): Promise<Node | null> {
  await delay();
  return getMockNodeById(id) || null;
}

export async function getActiveNodes(hours: number = 24): Promise<Node[]> {
  await delay();
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return mockNodes
    .filter(n => n.lastHeard >= cutoff)
    .sort((a, b) => b.lastHeard - a.lastHeard);
}

export async function getFavoriteNodes(): Promise<Node[]> {
  await delay();
  return mockNodes.filter(n => n.isFavorite);
}

export async function setNodeFavorite(id: string, isFavorite: boolean): Promise<Node> {
  await delay();
  const node = getMockNodeById(id);
  if (!node) throw new Error("Node not found");
  node.isFavorite = isFavorite;
  return node;
}
```

### Step 4.3: Create Message API

Create `src/lib/api/messages.ts`:

```typescript
import { Message } from "@/types";
import { mockMessages, getChannelMessages as getMockChannelMessages, getDirectMessages as getMockDirectMessages, getDMConversations as getMockDMConversations } from "@/lib/mock";
import { delay } from "./client";

export async function getMessages(limit: number = 100): Promise<Message[]> {
  await delay();
  return mockMessages.slice(-limit);
}

export async function getChannelMessages(channel: number, limit: number = 100): Promise<Message[]> {
  await delay();
  return getMockChannelMessages(channel).slice(-limit);
}

export async function getDirectMessages(nodeA: string, nodeB: string, limit: number = 100): Promise<Message[]> {
  await delay();
  return getMockDirectMessages(nodeA, nodeB).slice(-limit);
}

export async function getDMConversations(nodeId: string): Promise<{ nodeId: string; lastMessage: Message }[]> {
  await delay();
  return getMockDMConversations(nodeId);
}

export async function sendMessage(params: {
  text: string;
  channel: number;
  toNode?: string;
  replyTo?: string;
}): Promise<Message> {
  await delay(500); // Longer delay for sending

  const message: Message = {
    id: `msg-${Date.now()}`,
    fromNode: "!abcd1234", // Local node
    toNode: params.toNode || "broadcast",
    text: params.text,
    channel: params.channel,
    timestamp: Date.now(),
    status: "pending",
    replyTo: params.replyTo,
  };

  // Simulate delivery
  setTimeout(() => {
    message.status = "delivered";
  }, 1000);

  return message;
}

export async function addReaction(messageId: string, emoji: string): Promise<void> {
  await delay();
  // In mock mode, we just pretend this works
  console.log(`Added reaction ${emoji} to message ${messageId}`);
}
```

### Step 4.4: Create Channel API

Create `src/lib/api/channels.ts`:

```typescript
import { Channel } from "@/types";
import { mockChannels } from "@/lib/mock";
import { delay } from "./client";

export async function getChannels(): Promise<Channel[]> {
  await delay();
  return [...mockChannels];
}

export async function getChannel(index: number): Promise<Channel | null> {
  await delay();
  return mockChannels.find(c => c.index === index) || null;
}

export async function markChannelRead(index: number): Promise<void> {
  await delay();
  const channel = mockChannels.find(c => c.index === index);
  if (channel) {
    channel.unreadCount = 0;
  }
}
```

### Step 4.5: Export API

Create `src/lib/api/index.ts`:

```typescript
export * from "./client";
export * from "./nodes";
export * from "./messages";
export * from "./channels";
```

---

## Section 5: React Query Setup

### Step 5.1: Create Query Provider

Create `src/components/providers/QueryProvider.tsx`:

```typescript
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds
            gcTime: 5 * 60 * 1000, // 5 minutes
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### Step 5.2: Create Custom Hooks

Create `src/hooks/useNodes.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getNodes, getNode, getActiveNodes, setNodeFavorite } from "@/lib/api";

export function useNodes() {
  return useQuery({
    queryKey: ["nodes"],
    queryFn: getNodes,
    refetchInterval: 30000, // Poll every 30s
  });
}

export function useNode(id: string | null) {
  return useQuery({
    queryKey: ["nodes", id],
    queryFn: () => (id ? getNode(id) : null),
    enabled: !!id,
  });
}

export function useActiveNodes(hours: number = 24) {
  return useQuery({
    queryKey: ["nodes", "active", hours],
    queryFn: () => getActiveNodes(hours),
    refetchInterval: 30000,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      setNodeFavorite(id, isFavorite),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nodes"] });
    },
  });
}
```

Create `src/hooks/useMessages.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getChannelMessages, getDirectMessages, sendMessage, addReaction } from "@/lib/api";

export function useChannelMessages(channel: number) {
  return useQuery({
    queryKey: ["messages", "channel", channel],
    queryFn: () => getChannelMessages(channel),
    refetchInterval: 5000, // Poll every 5s for messages
  });
}

export function useDirectMessages(nodeA: string | null, nodeB: string | null) {
  return useQuery({
    queryKey: ["messages", "dm", nodeA, nodeB],
    queryFn: () => (nodeA && nodeB ? getDirectMessages(nodeA, nodeB) : []),
    enabled: !!(nodeA && nodeB),
    refetchInterval: 5000,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendMessage,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["messages", "channel", variables.channel]
      });
    },
  });
}

export function useAddReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      addReaction(messageId, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}
```

Create `src/hooks/useChannels.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getChannels, getChannel, markChannelRead } from "@/lib/api";

export function useChannels() {
  return useQuery({
    queryKey: ["channels"],
    queryFn: getChannels,
    refetchInterval: 30000,
  });
}

export function useChannel(index: number | null) {
  return useQuery({
    queryKey: ["channels", index],
    queryFn: () => (index !== null ? getChannel(index) : null),
    enabled: index !== null,
  });
}

export function useMarkChannelRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markChannelRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
  });
}
```

---

## Section 6: Base UI Components

Follow the shadcn/ui installation for base components, or create minimal versions:

### Step 6.1: Button Component

Create `src/components/ui/button.tsx`:

```typescript
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

### Step 6.2: Card Component

Create `src/components/ui/card.tsx`:

```typescript
import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border border-border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
```

Continue adding more UI components (Input, Dialog, Tabs, etc.) as needed following the same pattern.

---

## Section 7: Layout Components

### Step 7.1: Root Layout

Update `src/app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NAMM - Not Another Meshtastic Monitor",
  description: "Modern Meshtastic mesh network monitoring application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-base text-text antialiased`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
```

### Step 7.2: Dashboard Layout

Create `src/app/(dashboard)/layout.tsx`:

```typescript
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      {/* Desktop sidebar - hidden on mobile */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main content area */}
      <main className="flex-1 overflow-auto pb-16 lg:pb-0">
        {children}
      </main>

      {/* Mobile bottom navigation - hidden on desktop */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0">
        <MobileNav />
      </div>
    </div>
  );
}
```

---

## Next Steps

After completing these sections, proceed to build:

1. **Sidebar Component** - Navigation for desktop
2. **MobileNav Component** - Bottom tabs for mobile
3. **Dashboard Page** - Overview with stats
4. **Network Graph Page** - Force-directed visualization
5. **Network Map Page** - Leaflet map with nodes
6. **Channels Page** - Message lists
7. **Nodes Page** - Node table and details

Each page should follow the patterns established in this guide, using the mock data layer and React Query hooks.

---

*This is a living document. Update as the project evolves.*
