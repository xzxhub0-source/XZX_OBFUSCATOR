# Final Production Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY web/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY web/ ./

# Build the app
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy built assets from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Create a health check file
RUN echo "OK" > public/health.txt

# Expose port 80
EXPOSE 80

# Set environment variables
ENV PORT=80
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:80/health.txt || curl -f http://localhost:80/ || exit 1

# Create a startup script to ensure everything runs
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'echo "Starting Next.js server on port 80..."' >> /start.sh && \
    echo 'ls -la .next/standalone/' >> /start.sh && \
    echo 'ls -la public/' >> /start.sh && \
    echo 'node server.js' >> /start.sh && \
    chmod +x /start.sh

# Start the app
CMD ["/start.sh"]
