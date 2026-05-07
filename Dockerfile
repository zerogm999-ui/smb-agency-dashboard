FROM node:20-alpine

WORKDIR /app

# Copy all files
COPY . .

# Install dependencies for both
RUN npm install --prefix server
RUN npm install --prefix frontend

# Build frontend
RUN npm run build --prefix frontend

# Use server directory as main
WORKDIR /app/server

# Standard production environment
ENV NODE_ENV=production
ENV PORT=5001

# Expose the default port
EXPOSE 5001

# Start command
CMD ["node", "server.js"]
