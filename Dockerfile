# Final Dockerfile - Port 80
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

# Expose port 80 (since Railway expects this)
EXPOSE 80

# Set environment variables - Force port 80
ENV PORT=80
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

# Simple health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

# Start the app
CMD ["npm", "start"]
