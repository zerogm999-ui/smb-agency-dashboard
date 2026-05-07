# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM node:18-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Create reports directory
RUN mkdir -p reports && chown nodeuser:nodejs reports

USER nodeuser

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "server.js"]
