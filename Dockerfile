# Dockerfile
# Multi-stage build for XZX Obfuscator
# Optimized for production deployment

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY web/package*.json ./

# Install ALL dependencies (including Radix UI components)
RUN npm install

# Copy source code
COPY web/ ./

# Build the Next.js app with increased memory limit
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules

# Set proper permissions
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port 80 (since your app runs on port 80)
EXPOSE 80

# Set environment variables - FORCE PORT 80
ENV PORT=80
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

# Health check to ensure container is running properly
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:80', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "server.js"]
