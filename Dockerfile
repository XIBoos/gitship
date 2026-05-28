# GitShip - Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the project
RUN npm run build

# Production stage
FROM node:18-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    git \
    rsync \
    curl \
    openssh-client \
    bash

WORKDIR /app

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Create necessary directories
RUN mkdir -p /cache/repos /cache/deps /cache/work /output /config

# Set permissions
RUN chmod +x /app/dist/index.js

# Default entrypoint
ENTRYPOINT ["node", "/app/dist/index.js"]
CMD ["--once"]
