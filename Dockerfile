# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY web/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY web/ ./

# Build the app with increased memory limit
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Expose port 80
EXPOSE 80

# Set environment variables
ENV PORT=80
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:80', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["npm", "start"]
