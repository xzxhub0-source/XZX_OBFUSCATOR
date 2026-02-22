# Simple Dockerfile - Just Next.js with standalone output
FROM node:18-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files
COPY web/package*.json ./

# Install dependencies
RUN npm install --include=dev

# Copy source code
COPY web/ ./

# Build the app (this generates the standalone output)
RUN npm run build

# For standalone output, we need to copy the standalone folder to the right place
# The build already created it at .next/standalone

# Expose port 80
EXPOSE 80

# Set environment variables
ENV PORT=80
ENV HOSTNAME=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Start the standalone server directly (NOT npm start)
CMD ["node", ".next/standalone/server.js"]
