module.exports = {
  apps: [
    {
      name: 'logilink-api',
      script: './src/server.js',
      instances: 1, // Use 'max' for cluster mode (1 instance per CPU)
      exec_mode: 'fork', // Use 'cluster' for load balancing
      autorestart: true,
      watch: false, // Don't watch in production
      max_memory_restart: '500M', // Restart if memory exceeds 500MB
      env_production: {
        NODE_ENV: 'production',
        PORT: 5003,
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Advanced monitoring
      instance_var: 'INSTANCE_ID',
      min_uptime: '10s',
      max_restarts: 10,

      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
