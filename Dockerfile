# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY web/package*.json ./web/

# Install ALL dependencies including Radix UI
RUN cd web && npm install --include=dev && npm install @radix-ui/react-progress

# Copy source code
COPY web/ ./web/

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js app
RUN cd web && npm run build

# Production stage
FROM nginx:alpine

# Copy built static files
COPY --from=builder /app/web/out /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
