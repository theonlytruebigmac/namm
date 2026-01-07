#!/usr/bin/env node
import mqtt from 'mqtt';

const client = mqtt.connect('mqtt://mqtt.meshtastic.org:1883', {
  username: 'meshdev',
  password: 'large4cats'
});

let messageCount = 0;
const maxMessages = 5;

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  client.subscribe('msh/US/KY/2/json/#', (err) => {
    if (err) {
      console.error('Subscription error:', err);
      process.exit(1);
    }
    console.log('Subscribed to msh/US/KY/2/json/#\n');
    console.log('Waiting for messages...\n');
  });
});

client.on('message', (topic, message) => {
  messageCount++;

  console.log(`\n=== MESSAGE ${messageCount} ===`);
  console.log('Topic:', topic);
  console.log('Payload:', message.toString());

  try {
    const parsed = JSON.parse(message.toString());
    console.log('Type:', parsed.type);
    console.log('From:', parsed.from);
    if (parsed.payload) {
      console.log('Payload keys:', Object.keys(parsed.payload));
    }
  } catch (e) {
    console.log('Parse error:', e.message);
  }

  if (messageCount >= maxMessages) {
    console.log(`\n\nCaptured ${maxMessages} messages, exiting...`);
    client.end();
    process.exit(0);
  }
});

client.on('error', (error) => {
  console.error('MQTT Error:', error);
  process.exit(1);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('\nTimeout - no messages received');
  client.end();
  process.exit(0);
}, 30000);
