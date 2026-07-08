# Build stage for backend
FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/ ./
RUN npx prisma generate
RUN npm run build
RUN npx tsc prisma/seed.ts --outDir prisma --esModuleInterop --skipLibCheck

# Build stage for frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Production stage
FROM node:20-alpine

# Install OpenSSL for Prisma and Nginx for reverse proxy
RUN apk add --no-cache openssl nginx

WORKDIR /app

# Install backend dependencies
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy backend build
COPY --from=backend-builder /app/dist ./backend/dist
COPY --from=backend-builder /app/node_modules/.prisma ./backend/node_modules/.prisma
COPY --from=backend-builder /app/node_modules/@prisma ./backend/node_modules/@prisma
COPY --from=backend-builder /app/prisma/seed.js ./backend/prisma/seed.js
COPY backend/prisma/schema.prisma ./backend/prisma/schema.prisma

# Copy frontend build
COPY --from=frontend-builder /app/.next/standalone ./frontend
COPY --from=frontend-builder /app/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/public ./frontend/public

# Install PM2 for process management
RUN npm install -g pm2

# Create uploads directory
RUN mkdir -p backend/uploads

# Copy nginx config
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Copy ecosystem config
COPY ecosystem.config.js ./

# Copy startup script
COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 80

CMD ["./start.sh"]
