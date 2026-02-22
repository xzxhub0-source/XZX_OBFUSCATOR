# Dockerfile - Final Working Version
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

# Expose port 80
EXPOSE 80

# Set environment variables (these will be available)
ENV NODE_ENV=production

# Health check - checks port 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

# Start the app on port 80 by explicitly setting it in the command
CMD ["sh", "-c", "PORT=80 HOSTNAME=0.0.0.0 npm start"]
