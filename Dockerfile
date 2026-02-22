# Final Working Dockerfile
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

# Build the app
RUN npm run build

# For standalone output, we need to use the standalone server
# The build creates .next/standalone with all necessary files

# Expose port 8080 (since your app runs on 8080)
EXPOSE 8080

# Set environment variables
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

# Create a healthcheck endpoint
RUN mkdir -p public && echo "OK" > public/health.txt

# Health check - checks if the app is responding
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/ || exit 1

# Use the standalone server directly (NOT npm start)
# This is the correct way to run a standalone build
CMD ["node", ".next/standalone/server.js"]
