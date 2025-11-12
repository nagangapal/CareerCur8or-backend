FROM node:18-slim

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Install ALL dependencies
RUN npm install

# Copy server directory
COPY server ./server

# Set working directory to server
WORKDIR /app/server

# Expose port
EXPOSE 3001

# Set environment variable for port
ENV PORT=3001

# Start the server
CMD ["node", "index.cjs"]