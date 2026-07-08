#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/backend
npx prisma migrate deploy
cd /app

echo "Starting backend and frontend with PM2..."
pm2 start ecosystem.config.js

echo "Starting Nginx..."
exec nginx -g 'daemon off;'
