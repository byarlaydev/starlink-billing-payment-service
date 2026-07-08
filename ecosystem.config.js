module.exports = {
  apps: [
    {
      name: 'backend',
      script: './backend/dist/main.js',
      cwd: '/app/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
    {
      name: 'frontend',
      script: './frontend/standalone/server.js',
      cwd: '/app/frontend/standalone',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
    },
  ],
};
