# Dockerfile
# Multi-stage build for XZX Obfuscator

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY web/package*.json ./web/

# Install dependencies - use npm install instead of npm ci
RUN cd web && npm install --include=dev

# Copy source code
COPY web/ ./web/

# Build the Next.js app
RUN cd web && npm run build

# Production stage
FROM nginx:alpine

# Copy the built application from builder
COPY --from=builder /app/web/.next/standalone /app
COPY --from=builder /app/web/.next/static /app/.next/static
COPY --from=builder /app/web/public /app/public

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
