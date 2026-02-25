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

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Expose port 8080
EXPOSE 8080

# Set environment - FORCE PORT 8080
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Create a simple health check file
RUN echo "OK" > public/health.txt

# Health check - this keeps the container alive
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health.txt || curl -f http://localhost:8080/ || exit 1

# Start the application with a wrapper that keeps it alive
CMD ["node", "server.js"]
