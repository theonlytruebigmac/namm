# Feature Comparison: MeshMonitor vs Stridetastic

## Overview

This document provides a detailed comparison of features between the two source projects to inform NAMM's development priorities.

---

## Frontend Technology Comparison

| Aspect | MeshMonitor | Stridetastic | NAMM Recommendation |
|--------|-------------|--------------|---------------------|
| **Framework** | React 18 + Vite | Next.js 15 + React 19 | **Next.js 15** - SSR, App Router, better DX |
| **Styling** | Custom CSS + Catppuccin | Tailwind CSS 4 | **Tailwind + Catppuccin** - Best of both |
| **State (Server)** | TanStack Query | TanStack Query | **TanStack Query** - Both use it |
| **State (Client)** | useState/useContext | Zustand | **Zustand** - Simpler, more scalable |
| **Routing** | React Router | Next.js App Router | **App Router** - File-based, modern |
| **Components** | Custom components | Custom components | **shadcn/ui** - Accessible, customizable |
| **Maps** | React-Leaflet | React-Leaflet | **React-Leaflet** - Both proven |
| **Network Graph** | Custom canvas | react-force-graph-2d | **react-force-graph-2d** - Feature-rich |
| **Charts** | Recharts | Recharts | **Recharts** - Both use it |
| **Icons** | Custom SVGs | Lucide React | **Lucide React** - Consistent, large set |
| **Forms** | Custom handling | Custom handling | **React Hook Form + Zod** - Type-safe |
| **i18n** | react-i18next | None | **react-i18next** - Required for global use |

---

## Backend Technology Comparison

| Aspect | MeshMonitor | Stridetastic | NAMM Recommendation |
|--------|-------------|--------------|---------------------|
| **Runtime** | Node.js 20+ | Python 3.12 | **Node.js 22** - Unified stack |
| **Framework** | Express.js 5 | Django 5.1 + Ninja | **Hono or Express** - Faster, lighter |
| **Database** | SQLite (better-sqlite3) | PostgreSQL + TimescaleDB | **PostgreSQL + TimescaleDB** - Scalable |
| **ORM** | Raw SQL | Django ORM | **Drizzle ORM** - Type-safe, fast |
| **Real-time** | Socket.IO | WebSockets | **Socket.IO** - Easier fallbacks |
| **Auth** | Express Session + OIDC | Django-Ninja-JWT | **Better-Auth** - Modern, flexible |
| **Queue** | None | Celery + Redis | **BullMQ** - Node.js native, Redis-backed |
| **API Docs** | OpenAPI/Swagger | Django-Ninja auto-docs | **OpenAPI/Swagger** - Standard |
| **Validation** | Manual | Pydantic | **Zod** - TypeScript native |

---

## UI/UX Feature Comparison

### Dashboard/Overview

| Feature | MeshMonitor | Stridetastic | Priority |
|---------|-------------|--------------|----------|
| Connection status indicator | ✅ | ✅ | ⭐⭐⭐ |
| Node count statistics | ✅ | ✅ | ⭐⭐⭐ |
| Activity feed | ✅ | ✅ | ⭐⭐ |
| Telemetry widgets | ✅ Advanced | ✅ Basic | ⭐⭐⭐ |
| Custom widget placement | ✅ Drag-n-drop | ❌ | ⭐⭐ |
| Solar estimate overlay | ✅ | ❌ | ⭐ |
| Packet rate charts | ✅ | ✅ | ⭐⭐ |
| Quick actions | ✅ | ✅ | ⭐⭐ |

### Network Visualization

| Feature | MeshMonitor | Stridetastic | Priority |
|---------|-------------|--------------|----------|
| Interactive map | ✅ Leaflet | ✅ Leaflet | ⭐⭐⭐ |
| Force-directed graph | ❌ | ✅ react-force-graph | ⭐⭐⭐ |
| Route visualization | ✅ Polylines | ✅ Polylines | ⭐⭐⭐ |
| Node clustering | ✅ Spiderfy | ❌ | ⭐⭐ |
| Path analysis | ❌ | ✅ Dijkstra | ⭐⭐⭐ |
| Link metrics display | ✅ Basic | ✅ Advanced | ⭐⭐ |
| Position history | ✅ | ✅ | ⭐⭐ |
| Activity time filtering | ✅ | ✅ | ⭐⭐ |
| Tile layer selection | ✅ Multiple | ✅ Satellite/Map | ⭐⭐ |
| Custom tile servers | ✅ | ❌ | ⭐ |

### Messaging

| Feature | MeshMonitor | Stridetastic | Priority |
|---------|-------------|--------------|----------|
| Channel messages | ✅ | ❌ | ⭐⭐⭐ |
| Direct messages | ✅ | ❌ | ⭐⭐⭐ |
| Message bubbles (iMessage-style) | ✅ Beautiful | ❌ | ⭐⭐⭐ |
| Emoji reactions | ✅ 7 emojis | ❌ | ⭐⭐⭐ |
| Reply threading | ✅ | ❌ | ⭐⭐⭐ |
| Delivery status | ✅ | ❌ | ⭐⭐ |
| Unread counts | ✅ | ❌ | ⭐⭐ |
| Message search | ❌ | ❌ | ⭐ |
| Link previews | ✅ | ❌ | ⭐ |
| MQTT message filtering | ✅ | ❌ | ⭐⭐ |

### Node Management

| Feature | MeshMonitor | Stridetastic | Priority |
|---------|-------------|--------------|----------|
| Node list with filters | ✅ | ✅ | ⭐⭐⭐ |
| Node detail view | ✅ | ✅ | ⭐⭐⭐ |
| Telemetry history | ✅ Charts | ✅ Charts | ⭐⭐⭐ |
| Position history | ✅ | ✅ | ⭐⭐ |
| Favorites | ✅ | ❌ | ⭐⭐ |
| Mobile detection | ✅ | ❌ | ⭐ |
| Role/hardware labels | ✅ 116 models | ✅ | ⭐⭐ |
| Virtual nodes | ❌ | ✅ | ⭐⭐ |
| Node renaming | ✅ | ❌ | ⭐ |

### Traceroutes

| Feature | MeshMonitor | Stridetastic | Priority |
|---------|-------------|--------------|----------|
| Traceroute history | ✅ | ✅ | ⭐⭐⭐ |
| Route visualization | ✅ Map lines | ✅ Map lines | ⭐⭐⭐ |
| Hop-by-hop SNR | ✅ | ✅ | ⭐⭐ |
| Auto-scheduler | ✅ Every 3 min | ❌ | ⭐⭐ |
| Manual traceroute | ✅ | ✅ | ⭐⭐ |
| Route comparison | ❌ | ❌ | ⭐ |

### Security/Research Features

| Feature | MeshMonitor | Stridetastic | Priority |
|---------|-------------|--------------|----------|
| PCAP capture | ❌ | ✅ Wireshark-ready | ⭐⭐ |
| Packet inspection | ✅ Monitor panel | ✅ | ⭐⭐ |
| Encryption key health | ✅ | ❌ | ⭐ |
| PKI encryption | ❌ | ✅ X25519 | ⭐⭐ |
| Virtual node publishing | ❌ | ✅ | ⭐ |
| Reactive publishing | ❌ | ✅ | ⭐ |
| Reachability probing | ❌ | ✅ | ⭐ |

### Configuration

| Feature | MeshMonitor | Stridetastic | Priority |
|---------|-------------|--------------|----------|
| Node configuration UI | ✅ Full | ❌ | ⭐⭐ |
| Channel configuration | ✅ | ✅ Minimal | ⭐⭐ |
| Interface management | ✅ HTTP only | ✅ MQTT + Serial | ⭐⭐⭐ |
| Settings persistence | ✅ SQLite | ✅ PostgreSQL | ⭐⭐⭐ |
| Backup/restore | ✅ | ❌ | ⭐⭐ |
| Auto-upgrade | ✅ | ❌ | ⭐ |

### Authentication & Authorization

| Feature | MeshMonitor | Stridetastic | Priority |
|---------|-------------|--------------|----------|
| Local auth | ✅ | ✅ JWT | ⭐⭐⭐ |
| OIDC/SSO | ✅ | ❌ | ⭐⭐ |
| RBAC permissions | ✅ Granular | ✅ Basic | ⭐⭐⭐ |
| User management | ✅ | ✅ Django admin | ⭐⭐ |
| API tokens | ✅ | ❌ | ⭐⭐ |

### Notifications

| Feature | MeshMonitor | Stridetastic | Priority |
|---------|-------------|--------------|----------|
| Web Push | ✅ | ❌ | ⭐⭐ |
| Apprise integration | ✅ 100+ services | ❌ | ⭐ |
| In-app notifications | ✅ | ❌ | ⭐⭐ |
| Sound alerts | ✅ | ❌ | ⭐ |

---

## Data Model Comparison

### Nodes

| Field | MeshMonitor | Stridetastic | Include? |
|-------|-------------|--------------|----------|
| nodeNum | ✅ INTEGER | ✅ BigInteger | ✅ |
| nodeId | ✅ TEXT | ✅ CharField | ✅ |
| shortName | ✅ | ✅ | ✅ |
| longName | ✅ | ✅ | ✅ |
| hwModel | ✅ INTEGER | ✅ Choice | ✅ |
| role | ✅ INTEGER | ✅ Choice | ✅ |
| position | ✅ lat/lon/alt | ✅ lat/lon/alt | ✅ |
| batteryLevel | ✅ | ✅ | ✅ |
| voltage | ✅ | ✅ | ✅ |
| snr/rssi | ✅ | ✅ | ✅ |
| hopsAway | ✅ | ❌ | ✅ |
| lastHeard | ✅ | ✅ last_seen | ✅ |
| isFavorite | ✅ | ❌ | ✅ |
| isMobile | ✅ | ❌ | ✅ |
| isVirtual | ❌ | ✅ | ✅ |
| publicKey | ❌ | ✅ | ✅ |
| privateKey | ❌ | ✅ (encrypted) | ✅ |
| macAddress | ❌ | ✅ | ✅ |
| channelUtilization | ✅ | ✅ | ✅ |
| airUtilTx | ✅ | ✅ | ✅ |
| uptime | ✅ | ✅ | ✅ |
| temperature | ✅ | ✅ | ✅ |
| humidity | ✅ | ✅ | ✅ |
| pressure | ✅ | ✅ | ✅ |

### Messages

| Field | MeshMonitor | Stridetastic | Include? |
|-------|-------------|--------------|----------|
| id | ✅ TEXT | ❌ | ✅ |
| fromNode | ✅ FK | ❌ | ✅ |
| toNode | ✅ FK | ❌ | ✅ |
| text | ✅ | ❌ | ✅ |
| channel | ✅ | ❌ | ✅ |
| timestamp | ✅ | ❌ | ✅ |
| replyId | ✅ | ❌ | ✅ |
| emoji | ✅ | ❌ | ✅ |
| hopStart | ✅ | ❌ | ✅ |
| hopLimit | ✅ | ❌ | ✅ |

### Packets (Stridetastic-specific)

| Field | Description | Include? |
|-------|-------------|----------|
| time | Ingestion timestamp | ✅ |
| from_node | Source node FK | ✅ |
| to_node | Destination node FK | ✅ |
| packet_id | Meshtastic packet ID | ✅ |
| rx_rssi | Received signal | ✅ |
| rx_snr | Signal-to-noise | ✅ |
| hop_limit/start | Hop tracking | ✅ |
| via_mqtt | MQTT sourced | ✅ |
| pki_encrypted | PKI flag | ✅ |
| portnum | Port number | ✅ |
| payload | Raw payload | ✅ |

### Channels

| Field | MeshMonitor | Stridetastic | Include? |
|-------|-------------|--------------|----------|
| index/id | ✅ | ✅ | ✅ |
| name | ✅ | ✅ | ✅ |
| psk | ✅ | ✅ | ✅ |
| uplinkEnabled | ✅ | ❌ | ✅ |
| downlinkEnabled | ✅ | ❌ | ✅ |
| members | ❌ | ✅ M2M | ✅ |

### Links (Stridetastic-specific)

| Field | Description | Include? |
|-------|-------------|----------|
| node_a / node_b | Ordered node pair | ✅ |
| packet_counts | Directional counts | ✅ |
| is_bidirectional | Both ways seen | ✅ |
| last_activity | Recent timestamp | ✅ |
| channels | M2M channels | ✅ |

---

## API Endpoint Comparison

### Nodes

| Endpoint | MeshMonitor | Stridetastic | Include? |
|----------|-------------|--------------|----------|
| GET /nodes | ✅ | ✅ | ✅ |
| GET /nodes/:id | ✅ | ✅ | ✅ |
| GET /nodes/active | ✅ ?days=7 | ✅ Time filters | ✅ |
| GET /nodes/:id/positions | ✅ | ✅ | ✅ |
| GET /nodes/:id/telemetry | ✅ | ✅ | ✅ |
| PUT /nodes/:id/favorite | ✅ | ❌ | ✅ |
| POST /nodes/virtual | ❌ | ✅ | ✅ |
| DELETE /nodes/:id/virtual | ❌ | ✅ | ✅ |

### Messages

| Endpoint | MeshMonitor | Stridetastic | Include? |
|----------|-------------|--------------|----------|
| GET /messages | ✅ | ❌ | ✅ |
| GET /messages/channel/:ch | ✅ | ❌ | ✅ |
| POST /messages/send | ✅ | ❌ | ✅ |

### Channels

| Endpoint | MeshMonitor | Stridetastic | Include? |
|----------|-------------|--------------|----------|
| GET /channels | ✅ | ✅ | ✅ |
| GET /channels/:id | ✅ | ✅ | ✅ |
| POST /channels | ❌ | ❌ | ✅ |

### Traceroutes

| Endpoint | MeshMonitor | Stridetastic | Include? |
|----------|-------------|--------------|----------|
| GET /traceroutes | ✅ | ❌ | ✅ |
| GET /traceroutes/recent | ✅ | ❌ | ✅ |
| POST /traceroutes/send | ✅ | ✅ | ✅ |

### Interfaces

| Endpoint | MeshMonitor | Stridetastic | Include? |
|----------|-------------|--------------|----------|
| GET /interfaces | ❌ | ✅ | ✅ |
| POST /interfaces | ❌ | ✅ | ✅ |
| POST /interfaces/:id/start | ❌ | ✅ | ✅ |
| POST /interfaces/:id/stop | ❌ | ✅ | ✅ |

### Captures (Security Research)

| Endpoint | MeshMonitor | Stridetastic | Include? |
|----------|-------------|--------------|----------|
| GET /captures | ❌ | ✅ | ✅ |
| POST /captures | ❌ | ✅ | ✅ |
| POST /captures/:id/stop | ❌ | ✅ | ✅ |
| GET /captures/:id/download | ❌ | ✅ | ✅ |

### Metrics/Overview

| Endpoint | MeshMonitor | Stridetastic | Include? |
|----------|-------------|--------------|----------|
| GET /health | ✅ | ✅ | ✅ |
| GET /connection | ✅ | ❌ | ✅ |
| GET /metrics/overview | ❌ | ✅ | ✅ |

---

## Recommended Priority Order for NAMM

### Phase 1A: Core UI (Weeks 1-2)
1. Project setup with Next.js 15 + Tailwind
2. Design system (Catppuccin + shadcn/ui)
3. Layout (Sidebar + Mobile Nav)
4. Dashboard overview

### Phase 1B: Network Visualization (Weeks 2-3)
1. Node list with filters
2. Network map (Leaflet)
3. Network graph (force-directed)
4. Path analysis panel

### Phase 1C: Messaging (Weeks 3-4)
1. Channel list
2. Message thread view
3. iMessage-style bubbles
4. Emoji reactions
5. Reply threading
6. Direct messages

### Phase 1D: Advanced (Weeks 4-5)
1. Node details page
2. Telemetry charts
3. Traceroute history
4. Settings page

### Phase 1E: Polish (Week 6)
1. Loading states
2. Error handling
3. Empty states
4. Animations
5. Mobile testing

---

## Feature Decisions Summary

| Category | Decision | Rationale |
|----------|----------|-----------|
| **Messaging** | MeshMonitor style | Best-in-class iMessage UX |
| **Network Graph** | Stridetastic style | More powerful visualization |
| **Dashboard** | Hybrid | MeshMonitor widgets + Stridetastic metrics |
| **Auth** | MeshMonitor RBAC | More granular permissions |
| **Data Layer** | Stridetastic-inspired | TimescaleDB for time-series |
| **Interface Support** | Stridetastic | Multi-interface (MQTT + Serial) |
| **PCAP Capture** | Stridetastic | Security research capability |
| **Virtual Nodes** | Stridetastic | Advanced testing features |
| **Theme** | MeshMonitor | Catppuccin Mocha is beautiful |

---

*This comparison informs NAMM's development priorities and feature decisions.*
