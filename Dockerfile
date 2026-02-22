# Final Working Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files
COPY web/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY web/ ./

# Build the app
RUN npm run build

# Expose port 80 (Railway expects this)
EXPOSE 80

# Set environment variables
ENV PORT=80
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Health check - verifies app is running
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

# Start the app with proper signal handling
CMD ["sh", "-c", "PORT=80 HOSTNAME=0.0.0.0 node .next/standalone/server.js"]
