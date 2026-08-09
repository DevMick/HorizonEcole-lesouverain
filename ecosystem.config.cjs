module.exports = {
  apps: [
    {
      name: 'lesouverain-api',
      script: './apps/api/dist/index.js',
      cwd: '/var/www/lesouverain',
      instances: 1,
      exec_mode: 'fork',

      env_production: {
        NODE_ENV: 'production',
        PORT: 4002,
      },

      // Logs
      error_file: '/var/log/lesouverain/error.log',
      out_file: '/var/log/lesouverain/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Restart policy
      restart_delay: 5000,
      max_memory_restart: '512M',
      watch: false,
    },
  ],
};
