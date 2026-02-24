# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files from the web directory
COPY web/package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY web/ ./

# Build the app
RUN npm run build

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
