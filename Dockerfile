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

# Install nginx and curl
RUN apk add --no-cache nginx curl

# Copy the standalone output
COPY --from=builder /app/web/.next/standalone ./
# FIXED: Changed --from-builder to --from=builder
COPY --from=builder /app/web/.next/static ./.next/static
COPY --from=builder /app/web/public ./public

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create necessary directories
RUN mkdir -p /run/nginx

# Expose ports (only port 80 is exposed to the world)
EXPOSE 80

# Create startup script
RUN echo '#!/bin/sh\n\
# Start Next.js on port 3000 (internal only)\n\
PORT=3000 HOSTNAME=127.0.0.1 node server.js &\n\
# Start nginx on port 80\n\
nginx -g "daemon off;"\n\
' > /start.sh && chmod +x /start.sh

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Start both services
CMD ["/start.sh"]
