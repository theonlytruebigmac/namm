/**
 * MQTT Worker Auto-Start Module
 *
 * Automatically starts the MQTT worker when imported if MQTT_BROKER is configured
 */

import { getMQTTWorker } from './mqtt-worker';

// Auto-start flag to prevent multiple initializations
let autoStarted = false;

export function autoStartMQTTWorker() {
  if (autoStarted) {
    return;
  }

  const broker = process.env.MQTT_BROKER;
  if (!broker) {
    console.log('[MQTT Worker] MQTT_BROKER not configured, skipping auto-start');
    return;
  }

  autoStarted = true;
  console.log('[MQTT Worker] Auto-starting MQTT worker...');
  console.log('[MQTT Worker] Broker:', broker);
  console.log('[MQTT Worker] Topic:', process.env.MQTT_TOPIC || 'msh/US/#');

  try {
    const worker = getMQTTWorker({
      broker,
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      topic: process.env.MQTT_TOPIC || 'msh/US/#',
      useTLS: process.env.MQTT_USE_TLS === 'true',
      clientId: `namm-worker-${Date.now()}`
    });

    worker.start().catch((err) => {
      console.error('[MQTT Worker] Failed to start:', err);
      autoStarted = false; // Allow retry
    });
  } catch (error) {
    console.error('[MQTT Worker] Failed to initialize:', error);
    autoStarted = false; // Allow retry
  }
}

// Auto-start on module load (server-side only)
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  autoStartMQTTWorker();
}
