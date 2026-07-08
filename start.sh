#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/backend
npx prisma migrate deploy
cd /app

echo "Starting application..."
exec pm2-runtime start ecosystem.config.js
