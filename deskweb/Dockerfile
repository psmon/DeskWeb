# DeskWeb - Windows XP Style Desktop Application
# Dockerfile for building and running the application

# Stage 1: Build
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY Manifest.json ./
COPY compile.json ./

# Install qooxdoo compiler globally
RUN npm install -g @qooxdoo/compiler

# Install project dependencies (if any)RUN npm install || true

# Copy source code
COPY source ./source

# Build the application for production
RUN qx compile --target=build

# Stage 2: Production
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/compiled/build /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
