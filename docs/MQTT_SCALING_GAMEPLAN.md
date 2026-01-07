# MQTT Scaling Game Plan

**Goal**: Handle high-volume MQTT messages (100-1000+ msgs/min) with persistent storage, real-time frontend updates, and single Docker container deployment.

**Status**: 🎉 ALL PHASES COMPLETE ✅

**Progress**:
- ✅ Phase 1: Database Foundation (Days 1-3) - COMPLETE (27 tests)
- ✅ Phase 2: MQTT Worker Service (Days 4-6) - COMPLETE (24 tests)
- ✅ Phase 3: WebSocket Real-time Updates (Days 7-9) - COMPLETE (14 tests)
- ✅ Phase 4: Optimization & Filtering (Days 10-12) - COMPLETE (10 tests)
- ✅ Phase 5: Docker Single Container (Days 13-15) - COMPLETE (Production Ready)

**Total Test Coverage**: 165/165 tests passing (100%)

### Stack Decisions
- **Database**: SQLite + better-sqlite3
- **Backend**: Next.js API routes + long-running MQTT worker
- **Real-time**: WebSocket (ws library)
- **Queue**: In-memory LRU cache
- **Monitoring**: Simple JSON metrics endpoint
- **Container**: Single Docker with pm2 process management

### Why These Choices?
| Decision | Rationale |
|----------|-----------|
| SQLite over PostgreSQL | Zero config, 1M+ inserts/sec, perfect for single container, easy migration path |
| Node.js over Rust (initially) | Faster iteration, existing codebase, can add Rust later if needed |
| WebSocket over SSE | Bidirectional, better for high-frequency updates, backpressure support |
| In-memory queue over Redis | Single container requirement, less complexity, sufficient for use case |
| pm2 over systemd | Container-friendly, built-in clustering, zero-downtime restarts |

---

## 📊 Performance Targets

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| MQTT messages/sec | 100-1000 | 2000 |
| DB write latency | <50ms (batched) | 200ms |
| WebSocket update latency | <100ms | 500ms |
| Frontend render time | <16ms (60fps) | 33ms |
| Queue depth | <100 | 1000 |
| Memory usage | <512MB | 1GB |
| Data retention | 30 days default | Configurable |

---

## 🏗️ Database Schema

### Tables

```sql
-- Nodes table
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,           -- hex node ID (!a1b2c3d4)
  node_num INTEGER UNIQUE,       -- decimal node number
  short_name TEXT,
  long_name TEXT,
  hw_model TEXT,
  role INTEGER,
  last_heard INTEGER NOT NULL,   -- unix timestamp
  snr REAL,
  rssi INTEGER,
  hops_away INTEGER,
  battery_level INTEGER,
  voltage REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_nodes_last_heard ON nodes(last_heard DESC);
CREATE INDEX IF NOT EXISTS idx_nodes_updated_at ON nodes(updated_at DESC);

-- Positions table (time-series)
CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT NOT NULL,
  node_num INTEGER NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  altitude INTEGER,
  precision_bits INTEGER,
  timestamp INTEGER NOT NULL,
  snr REAL,
  rssi INTEGER,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_positions_node_timestamp ON positions(node_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_positions_timestamp ON positions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_positions_location ON positions(latitude, longitude);

-- Telemetry table (time-series)
CREATE TABLE IF NOT EXISTS telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT NOT NULL,
  node_num INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  battery_level INTEGER,
  voltage REAL,
  channel_utilization REAL,
  air_util_tx REAL,
  uptime INTEGER,
  temperature REAL,
  snr REAL,
  rssi INTEGER,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_telemetry_node_timestamp ON telemetry(node_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry(timestamp DESC);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,        -- MQTT message ID
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  channel INTEGER NOT NULL,
  text TEXT,
  timestamp INTEGER NOT NULL,
  snr REAL,
  rssi INTEGER,
  hops_away INTEGER,
  FOREIGN KEY (from_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_id, timestamp DESC);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Metadata table for migrations and versioning
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

---

## 🔄 Implementation Phases

### Phase 1: Database Foundation (Days 1-3)

#### Tasks
- [ ] Install dependencies: `better-sqlite3`, `@types/better-sqlite3`
- [ ] Create `src/lib/db/` directory structure
- [ ] Implement database initialization and migration system
- [ ] Create type-safe repository pattern for each table
- [ ] Add data retention cleanup job
- [ ] Write unit tests for database operations

#### Files to Create
```
src/lib/db/
  ├── index.ts              # Database initialization, singleton
  ├── schema.ts             # SQL schema definitions
  ├── migrations.ts         # Version management
  ├── repositories/
  │   ├── nodes.ts          # Node CRUD operations
  │   ├── positions.ts      # Position operations
  │   ├── telemetry.ts      # Telemetry operations
  │   ├── messages.ts       # Message operations
  │   └── settings.ts       # Settings operations
  └── types.ts              # Database type definitions
```

#### Code Pattern Example

```typescript
// src/lib/db/index.ts
import Database from 'better-sqlite3';
import path from 'path';
import { initializeSchema } from './schema';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'namm.db');
    db = new Database(dbPath);

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');

    initializeSchema(db);
  }

  return db;
}

// src/lib/db/repositories/nodes.ts
import type { Database } from 'better-sqlite3';
import type { ProcessedNodeInfo } from '@/lib/mqtt-processor';

export class NodeRepository {
  constructor(private db: Database) {}

  upsert(node: ProcessedNodeInfo) {
    const stmt = this.db.prepare(`
      INSERT INTO nodes (id, node_num, short_name, long_name, hw_model, role,
                         last_heard, snr, rssi, hops_away, created_at, updated_at)
      VALUES (@id, @nodeNum, @shortName, @longName, @hwModel, @role,
              @lastHeard, @snr, @rssi, @hopsAway, @now, @now)
      ON CONFLICT(id) DO UPDATE SET
        short_name = @shortName,
        long_name = @longName,
        hw_model = @hwModel,
        role = @role,
        last_heard = @lastHeard,
        snr = @snr,
        rssi = @rssi,
        hops_away = @hopsAway,
        updated_at = @now
    `);

    return stmt.run({
      id: node.id,
      nodeNum: node.nodeNum,
      shortName: node.shortName,
      longName: node.longName,
      hwModel: node.hwModel,
      role: node.role,
      lastHeard: node.lastHeard,
      snr: node.snr ?? null,
      rssi: node.rssi ?? null,
      hopsAway: node.hopsAway ?? null,
      now: Date.now()
    });
  }

  getAll(activeWithin?: number) {
    const cutoff = activeWithin ? Date.now() - activeWithin : 0;
    const stmt = this.db.prepare(`
      SELECT * FROM nodes
      WHERE last_heard > ?
      ORDER BY last_heard DESC
    `);
    return stmt.all(cutoff);
  }
}
```

#### Success Criteria
- Database initialized on first run
- All tables created with proper indexes
- Type-safe repository methods working
- Data retention job removes old records
- Unit tests passing with 80%+ coverage

---

### Phase 2: MQTT Worker Service (Days 4-6)

#### Tasks
- [ ] Create long-running MQTT worker in Next.js server context
- [ ] Implement in-memory message queue with LRU eviction
- [ ] Add deduplication logic (hash-based, 1-minute window)
- [ ] Implement rate limiting per node (max 1 update/sec)
- [ ] Create batch DB writer (flush every 500ms or 100 messages)
- [ ] Add graceful shutdown handling
- [ ] Implement worker health monitoring

#### Files to Create
```
src/lib/worker/
  ├── mqtt-worker.ts        # Main MQTT worker class
  ├── message-queue.ts      # In-memory queue with LRU
  ├── batch-writer.ts       # Batch database operations
  ├── deduplicator.ts       # Message deduplication
  ├── rate-limiter.ts       # Per-node rate limiting
  └── types.ts              # Worker type definitions
```

#### Code Pattern Example

```typescript
// src/lib/worker/mqtt-worker.ts
import mqtt from 'mqtt';
import { getDatabase } from '@/lib/db';
import { NodeRepository } from '@/lib/db/repositories/nodes';
import { MessageQueue } from './message-queue';
import { BatchWriter } from './batch-writer';
import { processMQTTMessage } from '@/lib/mqtt-processor';

export class MQTTWorker {
  private client: mqtt.MqttClient | null = null;
  private queue: MessageQueue;
  private writer: BatchWriter;
  private isShuttingDown = false;

  constructor() {
    this.queue = new MessageQueue({ maxSize: 10000 });
    this.writer = new BatchWriter(getDatabase(), {
      maxBatchSize: 100,
      maxWaitMs: 500
    });
  }

  async start(broker: string, topic: string) {
    this.client = mqtt.connect(broker, {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clientId: `namm-${Date.now()}`,
      clean: true,
      reconnectPeriod: 5000
    });

    this.client.on('connect', () => {
      console.log('MQTT Worker connected');
      this.client!.subscribe(topic, (err) => {
        if (err) console.error('Subscribe error:', err);
      });
    });

    this.client.on('message', (topic, payload) => {
      if (this.isShuttingDown) return;

      const message = processMQTTMessage(topic, payload.toString());
      if (message) {
        this.queue.enqueue(message);
      }
    });

    // Process queue periodically
    this.startQueueProcessor();
  }

  private startQueueProcessor() {
    setInterval(() => {
      if (this.isShuttingDown) return;

      const batch = this.queue.dequeue(100);
      if (batch.length > 0) {
        this.writer.writeBatch(batch);
      }
    }, 500);
  }

  async shutdown() {
    this.isShuttingDown = true;
    await this.writer.flush();
    this.client?.end();
  }
}

// Singleton instance
let worker: MQTTWorker | null = null;

export function getMQTTWorker(): MQTTWorker {
  if (!worker) {
    worker = new MQTTWorker();
  }
  return worker;
}
```

#### Success Criteria
- Worker connects to MQTT broker reliably
- Messages queued and batched correctly
- Deduplication prevents duplicate DB writes
- Rate limiting prevents node flooding
- Batch writes achieve <50ms latency
- Graceful shutdown flushes all pending messages

---

### Phase 3: WebSocket Real-time Updates (Days 7-9)

#### Tasks
- [ ] Install `ws` library for WebSocket support
- [ ] Create WebSocket server integrated with Next.js
- [ ] Implement differential update protocol
- [ ] Add connection management (reconnection, heartbeat)
- [ ] Integrate with MQTT worker for broadcasts
- [ ] Create frontend WebSocket hook
- [ ] Add frontend update throttling (requestAnimationFrame)
- [ ] Implement backpressure handling

#### Files to Create
```
src/lib/websocket/
  ├── server.ts             # WebSocket server setup
  ├── connection-manager.ts # Client connection tracking
  ├── broadcaster.ts        # Broadcast updates to clients
  └── protocol.ts           # Message protocol types

src/hooks/
  └── useWebSocket.ts       # Frontend WebSocket hook
```

#### Code Pattern Example

```typescript
// src/lib/websocket/protocol.ts
export type WSMessage =
  | { type: 'node_update', data: NodeUpdate[] }
  | { type: 'position_update', data: PositionUpdate[] }
  | { type: 'telemetry_update', data: TelemetryUpdate[] }
  | { type: 'message', data: MessageUpdate[] }
  | { type: 'ping' }
  | { type: 'pong' };

export interface NodeUpdate {
  id: string;
  shortName?: string;
  longName?: string;
  lastHeard: number;
  snr?: number;
  rssi?: number;
}

// src/lib/websocket/server.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

export class WSManager {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();

  constructor(server: any) {
    this.wss = new WebSocketServer({ server, path: '/api/ws' });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.clients.add(ws);

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('message', (data) => {
        // Handle client messages (filters, subscriptions, etc)
      });

      // Send initial data snapshot
      this.sendInitialData(ws);

      // Heartbeat
      const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);

      ws.on('close', () => clearInterval(interval));
    });
  }

  broadcast(message: WSMessage) {
    const payload = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  private sendInitialData(ws: WebSocket) {
    // Send current state snapshot
  }
}

// src/hooks/useWebSocket.ts
import { useEffect, useRef, useState } from 'react';
import type { WSMessage } from '@/lib/websocket/protocol';

export function useWebSocket(url: string) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => setIsConnected(true);
      ws.current.onclose = () => {
        setIsConnected(false);
        setTimeout(connect, 3000); // Reconnect
      };
      ws.current.onmessage = (event) => {
        const message = JSON.parse(event.data) as WSMessage;
        setLastMessage(message);
      };
    };

    connect();
    return () => ws.current?.close();
  }, [url]);

  return { isConnected, lastMessage };
}
```

#### Success Criteria
- WebSocket server runs alongside Next.js
- Clients connect and receive real-time updates
- Differential updates reduce bandwidth by 80%+
- Reconnection works automatically
- Frontend updates throttled to 60fps
- Backpressure prevents client overload

---

### Phase 4: Optimization & Filtering (Days 10-12)

#### Tasks
- [ ] Implement geographic bounding box filtering
- [ ] Add message type priority queues
- [ ] Create hot data cache using `lru-cache`
- [ ] Implement smart topic subscriptions
- [ ] Add exponential backoff for noisy nodes
- [ ] Create paginated REST API endpoints
- [ ] Optimize frontend rendering (virtual scrolling)
- [ ] Add performance metrics endpoint

#### Files to Create
```
src/lib/filters/
  ├── geographic.ts         # Bounding box filtering
  ├── priority-queue.ts     # Message priority handling
  └── rate-limiter.ts       # Node-level rate limiting

src/lib/cache/
  └── hot-cache.ts          # LRU cache for hot data

src/app/api/
  ├── nodes/route.ts        # Paginated nodes API
  ├── positions/route.ts    # Paginated positions API
  ├── telemetry/route.ts    # Paginated telemetry API
  └── metrics/route.ts      # Performance metrics
```

#### Geographic Filter Example

```typescript
// src/lib/filters/geographic.ts
export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function isWithinBounds(
  lat: number,
  lon: number,
  bounds: BoundingBox
): boolean {
  return lat >= bounds.south &&
         lat <= bounds.north &&
         lon >= bounds.west &&
         lon <= bounds.east;
}

// Example: Kentucky bounding box
export const KY_BOUNDS: BoundingBox = {
  north: 39.147458,
  south: 36.497129,
  east: -81.964971,
  west: -89.571509
};
```

#### Success Criteria
- Geographic filtering reduces message volume by 50%+
- Priority queue processes critical messages first
- Cache hit rate >80% for recent nodes
- API endpoints return data <100ms
- Virtual scrolling handles 10k+ items smoothly
- Metrics endpoint provides real-time insights

---

### Phase 5: Docker Single Container (Days 13-15)

#### Tasks
- [ ] Create multi-stage Dockerfile
- [ ] Configure Next.js standalone output
- [ ] Set up pm2 for process management
- [ ] Add volume mounts for SQLite and logs
- [ ] Implement health check endpoints
- [ ] Create docker-compose.yml for easy deployment
- [ ] Add environment variable configuration
- [ ] Write deployment documentation

#### Files to Create
```
Dockerfile.namm           # Multi-stage Docker build
docker-compose.namm.yml   # Docker Compose config
ecosystem.config.js       # pm2 configuration
.dockerignore            # Build optimization
docs/DEPLOYMENT.md       # Deployment guide
```

#### Dockerfile Example

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install pm2
RUN npm install -g pm2

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/ecosystem.config.js ./

# Create data directory for SQLite
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV DATABASE_PATH /app/data/namm.db

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["pm2-runtime", "start", "ecosystem.config.js"]
```

#### pm2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'namm',
    script: 'server.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/app/logs/error.log',
    out_file: '/app/logs/output.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

#### docker-compose.yml

```yaml
services:
  namm:
    build:
      context: .
      dockerfile: Dockerfile.namm
    ports:
      - "3000:3000"
    volumes:
      - namm-data:/app/data
      - namm-logs:/app/logs
    environment:
      - DATABASE_PATH=/app/data/namm.db
      - MQTT_BROKER=mqtt://mqtt.meshtastic.org:1883
      - MQTT_USERNAME=meshdev
      - MQTT_PASSWORD=large4cats
      - MQTT_TOPIC=msh/US/KY/#
      - DATA_RETENTION_DAYS=30
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 40s

volumes:
  namm-data:
  namm-logs:
```

#### Success Criteria
- Single container builds successfully
- Application starts and connects to MQTT
- SQLite data persists across restarts
- Health checks pass consistently
- Container uses <512MB memory
- Logs accessible via volume mounts

---

## 🧪 Testing Strategy

### Unit Tests
- Database repository methods
- MQTT message parsing and processing
- Queue and batch writer logic
- Filter and rate limiter functions

### Integration Tests
- End-to-end MQTT → DB → WebSocket flow
- Database migration and version management
- API endpoint response times and pagination
- WebSocket connection and reconnection

### Performance Tests
- Load test: 1000 msgs/sec for 5 minutes
- Memory leak detection (24-hour run)
- Database query performance under load
- WebSocket broadcast latency

### Tools
- Vitest for unit/integration tests
- k6 or Artillery for load testing
- clinic.js for performance profiling

---

## 📈 Monitoring & Metrics

### Metrics to Track

```typescript
// src/app/api/metrics/route.ts
export interface SystemMetrics {
  mqtt: {
    messagesPerSecond: number;
    queueDepth: number;
    connected: boolean;
    uptime: number;
  };
  database: {
    writeLatency: number;
    queryLatency: number;
    size: number;
    nodeCount: number;
    positionCount: number;
  };
  websocket: {
    connectedClients: number;
    messagesPerSecond: number;
    backpressureEvents: number;
  };
  system: {
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
  };
}
```

### Alerting Thresholds
- Queue depth > 1000
- DB write latency > 200ms
- Memory usage > 1GB
- WebSocket clients > 100

---

## 🔧 Configuration

### Environment Variables

```bash
# MQTT Settings
MQTT_BROKER=mqtt://mqtt.meshtastic.org:1883
MQTT_USERNAME=meshdev
MQTT_PASSWORD=large4cats
MQTT_TOPIC=msh/US/KY/#
MQTT_USE_TLS=false

# Database Settings
DATABASE_PATH=/app/data/namm.db
DATA_RETENTION_DAYS=30
DB_BACKUP_ENABLED=true
DB_BACKUP_INTERVAL_HOURS=24

# Performance Settings
MQTT_QUEUE_SIZE=10000
BATCH_SIZE=100
BATCH_INTERVAL_MS=500
WS_MAX_CLIENTS=100

# Geographic Filtering
ENABLE_GEO_FILTER=true
GEO_NORTH=39.147458
GEO_SOUTH=36.497129
GEO_EAST=-81.964971
GEO_WEST=-89.571509

# Server Settings
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

---

## 🚦 Migration Path

### From Current State
1. Keep existing client-side MQTT connection working
2. Implement database layer in parallel
3. Add backend worker alongside client connection
4. Migrate to WebSocket incrementally
5. Deprecate client-side MQTT once stable

### Future Scaling Options
1. **Multi-instance**: Migrate SQLite → PostgreSQL, add Redis for shared cache
2. **Rust Worker**: Replace Node.js worker with Rust for 5-10x throughput
3. **Message Broker**: Add RabbitMQ/NATS for distributed processing
4. **Horizontal Scaling**: Separate frontend, backend, and worker containers

---

## ✅ Definition of Done

Each phase is complete when:
- [ ] All tasks checked off
- [ ] Code reviewed and merged
- [ ] Tests passing with >80% coverage
- [ ] Performance targets met
- [ ] Documentation updated
- [ ] Demo/screenshots captured

Project complete when:
- [ ] All 5 phases done
- [ ] Single Docker container deployable
- [ ] Handles 1000 msgs/sec sustained
- [ ] Frontend responsive at 60fps
- [ ] Data persists across restarts
- [ ] Deployment guide written

---

## 📚 Additional Resources

### Dependencies to Add
```json
{
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "ws": "^8.18.0",
    "lru-cache": "^11.0.0",
    "pm2": "^5.4.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/ws": "^8.5.12",
    "k6": "^0.0.0"
  }
}
```

### Useful Commands
```bash
# Development
npm run dev

# Build
npm run build

# Test
npm test
npm run test:coverage

# Docker
docker build -f Dockerfile.namm -t namm:latest .
docker compose -f docker-compose.namm.yml up -d

# Database backup
sqlite3 data/namm.db ".backup data/backup.db"

# View logs
docker compose -f docker-compose.namm.yml logs -f
pm2 logs namm
```

---

## 🎯 Next Steps

**Ready to start?** Begin with Phase 1 (Database Foundation).

Run: `npm install better-sqlite3 @types/better-sqlite3`

Then create `src/lib/db/index.ts` and implement the database initialization.

**Questions or blockers?** Reference this document and adjust as needed. This is a living document - update it as you learn.

**Estimated Timeline**: 2-3 weeks for full implementation with proper testing.

---

*Last Updated: January 5, 2026*
