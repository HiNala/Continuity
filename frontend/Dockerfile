# ============================================
# Continuity Frontend - Next.js 15
# ============================================
# Simplified for hackathon development

FROM node:20-alpine

WORKDIR /app

# Install dependencies required for Next.js SWC
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json package-lock.json* ./

# Clean install using lockfile for deterministic builds
RUN rm -rf node_modules && \
    npm ci

# Copy application code
COPY . .

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

CMD ["npm", "run", "dev"]
