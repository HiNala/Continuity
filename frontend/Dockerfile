# ============================================
# Clarity Frontend - Next.js 15
# ============================================
# Multi-stage build for production optimization
# Use BUILD_ENV=production for production builds

# Build argument for environment
ARG BUILD_ENV=development

# ============================================
# Base Stage - Dependencies
# ============================================
FROM node:20-alpine AS base

WORKDIR /app

# Install system dependencies required for Next.js SWC native compilation
RUN apk add --no-cache libc6-compat gcompat

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# ============================================
# Dependencies Stage
# ============================================
FROM base AS deps

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies using lockfile for deterministic builds
RUN rm -rf node_modules && npm ci

# ============================================
# Development Stage
# ============================================
FROM base AS development

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

ENV NODE_ENV=development

EXPOSE 3000

# Development: with hot-reload
CMD ["npm", "run", "dev"]

# ============================================
# Builder Stage (for production)
# ============================================
FROM base AS builder

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Build the application
ENV NODE_ENV=production
RUN npm run build

# ============================================
# Production Stage
# ============================================
FROM base AS production

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

# Production: optimized server
CMD ["node", "server.js"]

# ============================================
# Default target (development)
# ============================================
FROM ${BUILD_ENV} AS final
