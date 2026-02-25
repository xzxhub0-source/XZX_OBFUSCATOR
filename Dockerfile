# Dockerfile
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
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install curl for debugging
RUN apk add --no-cache curl

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create a debug script
RUN echo '#!/bin/sh' > /debug.sh && \
    echo 'echo "=== DEBUG INFO ==="' >> /debug.sh && \
    echo 'echo "Port: $PORT"' >> /debug.sh && \
    echo 'echo "Host: $HOSTNAME"' >> /debug.sh && \
    echo 'echo "Node version: $(node -v)"' >> /debug.sh && \
    echo 'echo "Files in current directory:"' >> /debug.sh && \
    echo 'ls -la' >> /debug.sh && \
    echo 'echo "=== STARTING APP ==="' >> /debug.sh && \
    echo 'node server.js' >> /debug.sh && \
    chmod +x /debug.sh

# Expose port 80
EXPOSE 80

# Set environment - FORCE PORT 80
ENV PORT=80
ENV HOSTNAME="0.0.0.0"

# Use debug script to start
CMD ["/debug.sh"]
