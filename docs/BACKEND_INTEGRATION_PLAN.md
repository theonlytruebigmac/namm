# Backend Integration Plan

**Status**: In Progress
**Target Completion**: Week 1-2
**Current Phase**: Preparation

## Overview

Replace mock API with real Meshtastic HTTP endpoints and WebSocket connections for live updates.

## Architecture

### Current State (Mock API)
```
Frontend → useNodes/useMessages → Mock Data → State
```

### Target State (Real API)
```
Frontend → React Query → HTTP Client → Meshtastic API → State
                      ↓
                  WebSocket → Live Updates → State
```

## Phase 1: HTTP Client Setup ✅

### 1.1 Create HTTP Client Module
**File**: `src/lib/api/http.ts`

**Features**:
- ✅ Request timeout handling (10s default)
- ✅ Automatic retry logic (3 attempts)
- ✅ Exponential backoff
- ✅ Error handling and types
- ✅ GET/POST/PUT/DELETE wrappers
- ✅ Connection health check

**API Methods**:
```typescript
apiGet<T>(endpoint, options)
apiPost<T>(endpoint, body, options)
apiPut<T>(endpoint, body, options)
apiDelete<T>(endpoint, options)
checkAPIConnection()
getAPIHealth()
```

### 1.2 Environment Configuration
**File**: `.env.local`

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_USE_REAL_API=true

# WebSocket Configuration
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_WS_RECONNECT_DELAY=3000
```

## Phase 2: API Endpoint Mapping

### 2.1 Nodes API

| Mock Function | Real Endpoint | Method | Status |
|--------------|---------------|--------|--------|
| `getNodes()` | `/api/nodes` | GET | ⚠️ |
| `getNode(id)` | `/api/nodes/:id` | GET | ⚠️ |
| `getActiveNodes(hours)` | `/api/nodes/active?days=N` | GET | ⚠️ |
| `getFavoriteNodes()` | `/api/nodes` (filter) | GET | ⚠️ |
| `setNodeFavorite(id, flag)` | `/api/nodes/:id/favorite` | POST | ⚠️ |

**Data Transformation Needed**:
- Map `nodeNum` → `num`
- Map `user.id` → `id`
- Parse timestamps (Unix → JS Date)
- Normalize nested objects

### 2.2 Messages API

| Mock Function | Real Endpoint | Method | Status |
|--------------|---------------|--------|--------|
| `getMessages()` | `/api/messages?limit=100` | GET | ⚠️ |
| `getMessagesByChannel(ch)` | `/api/messages/channel/:ch` | GET | ⚠️ |
| `getDirectMessages(n1, n2)` | `/api/messages/direct/:n1/:n2` | GET | ⚠️ |
| `sendMessage(text, ch)` | `/api/messages/send` | POST | ⚠️ |

### 2.3 Device Info API

| Function | Endpoint | Method | Status |
|----------|----------|--------|--------|
| `getDeviceInfo()` | `/api/device/info` | GET | ⚠️ |
| `getConnectionStatus()` | `/api/device/connection` | GET | ⚠️ |

### 2.4 Channels API

| Function | Endpoint | Method | Status |
|----------|----------|--------|--------|
| `getChannels()` | `/api/channels` | GET | ⚠️ |

## Phase 3: Data Type Mapping

### 3.1 Node Type Transformation

**API Response**:
```typescript
{
  nodeNum: number,
  user: {
    id: string,          // "!df6ab854"
    longName: string,
    shortName: string,
    hwModel: number
  },
  position: { ... },
  deviceMetrics: { ... },
  lastHeard: number,     // Unix timestamp
  snr: number,
  rssi: number
}
```

**Frontend Type**:
```typescript
{
  id: string,
  num: number,
  longName: string,
  shortName: string,
  hwModel: string,
  position: { ... },
  batteryLevel: number,
  voltage: number,
  lastHeard: number,
  snr: number,
  rssi: number,
  isFavorite?: boolean
}
```

**Transformer Function**:
```typescript
function transformNode(apiNode: APINode): Node {
  return {
    id: apiNode.user.id,
    num: apiNode.nodeNum,
    longName: apiNode.user.longName,
    shortName: apiNode.user.shortName,
    hwModel: getHWModelName(apiNode.user.hwModel),
    position: apiNode.position,
    batteryLevel: apiNode.deviceMetrics?.batteryLevel,
    voltage: apiNode.deviceMetrics?.voltage,
    channelUtilization: apiNode.deviceMetrics?.channelUtilization,
    airUtilTx: apiNode.deviceMetrics?.airUtilTx,
    lastHeard: apiNode.lastHeard * 1000, // Convert to milliseconds
    snr: apiNode.snr,
    rssi: apiNode.rssi,
  };
}
```

### 3.2 Message Type Transformation

**API Response**:
```typescript
{
  id: string,
  from: string,         // "!df6ab854"
  to: string,          // "!ffffffff"
  text: string,
  channel: number,
  portnum: number,
  timestamp: string,    // ISO 8601
  rxTime: number,       // Unix timestamp
  createdAt: number
}
```

**Frontend Type**:
```typescript
{
  id: string,
  fromNode: string,
  toNode: string,
  text: string,
  channel: number,
  timestamp: number,
  hopLimit?: number
}
```

## Phase 4: WebSocket Implementation

### 4.1 WebSocket Manager

**File**: `src/lib/websocket/manager.ts`

**Features**:
- Connection lifecycle management
- Automatic reconnection
- Event type parsing
- Message queue for offline mode
- Connection status tracking

**Event Types**:
```typescript
type WSEvent =
  | { type: 'node_update', data: Node }
  | { type: 'new_message', data: Message }
  | { type: 'telemetry_update', data: Telemetry }
  | { type: 'connection_status', data: { connected: boolean } }
```

### 4.2 React Hook

**File**: `src/hooks/useWebSocket.ts`

```typescript
export function useWebSocket() {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);

  // Connection management
  // Event handling
  // Reconnection logic

  return { status, lastEvent, send };
}
```

## Phase 5: Integration with React Query

### 5.1 Update Hooks

**Files to Modify**:
- `src/hooks/useNodes.ts`
- `src/hooks/useMessages.ts`
- `src/hooks/useChannels.ts`

**Changes**:
```typescript
// Before (Mock)
export function useNodes() {
  return useQuery({
    queryKey: ['nodes'],
    queryFn: () => getNodes(), // Returns mock data
  });
}

// After (Real API)
export function useNodes() {
  return useQuery({
    queryKey: ['nodes'],
    queryFn: async () => {
      const nodes = await apiGet<APINode[]>('/api/nodes');
      return nodes.map(transformNode);
    },
    staleTime: 30000, // 30s
    refetchInterval: 60000, // 1min
  });
}
```

### 5.2 Optimistic Updates

Handle WebSocket events to update React Query cache:

```typescript
const queryClient = useQueryClient();

ws.on('node_update', (node) => {
  queryClient.setQueryData(['nodes'], (old) =>
    updateNodeInList(old, node)
  );
});
```

## Phase 6: Error Handling

### 6.1 Error Boundary

**File**: `src/components/ErrorBoundary.tsx`

Handle API errors gracefully:
- Connection failures
- Timeout errors
- Authentication errors
- Invalid data errors

### 6.2 Fallback Strategies

1. **Progressive Enhancement**: Use mock data if API unavailable
2. **Cached Data**: Show stale data with warning
3. **Error States**: Clear error messages to user
4. **Retry Options**: Manual retry buttons

## Phase 7: Testing

### 7.1 HTTP Client Tests

**File**: `src/lib/api/__tests__/http.test.ts`

Test:
- ✅ Successful requests
- ✅ Timeout handling
- ✅ Retry logic
- ✅ Error parsing
- ✅ Connection check

### 7.2 Integration Tests

Test real API responses:
- Mock API server responses
- Test data transformations
- Test error scenarios
- Test WebSocket events

### 7.3 E2E Tests (Future)

- Full user flows with real backend
- WebSocket reconnection scenarios
- Offline mode handling

## Migration Checklist

### Environment Setup
- [ ] Create `.env.local` with API URLs
- [ ] Document environment variables
- [ ] Add example `.env.example` file

### HTTP Client
- [x] Create `http.ts` with request wrappers
- [ ] Add timeout and retry logic
- [ ] Implement error handling
- [ ] Add connection health checks
- [ ] Write unit tests

### API Endpoints
- [ ] Implement `nodes.ts` with real API
- [ ] Implement `messages.ts` with real API
- [ ] Implement `channels.ts` with real API
- [ ] Add data transformers
- [ ] Update types if needed

### WebSocket
- [ ] Create WebSocket manager
- [ ] Implement reconnection logic
- [ ] Create React hook
- [ ] Integrate with React Query
- [ ] Add connection status UI

### Testing
- [ ] Test HTTP client
- [ ] Test data transformers
- [ ] Test WebSocket manager
- [ ] Integration tests
- [ ] Manual testing with real device

### Documentation
- [ ] Update API documentation
- [ ] Document environment setup
- [ ] Add troubleshooting guide
- [ ] Update README with real API info

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| HTTP Client Setup | 1 day | ✅ |
| API Endpoint Mapping | 2 days | ⚠️ |
| Data Transformers | 1 day | ⚠️ |
| WebSocket Implementation | 2 days | ⏳ |
| React Query Integration | 1 day | ⏳ |
| Error Handling | 1 day | ⏳ |
| Testing | 2 days | ⏳ |
| **Total** | **10 days** | **10% Complete** |

## Risks & Mitigation

### Risk 1: API Unavailable During Development
**Mitigation**: Keep mock data as fallback, use feature flags

### Risk 2: Breaking Changes in API
**Mitigation**: Version API endpoints, maintain adapters

### Risk 3: WebSocket Connection Issues
**Mitigation**: Implement robust reconnection, fallback to polling

### Risk 4: Performance with Large Datasets
**Mitigation**: Implement pagination, virtual scrolling, data limits

## Success Criteria

- ✅ All API endpoints integrated
- ✅ WebSocket live updates working
- ✅ Error handling comprehensive
- ✅ Tests passing (>80% coverage)
- ✅ Performance acceptable (<2s load)
- ✅ Graceful degradation to mock data

## Next Steps

1. Complete data type transformers
2. Update `nodes.ts` to use real API
3. Test with local Meshtastic instance
4. Implement WebSocket manager
5. Update React Query hooks
