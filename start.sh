#!/bin/sh
set -e

echo "Syncing database schema..."
cd /app/backend
npx prisma db push --accept-data-loss

echo "Seeding database..."
npx prisma db seed
cd /app

echo "Starting backend and frontend with PM2..."
pm2 start ecosystem.config.js
sleep 3
pm2 logs --lines 20 --nostream

echo "Starting Nginx..."
nginx -t
exec nginx -g 'daemon off;'
