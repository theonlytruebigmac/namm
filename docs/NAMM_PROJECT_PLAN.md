# NAMM - Not Another Meshtastic Monitor

## Project Vision

NAMM is a next-generation, open-source Meshtastic mesh network monitoring application that combines the best features of **MeshMonitor** (user-friendly monitoring and messaging) and **Stridetastic** (advanced network analysis and security research). The goal is to create a modern, responsive, and reactive web application with a focus on excellent mobile and desktop browser experiences.

---

## Executive Summary

### What We're Building
A unified Meshtastic monitoring platform that provides:
1. **Beautiful, responsive UI** - Mobile-first design with desktop excellence
2. **Real-time mesh monitoring** - Node discovery, telemetry, and network topology
3. **Advanced messaging** - iMessage-style chat with reactions, threading, and DMs
4. **Network visualization** - Interactive maps and force-directed graphs
5. **Security research tools** - Packet capture, encryption analysis, and network probing
6. **Modular architecture** - Clean separation between frontend and backend

### Development Strategy
**Phase 1: Frontend First** - Build a complete, fully-featured demo UI with mock data and placeholder APIs
**Phase 2: Backend Development** - Implement the API and data layer once the UI is finalized

---

## Source Project Analysis

### MeshMonitor Strengths (Keep These)
| Feature | Description | Priority |
|---------|-------------|----------|
| **iMessage-style messaging** | Threaded replies, emoji reactions (👍👎❓❗😂😢💩) | ⭐⭐⭐ |
| **Catppuccin Mocha theme** | Beautiful dark mode with consistent styling | ⭐⭐⭐ |
| **Interactive map with routes** | Leaflet maps, traceroute visualization, weighted polylines | ⭐⭐⭐ |
| **Dashboard widgets** | Customizable telemetry charts, drag-and-drop | ⭐⭐ |
| **Push notifications** | Web Push + Apprise for 100+ notification services | ⭐⭐ |
| **Authentication (OIDC/local)** | RBAC with permissions, SSO support | ⭐⭐⭐ |
| **Auto-upgrade & backup** | One-click updates with rollback capability | ⭐⭐ |
| **Packet monitor** | Real-time packet viewing with filtering | ⭐⭐ |
| **Channel management** | MQTT uplink/downlink, encryption status | ⭐⭐ |
| **Mobile detection** | Automatic node mobility classification | ⭐ |
| **i18n support** | Multi-language with Weblate integration | ⭐⭐ |

### Stridetastic Strengths (Keep These)
| Feature | Description | Priority |
|---------|-------------|----------|
| **Force-directed network graph** | react-force-graph-2d visualization | ⭐⭐⭐ |
| **Path analysis** | Dijkstra pathfinding, network topology | ⭐⭐⭐ |
| **PCAP capture** | Wireshark-compatible packet capture | ⭐⭐ |
| **PKI encryption** | X25519 ECDH + AES-CCM encryption support | ⭐⭐ |
| **Virtual nodes** | Create and manage virtual publishing identities | ⭐⭐ |
| **Multi-interface support** | MQTT + Serial interfaces simultaneously | ⭐⭐⭐ |
| **TimescaleDB time-series** | Efficient historical data with auto-compression | ⭐⭐ |
| **Grafana dashboards** | Pre-built metrics dashboards | ⭐ |
| **Publishing actions** | Text, NodeInfo, Position, Traceroute injection | ⭐⭐ |
| **Reactive publishing** | Auto-respond to observed packets | ⭐ |
| **Link analysis** | Bidirectional communication tracking | ⭐⭐ |
| **Modern Next.js/React 19** | Latest framework with App Router | ⭐⭐⭐ |

### What to Leave Behind
| Feature | Reason |
|---------|--------|
| MeshMonitor's monolithic 5000+ line App.tsx | Refactor into modular components |
| MeshMonitor's custom CSS styling | Replace with Tailwind CSS |
| Stridetastic's Django backend | Unify on a single backend technology |
| MeshMonitor's polling-based updates | Replace with WebSocket real-time updates |

---

## Technology Stack (Recommended)

### Frontend (Modern & Reactive)
```
Framework:       Next.js 15 (App Router, React Server Components)
React Version:   React 19 (latest concurrent features)
Language:        TypeScript 5.x (strict mode)
Styling:         Tailwind CSS 4 + shadcn/ui components
State:           TanStack Query (server state) + Zustand (client state)
Forms:           React Hook Form + Zod validation
Charts:          Recharts or Tremor
Maps:            React-Leaflet + MapLibre GL
Network Graph:   react-force-graph-2d
Icons:           Lucide React
Animations:      Framer Motion
```

### Backend (Unified Node.js - Phase 2)
```
Runtime:         Node.js 22 LTS
Framework:       Hono or Express.js 5
Language:        TypeScript
Database:        PostgreSQL + TimescaleDB extension
ORM:             Drizzle ORM (type-safe, fast)
Real-time:       Socket.IO or native WebSocket
Auth:            Better-Auth or Auth.js
Queue:           BullMQ (Redis-backed)
Validation:      Zod
API Docs:        OpenAPI/Swagger
```

### Infrastructure
```
Containers:      Docker + Docker Compose
Database:        PostgreSQL 17 + TimescaleDB
Cache/Queue:     Redis
Reverse Proxy:   Caddy or Nginx
Monitoring:      Grafana (optional)
```

---

## UI Architecture

### Page Structure
```
/                       → Dashboard (Overview + widgets)
/network                → Network topology (graph + map tabs)
/channels               → Channel list and messages
/channels/[id]          → Individual channel conversation
/messages               → Direct messages
/messages/[nodeId]      → Individual DM conversation
/nodes                  → Node list with filters
/nodes/[id]             → Node details (telemetry, history)
/traceroutes            → Traceroute history and analysis
/captures               → PCAP captures (security research)
/settings               → App settings and configuration
/admin                  → Admin panel (users, permissions)
/login                  → Authentication
```

### Component Architecture
```
src/
├── app/                      # Next.js App Router pages
│   ├── (auth)/               # Auth group (login, register)
│   ├── (dashboard)/          # Main app group with sidebar
│   │   ├── layout.tsx        # Dashboard layout with sidebar
│   │   ├── page.tsx          # Overview dashboard
│   │   ├── network/          # Network visualization
│   │   ├── channels/         # Channel messaging
│   │   ├── messages/         # Direct messages
│   │   ├── nodes/            # Node management
│   │   ├── traceroutes/      # Traceroute analysis
│   │   ├── captures/         # PCAP captures
│   │   └── settings/         # Settings
│   └── api/                  # API routes (Phase 2)
│
├── components/
│   ├── ui/                   # Base UI components (shadcn/ui)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── input.tsx
│   │   ├── sheet.tsx         # Mobile drawers
│   │   ├── tabs.tsx
│   │   └── ...
│   │
│   ├── layout/               # Layout components
│   │   ├── Sidebar.tsx       # Main navigation
│   │   ├── Header.tsx        # Top bar with actions
│   │   ├── MobileNav.tsx     # Bottom nav for mobile
│   │   └── ThemeProvider.tsx
│   │
│   ├── dashboard/            # Dashboard widgets
│   │   ├── OverviewStats.tsx
│   │   ├── TelemetryWidget.tsx
│   │   ├── NodeStatusWidget.tsx
│   │   ├── PacketRateChart.tsx
│   │   ├── ActivityFeed.tsx
│   │   └── WidgetGrid.tsx
│   │
│   ├── network/              # Network visualization
│   │   ├── NetworkGraph.tsx  # Force-directed graph
│   │   ├── NetworkMap.tsx    # Leaflet/MapLibre map
│   │   ├── GraphControls.tsx
│   │   ├── PathAnalysis.tsx
│   │   └── NodeMarker.tsx
│   │
│   ├── messaging/            # Chat components
│   │   ├── MessageList.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── MessageInput.tsx
│   │   ├── ReactionPicker.tsx
│   │   ├── ChannelList.tsx
│   │   ├── DMList.tsx
│   │   └── ThreadView.tsx
│   │
│   ├── nodes/                # Node components
│   │   ├── NodeList.tsx
│   │   ├── NodeCard.tsx
│   │   ├── NodeDetails.tsx
│   │   ├── TelemetryCharts.tsx
│   │   ├── PositionHistory.tsx
│   │   └── NodeFilters.tsx
│   │
│   ├── traceroutes/          # Traceroute components
│   │   ├── TracerouteList.tsx
│   │   ├── TracerouteDetail.tsx
│   │   ├── RouteVisualization.tsx
│   │   └── TracerouteForm.tsx
│   │
│   ├── captures/             # PCAP capture (advanced)
│   │   ├── CaptureList.tsx
│   │   ├── CaptureControls.tsx
│   │   └── PacketInspector.tsx
│   │
│   └── shared/               # Shared components
│       ├── Loading.tsx
│       ├── ErrorBoundary.tsx
│       ├── RefreshButton.tsx
│       ├── TimeRangeSelector.tsx
│       └── ConfirmDialog.tsx
│
├── hooks/                    # Custom React hooks
│   ├── useNodes.ts
│   ├── useChannels.ts
│   ├── useMessages.ts
│   ├── useNetworkData.ts
│   ├── useTraceroutes.ts
│   ├── useTelemetry.ts
│   ├── useWebSocket.ts
│   ├── useAutoRefresh.ts
│   └── usePathFinding.ts
│
├── lib/                      # Utility libraries
│   ├── api/                  # API client
│   │   ├── client.ts
│   │   ├── nodes.ts
│   │   ├── messages.ts
│   │   └── types.ts
│   ├── mock/                 # Mock data (Phase 1)
│   │   ├── nodes.ts
│   │   ├── messages.ts
│   │   ├── channels.ts
│   │   └── telemetry.ts
│   ├── utils/
│   │   ├── formatting.ts
│   │   ├── time.ts
│   │   └── geo.ts
│   └── constants.ts
│
├── stores/                   # Zustand stores
│   ├── uiStore.ts
│   ├── nodeStore.ts
│   └── filterStore.ts
│
├── types/                    # TypeScript types
│   ├── node.ts
│   ├── message.ts
│   ├── channel.ts
│   ├── telemetry.ts
│   └── api.ts
│
└── styles/                   # Global styles
    ├── globals.css
    └── themes/
        ├── catppuccin.css
        └── light.css
```

---

## Responsive Design Strategy

### Breakpoints
```css
/* Tailwind defaults */
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Small laptops */
xl: 1280px  /* Desktops */
2xl: 1536px /* Large screens */
```

### Mobile-First Approach
1. **Bottom navigation bar** on mobile (like native apps)
2. **Sheet/drawer components** for modals on mobile
3. **Collapsible sidebar** that becomes hidden on mobile
4. **Touch-friendly** buttons and tap targets (min 44px)
5. **Swipe gestures** for common actions
6. **Pull-to-refresh** for data updates

### Layout Patterns
| Screen Size | Layout |
|-------------|--------|
| Mobile (<768px) | Single column, bottom nav, full-width cards |
| Tablet (768-1024px) | Two-column with collapsible sidebar |
| Desktop (>1024px) | Fixed sidebar, multi-column content area |

---

## Phase 1: Frontend Development (Demo Mode)

### Step 1: Project Setup (Week 1)
```bash
# Initialize Next.js 15 project
npx create-next-app@latest namm --typescript --tailwind --eslint --app --src-dir

# Install dependencies
cd namm
npm install @tanstack/react-query zustand recharts react-leaflet leaflet
npm install react-force-graph-2d lucide-react framer-motion
npm install @radix-ui/react-* (via shadcn/ui)
npm install zod react-hook-form @hookform/resolvers

# Install dev dependencies
npm install -D @types/leaflet prettier eslint-config-prettier
```

### Step 2: Design System (Week 1-2)
1. Set up shadcn/ui with Catppuccin theme colors
2. Create base components (Button, Card, Input, Dialog, etc.)
3. Build layout components (Sidebar, Header, MobileNav)
4. Implement dark/light theme toggle
5. Create responsive utility classes

### Step 3: Mock Data Layer (Week 2)
1. Define TypeScript interfaces for all data types
2. Create realistic mock data generators
3. Build mock API functions with simulated delays
4. Implement mock WebSocket events for real-time updates

### Step 4: Core Pages (Weeks 2-4)
1. **Dashboard/Overview**
   - Connection status card
   - Node count and activity stats
   - Recent messages feed
   - Telemetry sparklines

2. **Network Graph**
   - Force-directed graph with filters
   - Node click for details panel
   - Path analysis between nodes
   - Link visualization options

3. **Network Map**
   - Leaflet map with node markers
   - Route polylines (traceroutes)
   - Cluster markers for dense areas
   - Node popup with quick actions

4. **Channels**
   - Channel list with unread counts
   - Message thread view
   - iMessage-style bubbles
   - Emoji reactions
   - Reply threading

5. **Direct Messages**
   - Node list with DM capability
   - Conversation threads
   - Message status indicators

6. **Nodes**
   - Filterable/sortable node table
   - Node detail page
   - Telemetry history charts
   - Position history map

### Step 5: Advanced Features (Weeks 4-5)
1. **Traceroutes**
   - Traceroute history list
   - Route visualization on map
   - Hop-by-hop analysis

2. **PCAP Captures** (placeholder)
   - Capture list UI
   - Start/stop controls
   - Download buttons

3. **Settings**
   - Connection configuration
   - UI preferences
   - Notification settings

### Step 6: Polish (Week 5-6)
1. Loading states and skeletons
2. Error handling and boundaries
3. Empty states with helpful messages
4. Animations and transitions
5. Accessibility (keyboard nav, screen readers)
6. Performance optimization

---

## Phase 2: Backend Development (Post-Frontend)

### API Design Principles
1. **RESTful endpoints** for CRUD operations
2. **WebSocket** for real-time updates
3. **OpenAPI specification** for documentation
4. **Type-safe** end-to-end with TypeScript + Zod
5. **Pagination** for large datasets
6. **Rate limiting** for security

### Backend Architecture
```
src/server/
├── api/
│   ├── routes/
│   │   ├── nodes.ts
│   │   ├── messages.ts
│   │   ├── channels.ts
│   │   ├── traceroutes.ts
│   │   ├── captures.ts
│   │   └── auth.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── rateLimit.ts
│   │   └── validation.ts
│   └── handlers/
│
├── services/
│   ├── meshtastic/
│   │   ├── manager.ts         # Connection management
│   │   ├── protobuf.ts        # Protobuf parsing
│   │   └── interfaces/        # MQTT, Serial, HTTP
│   ├── database/
│   │   ├── schema.ts          # Drizzle schema
│   │   └── queries.ts
│   ├── websocket/
│   │   └── handler.ts
│   └── notifications/
│       └── push.ts
│
├── lib/
│   ├── crypto/                # Encryption utilities
│   ├── pcap/                  # PCAP writer
│   └── utils/
│
└── types/
    └── meshtastic.ts          # Protobuf types
```

---

## Mock Data Examples

### Node Mock Data
```typescript
// lib/mock/nodes.ts
export const mockNodes: Node[] = [
  {
    id: '!abcd1234',
    nodeNum: 0xabcd1234,
    shortName: 'BASE',
    longName: 'Base Station Alpha',
    hwModel: 'HELTEC_V3',
    role: 'ROUTER',
    batteryLevel: 85,
    voltage: 4.1,
    snr: 12.5,
    rssi: -67,
    lastHeard: Date.now() - 30000,
    position: { latitude: 37.7749, longitude: -122.4194, altitude: 10 },
    isMobile: false,
    hopsAway: 0,
  },
  // ... more nodes
];
```

### Message Mock Data
```typescript
// lib/mock/messages.ts
export const mockMessages: Message[] = [
  {
    id: 'msg-001',
    fromNode: '!abcd1234',
    toNode: 'broadcast',
    text: 'Good morning everyone! Network looks healthy today.',
    channel: 0,
    timestamp: Date.now() - 3600000,
    reactions: [
      { emoji: '👍', fromNodes: ['!def56789', '!ghi90123'] },
    ],
    replyTo: null,
  },
  // ... more messages
];
```

---

## Development Workflow

### Git Branching
```
main            → Production releases only
develop         → Integration branch
feature/*       → New features
bugfix/*        → Bug fixes
release/*       → Release preparation
```

### Commit Convention
```
feat: Add network graph filtering
fix: Resolve message scroll issue
docs: Update API documentation
style: Format code with prettier
refactor: Extract message hooks
test: Add node filtering tests
chore: Update dependencies
```

### CI/CD Pipeline
1. **Lint & Type Check** on every push
2. **Unit Tests** on every push
3. **Build Check** on every PR
4. **Deploy Preview** on PR (Vercel/Netlify)
5. **Production Deploy** on main merge

---

## Getting Started Commands

```bash
# Clone and setup
git clone https://github.com/yourusername/namm.git
cd namm

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Lint code
npm run lint

# Type check
npm run typecheck

# Run tests
npm run test
```

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **Phase 1A: Setup** | Week 1 | Project scaffolding, design system |
| **Phase 1B: Core UI** | Weeks 2-4 | Dashboard, Network, Messaging, Nodes |
| **Phase 1C: Advanced** | Week 4-5 | Traceroutes, Captures, Settings |
| **Phase 1D: Polish** | Week 5-6 | Animations, accessibility, testing |
| **Phase 2A: API** | Week 7-9 | Backend implementation |
| **Phase 2B: Integration** | Week 10-12 | Frontend-backend integration |

---

## Key Success Metrics

1. **Performance**: <100ms time-to-interactive on 4G mobile
2. **Accessibility**: WCAG 2.1 AA compliant
3. **Responsiveness**: Seamless experience across all screen sizes
4. **Real-time**: Sub-second updates for network changes
5. **Maintainability**: 90%+ TypeScript strict mode coverage

---

## Resources

### Design Inspiration
- [Catppuccin Mocha Colors](https://catppuccin.com/palette)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [iMessage Design Patterns](https://developer.apple.com/design/human-interface-guidelines/messages)

### Technical References
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Meshtastic Protobufs](https://github.com/meshtastic/protobufs)
- [TanStack Query](https://tanstack.com/query)
- [react-force-graph](https://github.com/vasturiano/react-force-graph)

---

## Notes

- The frontend will be fully functional with mock data before any backend work begins
- All components should be tested with Storybook or similar tools
- Mobile experience is a first-class citizen, not an afterthought
- The design should feel native on both iOS and Android web browsers
- Security research features (PCAP, injection) will be gated behind permissions

---

*Document Version: 1.0*
*Created: January 2026*
*Project: NAMM - Not Another Meshtastic Monitor*
