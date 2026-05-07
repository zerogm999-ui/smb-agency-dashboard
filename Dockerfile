# Use stable Node 20
FROM node:20

WORKDIR /app

# Copy package files first for caching
COPY package.json ./
COPY server/package.json ./server/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN npm install --prefix server --production
RUN npm install --prefix frontend

# Copy source code
COPY server ./server
COPY frontend ./frontend

# Build frontend
RUN npm run build --prefix frontend

# Set directory to server
WORKDIR /app/server

# Explicit environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose
EXPOSE 8080

# Run
CMD ["node", "server.js"]
