# Multi-stage Dockerfile for EcoSquad
# Supports both development and production builds

# =============================================================================
# Base Stage - Common dependencies
# =============================================================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# =============================================================================
# Dependencies Stage - Install all dependencies
# =============================================================================
FROM base AS dependencies

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY infra/package*.json ./infra/

# Install dependencies
RUN npm ci --only=production=false
RUN cd backend && npm ci --only=production=false
RUN cd infra && npm ci --only=production=false

# =============================================================================
# Build Stage - Build the application
# =============================================================================
FROM dependencies AS builder

COPY . .

# Build backend
RUN cd backend && npm run build

# Build infrastructure
RUN cd infra && npm run build

# Build frontend (requires env vars)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN npm run build

# =============================================================================
# Production Stage - Minimal runtime image
# =============================================================================
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/backend/dist ./backend/dist
COPY --from=builder --chown=nextjs:nodejs /app/infra/dist ./infra/dist

# Copy package files for runtime dependencies
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nextjs:nodejs /app/backend/package*.json ./backend/

# Install only production dependencies
RUN npm ci --only=production && cd backend && npm ci --only=production

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application (static server)
CMD ["npx", "serve", "dist", "-l", "3000"]

# =============================================================================
# Development Stage - Full dev environment
# =============================================================================
FROM dependencies AS development

WORKDIR /app
COPY . .

EXPOSE 3000

ENV NODE_ENV=development
ENV PORT=3000

CMD ["npm", "run", "dev"]
