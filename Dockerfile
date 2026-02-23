# Debug Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install curl and bash for debugging
RUN apk add --no-cache curl bash

# Copy package files
COPY web/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY web/ ./

# Build the app
RUN npm run build

EXPOSE 80

# Create a debug startup script
RUN echo '#!/bin/bash' > /start.sh && \
    echo 'echo "=== STARTUP ==="' >> /start.sh && \
    echo 'ls -la .next' >> /start.sh && \
    echo 'echo "=== ENV ==="' >> /start.sh && \
    echo 'env' >> /start.sh && \
    echo 'echo "=== RUNNING APP ==="' >> /start.sh && \
    echo 'PORT=80 HOSTNAME=0.0.0.0 npm start 2>&1 | tee /app.log' >> /start.sh && \
    echo 'EXIT_CODE=${PIPESTATUS[0]}' >> /start.sh && \
    echo 'echo "App exited with code $EXIT_CODE at $(date)" >> /app.log' >> /start.sh && \
    echo '# Keep container alive for debugging' >> /start.sh && \
    echo 'tail -f /app.log' >> /start.sh && \
    chmod +x /start.sh

# No health check to avoid premature killing
# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD curl -f http://localhost:80/ || exit 1

CMD ["/start.sh"]
