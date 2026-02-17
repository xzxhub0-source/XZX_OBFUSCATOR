# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy web package files
COPY web/package*.json ./web/

# Install dependencies
RUN cd web && npm ci

# Copy source code
COPY web/ ./web/

# Build the Next.js app (static export)
RUN cd web && npm run build

# Production stage
FROM nginx:alpine

# Copy built static files from builder
COPY --from=builder /app/web/out /usr/share/nginx/html

# Copy custom nginx config if needed (optional)
# COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
