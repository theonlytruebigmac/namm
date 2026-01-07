# Phase 2: Backend Integration

## Overview
Phase 2 adds real Meshtastic device integration with fallback to mock data for development.

## Features Implemented

### 1. Meshtastic HTTP API Client (`src/lib/meshtastic-client.ts`)
- Connects to Meshtastic device via HTTP API (default port 4403)
- Fetches nodes, messages, and channels
- Sends messages to the mesh network
- Gets device information
- Tests connection status

### 2. Next.js API Routes
- **GET /api/nodes** - Fetch all nodes from device
- **GET /api/messages** - Fetch messages with optional limit
- **POST /api/messages** - Send message to mesh network
- **GET /api/channels** - Fetch available channels
- **GET /api/device** - Get device info and connection status

### 3. Updated React Hooks
All data fetching hooks now support both real API and mock data:
- `useNodes()` - Fetch nodes (real or mock)
- `useMessages()` - Fetch messages (real or mock)
- `useChannels()` - Fetch channels (real or mock)
- `useDeviceConnection()` - Check device connection status

### 4. Environment Configuration
```bash
# .env.local
MESHTASTIC_API_URL=http://localhost:4403
NEXT_PUBLIC_USE_REAL_API=false  # Set to "true" to use real device
```

## Usage

### Development Mode (Mock Data)
```bash
# .env.local
NEXT_PUBLIC_USE_REAL_API=false

npm run dev
```
Uses mock data - no Meshtastic device required.

### Production Mode (Real Device)
```bash
# .env.local
MESHTASTIC_API_URL=http://your-device-ip:4403
NEXT_PUBLIC_USE_REAL_API=true

npm run dev
```
Connects to actual Meshtastic device. Fallback to mock data if connection fails.

## Connection Indicator
The sidebar shows connection status:
- 🟢 **Connected** - Real API mode, device connected
- 🔴 **Disconnected** - Real API mode, device not reachable
- 🟢 **Mock Data** - Development mode using mock data

## Meshtastic Device Setup

### 1. Enable HTTP API on Device
Configure your Meshtastic device to enable the HTTP API:
- Go to device settings
- Enable HTTP/HTTPS server
- Note the IP address and port (default: 4403)

### 2. Network Configuration
Ensure your computer can reach the device:
```bash
# Test connection
curl http://your-device-ip:4403/api/v1/device

# Or in browser
http://your-device-ip:4403
```

### 3. Update Environment Variables
```bash
# .env.local
MESHTASTIC_API_URL=http://192.168.1.100:4403
NEXT_PUBLIC_USE_REAL_API=true
```

## API Endpoints

### Fetch Nodes
```typescript
GET /api/nodes
Response: { nodes: Node[], count: number }
```

### Fetch Messages
```typescript
GET /api/messages?limit=100
Response: { messages: Message[], count: number }
```

### Send Message
```typescript
POST /api/messages
Body: { text: string, channel: number }
Response: { success: boolean, message: string }
```

### Get Channels
```typescript
GET /api/channels
Response: { channels: Channel[], count: number }
```

### Device Info
```typescript
GET /api/device
Response: {
  connected: boolean,
  device: { ... },
  error?: string
}
```

## Architecture

```
┌─────────────────┐
│   React UI      │
│  (Frontend)     │
└────────┬────────┘
         │
         │ React Query
         │
┌────────▼────────┐
│  API Routes     │
│  (Next.js)      │
└────────┬────────┘
         │
         │ HTTP
         │
┌────────▼────────┐
│  Meshtastic     │
│    Client       │
└────────┬────────┘
         │
         │ HTTP API
         │
┌────────▼────────┐
│  Meshtastic     │
│    Device       │
└─────────────────┘
```

## Next Steps (Phase 3)

1. **WebSocket/Server-Sent Events**
   - Real-time message updates
   - Live node status changes
   - No polling required

2. **MQTT Integration**
   - Subscribe to Meshtastic MQTT broker
   - More reliable than HTTP polling
   - Better for multiple devices

3. **Message Queue**
   - Offline message queue
   - Retry failed messages
   - Message persistence

4. **Interactive Map**
   - Leaflet integration
   - Real-time node positions
   - Signal strength visualization

5. **Network Graph**
   - Force-directed graph
   - Node relationships
   - Network topology visualization

## Troubleshooting

### Device Not Connecting
```bash
# Check device is reachable
ping your-device-ip

# Test API endpoint
curl http://your-device-ip:4403/api/v1/device

# Check environment variables
echo $MESHTASTIC_API_URL
```

### Mock Data Not Loading
- Ensure `NEXT_PUBLIC_USE_REAL_API=false` in `.env.local`
- Restart dev server after changing env vars
- Clear browser cache

### API Returns Empty Data
- Device may not have any nodes/messages yet
- Wait for mesh activity
- Check device logs
- Verify device is connected to mesh network

## Development Tips

1. **Start with Mock Data**
   - Test UI without device
   - Faster development iteration
   - No hardware required

2. **Test with Real Device**
   - Set `NEXT_PUBLIC_USE_REAL_API=true`
   - Verify API integration
   - Check error handling

3. **Monitor Network Tab**
   - Watch API calls in DevTools
   - Check request/response data
   - Identify connection issues

4. **Use React Query DevTools**
   - View cached data
   - Monitor refetch intervals
   - Debug query states
