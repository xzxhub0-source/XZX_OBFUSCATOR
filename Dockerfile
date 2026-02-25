# Dockerfile with debugging
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

# Create a health check file
RUN echo "OK" > public/health.txt

# Create a startup script with error logging
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'echo "=== STARTUP ==="' >> /start.sh && \
    echo 'date' >> /start.sh && \
    echo 'echo "Node version: $(node -v)"' >> /start.sh && \
    echo 'echo "Starting Next.js on port 8080..."' >> /start.sh && \
    echo 'node server.js 2>&1 | tee /app.log &' >> /start.sh && \
    echo 'SERVER_PID=$!' >> /start.sh && \
    echo 'echo "Server started with PID: $SERVER_PID"' >> /start.sh && \
    echo 'echo "Waiting for server to start..."' >> /start.sh && \
    echo 'sleep 3' >> /start.sh && \
    echo 'echo "Testing localhost:8080..."' >> /start.sh && \
    echo 'curl -f http://localhost:8080/health.txt' >> /start.sh && \
    echo 'if [ $? -eq 0 ]; then' >> /start.sh && \
    echo '  echo "Health check passed"' >> /start.sh && \
    echo 'else' >> /start.sh && \
    echo '  echo "Health check FAILED"' >> /start.sh && \
    echo '  cat /app.log' >> /start.sh && \
    echo '  exit 1' >> /start.sh && \
    echo 'fi' >> /start.sh && \
    echo 'echo "Server is running. Monitoring..."' >> /start.sh && \
    echo 'while true; do' >> /start.sh && \
    echo '  if ! kill -0 $SERVER_PID 2>/dev/null; then' >> /start.sh && \
    echo '    echo "Server died! Exit code: $?"' >> /start.sh && \
    echo '    cat /app.log' >> /start.sh && \
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

# Health check with longer timeout
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=5 \
  CMD curl -f http://localhost:8080/health.txt || exit 1

# Start with debugging
CMD ["/start.sh"]
