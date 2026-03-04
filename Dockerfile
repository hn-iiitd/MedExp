# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN cd server && npm ci --production
RUN cd client && npm ci

# Copy source code
COPY client/ ./client/
COPY server/ ./server/

# Build frontend
RUN cd client && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy server with dependencies
COPY --from=builder /app/server ./server

# Copy built frontend
COPY --from=builder /app/client/dist ./client/dist

# Create data directory for SQLite (persistent volume mount point)
RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "server/index.js"]
