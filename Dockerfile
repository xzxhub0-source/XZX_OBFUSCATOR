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
FROM node:18-alpine AS runner

WORKDIR /app

# Install curl for healthcheck (optional)
RUN apk add --no-cache curl

# Copy the standalone output - NOTE: The path is different!
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./.next/static
COPY --from=builder /app/web/public ./public

# Expose the port Next.js runs on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the Next.js app
CMD ["node", "server.js"]
