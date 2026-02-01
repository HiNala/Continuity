# ============================================
# Continuity Frontend - Next.js 15
# ============================================
# Optimized for Alpine Linux with SWC support

FROM node:20-alpine

WORKDIR /app

# Install system dependencies required for Next.js SWC native compilation
RUN apk add --no-cache libc6-compat gcompat

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies using lockfile for deterministic builds
RUN rm -rf node_modules && \
    npm ci

# Copy application code
COPY . .

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

CMD ["npm", "run", "dev"]
