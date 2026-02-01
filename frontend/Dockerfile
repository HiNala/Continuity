# ============================================
# Continuity Frontend - Next.js 15
# ============================================
# Optimized for Alpine Linux with SWC support

FROM node:20-alpine

WORKDIR /app

# Install system dependencies required for Next.js SWC native compilation
RUN apk add --no-cache libc6-compat gcompat

# Copy package files
COPY package.json ./

# Install dependencies - use npm install to get correct platform binaries
# The --force flag ensures SWC binaries are installed for the correct platform
RUN npm install --force --legacy-peer-deps

# Copy application code
COPY . .

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

CMD ["npm", "run", "dev"]
