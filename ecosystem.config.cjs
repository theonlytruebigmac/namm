// PM2 Ecosystem Configuration for MQTT Worker
module.exports = {
  apps: [{
    name: 'namm-mqtt',
    script: './server.js',
    interpreter: 'node',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_PATH: process.env.DATABASE_PATH || '/app/data/namm.db',
      MQTT_BROKER: process.env.MQTT_BROKER || '',
      MQTT_USERNAME: process.env.MQTT_USERNAME || 'meshdev',
      MQTT_PASSWORD: process.env.MQTT_PASSWORD || 'large4cats',
      MQTT_TOPIC: process.env.MQTT_TOPIC || 'msh/US/#',
      DATA_RETENTION_DAYS: process.env.DATA_RETENTION_DAYS || '30'
    },
    error_file: '/app/logs/error.log',
    out_file: '/app/logs/output.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '500M',
    kill_timeout: 5000
  }]
};
