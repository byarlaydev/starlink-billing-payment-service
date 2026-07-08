# Build stage for backend
FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# Build stage for frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install backend dependencies
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy backend build
COPY --from=backend-builder /app/dist ./backend/dist
COPY --from=backend-builder /app/node_modules/.prisma ./backend/node_modules/.prisma
COPY --from=backend-builder /app/node_modules/@prisma ./backend/node_modules/@prisma
COPY backend/prisma ./backend/prisma

# Copy frontend build
COPY --from=frontend-builder /app/.next/standalone ./frontend/standalone
COPY --from=frontend-builder /app/.next/static ./frontend/standalone/.next/static
COPY --from=frontend-builder /app/public ./frontend/standalone/public

# Install PM2 for process management
RUN npm install -g pm2

# Create uploads directory
RUN mkdir -p backend/uploads

# Copy ecosystem config
COPY ecosystem.config.js ./

EXPOSE 3000 3001

CMD ["pm2-runtime", "start", "ecosystem.config.js"]
