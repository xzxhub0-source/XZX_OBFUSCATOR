# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first (better layer caching)
COPY web/package*.json ./web/

# Install ALL dependencies including dev dependencies
RUN cd web && npm install --include=dev

# Copy source code
COPY web/ ./web/

# Set environment variables for build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js app
RUN cd web && npm run build

# Production stage
FROM nginx:alpine

# Copy built static files from builder
COPY --from=builder /app/web/out /usr/share/nginx/html

# Copy custom nginx config for SPA support (optional)
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
