# Dockerfile
# Multi-stage build for XZX Obfuscator

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY web/package*.json ./web/

# Install dependencies
RUN cd web && npm install --include=dev

# Copy source code
COPY web/ ./web/

# Build the Next.js app
RUN cd web && npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy the standalone output
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./.next/static
COPY --from=builder /app/web/public ./public

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Install nginx
RUN apk add --no-cache nginx

# Create necessary directories
RUN mkdir -p /run/nginx

# Expose ports
EXPOSE 80 8080

# Create startup script
RUN echo '#!/bin/sh\n\
nginx\n\
PORT=8080 HOSTNAME=0.0.0.0 node server.js\n\
' > /start.sh && chmod +x /start.sh

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start both nginx and Next.js
CMD ["/start.sh"]
