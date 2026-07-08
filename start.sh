#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/backend
npx prisma migrate deploy
cd /app

echo "Starting backend and frontend with PM2..."
pm2 start ecosystem.config.js
pm2 logs --lines 10 --nostream

echo "Starting Nginx..."
nginx -t
exec nginx -g 'daemon off;'
