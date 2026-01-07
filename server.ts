/**
 * Custom Server Entry Point
 *
 * Initializes WebSocket server and MQTT worker alongside Next.js server
 */

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initWebSocketServer } from './src/lib/websocket';
import { getMQTTWorker } from './src/lib/worker/mqtt-worker';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create HTTP server
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // Initialize WebSocket server
  initWebSocketServer(server);

  // Auto-start MQTT worker if configured
  if (process.env.MQTT_BROKER) {
    console.log('[MQTT Server] Auto-starting MQTT worker...');
    try {
      const worker = getMQTTWorker({
        broker: process.env.MQTT_BROKER,
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        topic: process.env.MQTT_TOPIC || 'msh/US/#',
        useTLS: process.env.MQTT_USE_TLS === 'true',
        clientId: `namm-worker-${Date.now()}`
      });
      worker.start().catch((err) => {
        console.error('[MQTT Server] Failed to start worker:', err);
      });
    } catch (error) {
      console.error('[MQTT Server] Failed to initialize worker:', error);
    }
  }

  // Start server
  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
