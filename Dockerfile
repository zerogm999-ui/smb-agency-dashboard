# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./

# Copy subdirectories
COPY server ./server
COPY frontend ./frontend

# Install dependencies for both
RUN npm install --prefix server
RUN npm install --prefix frontend

# Build frontend
RUN npm run build --prefix frontend

# Final stage
FROM node:20-alpine

WORKDIR /app

# Copy built files and server
COPY --from=builder /app/server ./server
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/package.json ./package.json

# Install only production dependencies for server
WORKDIR /app/server
RUN npm install --omit=dev

# Expose port
EXPOSE 5001

# Start the server
ENV NODE_ENV=production
CMD ["node", "server.js"]
