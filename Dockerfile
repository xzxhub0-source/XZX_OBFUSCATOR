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

# Verify the standalone server exists
RUN ls -la .next/standalone/ && ls -la .next/static/

# Expose port 80
EXPOSE 80

# Set environment variables
ENV PORT=80
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

# Start the standalone server
CMD ["node", ".next/standalone/server.js"]
