module.exports = {
  apps: [{
    name: 'stocksdaily',
    script: 'server.js',
    port: 9821,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 9821
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 9821
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
}; 