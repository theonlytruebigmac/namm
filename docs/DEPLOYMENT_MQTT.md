# MQTT Worker Deployment Guide

## Overview

This guide covers deploying the NAMM MQTT worker as a single Docker container with persistent storage, real-time WebSocket updates, and automatic health monitoring.

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+ (optional but recommended)
- At least 512MB RAM available
- 1GB disk space for database and logs

## Quick Start

### Using Docker Compose (Recommended)

1. **Clone and navigate to project:**
```bash
cd /path/to/namm
```

2. **Create environment file:**
```bash
cp .env.mqtt.example .env
```

3. **Edit `.env` with your configuration:**
```env
MQTT_BROKER=mqtt://mqtt.meshtastic.org:1883
MQTT_USERNAME=meshdev
MQTT_PASSWORD=large4cats
MQTT_TOPIC=msh/US/KY/#  # Change to your region
DATA_RETENTION_DAYS=30
```

4. **Build and start:**
```bash
docker-compose -f docker-compose.mqtt.yml up -d
```

5. **Check status:**
```bash
docker-compose -f docker-compose.mqtt.yml ps
docker-compose -f docker-compose.mqtt.yml logs -f
```

6. **Access the application:**
- Web UI: http://localhost:3000
- Health: http://localhost:3000/api/health
- Metrics: http://localhost:3000/api/metrics

### Using Docker CLI

1. **Build image:**
```bash
docker build -f Dockerfile.mqtt -t namm-mqtt:latest .
```

2. **Run container:**
```bash
docker run -d \
  --name namm-mqtt-worker \
  -p 3000:3000 \
  -v namm-data:/app/data \
  -v namm-logs:/app/logs \
  -e MQTT_BROKER=mqtt://mqtt.meshtastic.org:1883 \
  -e MQTT_USERNAME=meshdev \
  -e MQTT_PASSWORD=large4cats \
  -e MQTT_TOPIC="msh/US/#" \
  --restart unless-stopped \
  namm-mqtt:latest
```

3. **Check logs:**
```bash
docker logs -f namm-mqtt-worker
```

## Architecture

### Container Components

```
┌─────────────────────────────────────┐
│       namm-mqtt-worker              │
├─────────────────────────────────────┤
│  ┌────────────┐  ┌──────────────┐  │
│  │  Next.js   │  │ MQTT Worker  │  │
│  │  Server    │  │              │  │
│  │  (HTTP)    │  │ - Subscribe  │  │
│  │            │  │ - Process    │  │
│  │  WebSocket │  │ - Dedupe     │  │
│  │  Server    │  │ - Rate Limit │  │
│  └────────────┘  │ - Batch Write│  │
│                  └──────────────┘  │
│  ┌────────────────────────────┐   │
│  │     SQLite Database        │   │
│  │   /app/data/namm.db        │   │
│  └────────────────────────────┘   │
├─────────────────────────────────────┤
│          PM2 Runtime                │
└─────────────────────────────────────┘
```

### Data Persistence

- **Database**: `/app/data/namm.db` (SQLite with WAL mode)
- **Logs**: `/app/logs/` (PM2 output and error logs)
- **Volumes**: Automatically created and managed by Docker

### Ports

- **3000**: HTTP/WebSocket server

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `DATABASE_PATH` | `/app/data/namm.db` | SQLite database path |
| `MQTT_BROKER` | `mqtt://mqtt.meshtastic.org:1883` | MQTT broker URL |
| `MQTT_USERNAME` | `meshdev` | MQTT username |
| `MQTT_PASSWORD` | `large4cats` | MQTT password |
| `MQTT_TOPIC` | `msh/US/#` | MQTT topic subscription |
| `DATA_RETENTION_DAYS` | `30` | Days to retain historical data |
| `NODE_ENV` | `production` | Node environment |

## Operations

### Viewing Logs

**Docker Compose:**
```bash
docker-compose -f docker-compose.mqtt.yml logs -f
docker-compose -f docker-compose.mqtt.yml logs -f --tail=100
```

**Docker CLI:**
```bash
docker logs -f namm-mqtt-worker
docker logs --tail=100 namm-mqtt-worker
```

### Stopping the Container

**Docker Compose:**
```bash
docker-compose -f docker-compose.mqtt.yml down
```

**Docker CLI:**
```bash
docker stop namm-mqtt-worker
```

### Restarting

**Docker Compose:**
```bash
docker-compose -f docker-compose.mqtt.yml restart
```

**Docker CLI:**
```bash
docker restart namm-mqtt-worker
```

### Updating

1. **Pull latest code:**
```bash
git pull
```

2. **Rebuild and restart:**
```bash
docker-compose -f docker-compose.mqtt.yml up -d --build
```

### Backing Up Data

**Backup database:**
```bash
docker cp namm-mqtt-worker:/app/data/namm.db ./backup-$(date +%Y%m%d).db
```

**Backup using volume:**
```bash
docker run --rm -v namm-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/namm-data-$(date +%Y%m%d).tar.gz -C /data .
```

### Restoring Data

```bash
docker cp ./backup-20260105.db namm-mqtt-worker:/app/data/namm.db
docker restart namm-mqtt-worker
```

## Monitoring

### Health Check

The container includes built-in health checks:

```bash
curl http://localhost:3000/api/health
```

**Response:**
```json
{
  "timestamp": 1704470400000,
  "status": "healthy",
  "uptime": 3600,
  "checks": {
    "database": { "status": "healthy" },
    "mqtt": { "status": "healthy" },
    "websocket": { "status": "healthy" },
    "memory": { "status": "healthy", "message": "128MB / 256MB" }
  }
}
```

### Metrics

```bash
curl http://localhost:3000/api/metrics
```

**Response includes:**
- Memory usage
- MQTT worker stats (messages processed, throughput)
- WebSocket connection count
- Database size
- Cache statistics

### Docker Health Status

```bash
docker inspect namm-mqtt-worker | grep -A 5 Health
```

## Performance Tuning

### Memory Limits

Set memory limits to prevent container from consuming too much:

```yaml
services:
  namm-mqtt:
    mem_limit: 512m
    mem_reservation: 256m
```

### CPU Limits

```yaml
services:
  namm-mqtt:
    cpus: '1.0'
```

### Database Optimization

The database is automatically optimized with:
- WAL mode for concurrency
- Automatic data retention cleanup
- Indexed queries
- Batch writes

### Queue Tuning

Edit `ecosystem.config.cjs` to adjust PM2 settings:

```javascript
max_memory_restart: '500M',  // Restart if memory exceeds
max_restarts: 10,            // Max restart attempts
min_uptime: '10s'            // Minimum uptime before restart
```

## Troubleshooting

### Container Won't Start

1. **Check logs:**
```bash
docker logs namm-mqtt-worker
```

2. **Check port conflicts:**
```bash
lsof -i :3000
```

3. **Verify environment variables:**
```bash
docker inspect namm-mqtt-worker | grep -A 20 Env
```

### High Memory Usage

1. **Check metrics:**
```bash
curl http://localhost:3000/api/metrics
```

2. **Restart container:**
```bash
docker restart namm-mqtt-worker
```

3. **Adjust PM2 memory limit** in `ecosystem.config.cjs`

### MQTT Connection Issues

1. **Check MQTT broker accessibility:**
```bash
docker exec namm-mqtt-worker ping mqtt.meshtastic.org
```

2. **Verify credentials** in environment variables

3. **Check worker health:**
```bash
curl http://localhost:3000/api/worker/status
```

### Database Locked Errors

- Ensure only one container is running
- Check for crashed processes holding locks
- Restart container to clear locks

### WebSocket Connection Drops

1. **Check connection count:**
```bash
curl http://localhost:3000/api/ws
```

2. **Increase heartbeat timeout** if needed

3. **Check network stability**

## Production Deployment

### Recommended Settings

```yaml
services:
  namm-mqtt:
    restart: unless-stopped
    mem_limit: 512m
    cpus: '1.0'
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      interval: 30s
      timeout: 3s
      retries: 3
```

### Security Considerations

1. **Change default MQTT credentials**
2. **Use environment variables** instead of hardcoded values
3. **Limit container resources**
4. **Enable Docker user namespaces**
5. **Regular backups**
6. **Monitor health endpoints**

### Scaling Considerations

This is a **single-container** deployment. For horizontal scaling:

1. **Use external message broker** (Redis, RabbitMQ)
2. **Separate database** (PostgreSQL)
3. **Load balancer** for multiple instances
4. **Shared storage** for distributed deployment

Current design optimized for:
- 100-1000 messages/minute
- 1-10 WebSocket clients
- Single-host deployment

## API Endpoints

### Public Endpoints

- `GET /api/health` - Health status
- `GET /api/metrics` - Performance metrics
- `GET /api/nodes` - Paginated nodes
- `GET /api/positions` - Paginated positions
- `GET /api/telemetry` - Paginated telemetry
- `GET /api/worker/status` - Worker status
- `WS /api/ws` - WebSocket connection

### Worker Control

- `POST /api/worker/control` - Start/stop/restart worker

## Support

For issues and questions:
1. Check logs: `docker logs namm-mqtt-worker`
2. Check health: `curl http://localhost:3000/api/health`
3. Review metrics: `curl http://localhost:3000/api/metrics`

## License

See LICENSE file in project root.
