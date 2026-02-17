# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY web/package*.json ./web/

# Use npm install instead of npm ci - this ignores the lock file and installs fresh
RUN cd web && npm install

# Copy source code
COPY web/ ./web/

# Build the Next.js app (static export)
RUN cd web && npm run build

# Production stage
FROM nginx:alpine

# Copy built static files from builder
COPY --from=builder /app/web/out /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
