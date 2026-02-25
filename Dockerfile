# Dockerfile with startup script
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY web/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY web/ ./

# Build the app
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create a startup script that keeps the process alive
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'echo "Starting Next.js on port 8080..."' >> /start.sh && \
    echo 'node server.js &' >> /start.sh && \
    echo 'SERVER_PID=$!' >> /start.sh && \
    echo 'echo "Server started with PID: $SERVER_PID"' >> /start.sh && \
    echo 'while true; do' >> /start.sh && \
    echo '  if ! kill -0 $SERVER_PID 2>/dev/null; then' >> /start.sh && \
    echo '    echo "Server died, exiting..."' >> /start.sh && \
    echo '    exit 1' >> /start.sh && \
    echo '  fi' >> /start.sh && \
    echo '  sleep 5' >> /start.sh && \
    echo 'done' >> /start.sh && \
    chmod +x /start.sh

# Expose port 8080
EXPOSE 8080

# Set environment
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/ || exit 1

# Start with the wrapper
CMD ["/start.sh"]
