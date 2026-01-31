# ============================================
# Continuity Frontend - Next.js 15
# ============================================
# Simplified for hackathon development

FROM node:20-alpine

WORKDIR /app

# Install dependencies
RUN apk add --no-cache libc6-compat

# Copy package files and install
COPY package.json package-lock.json* ./
RUN npm install

# Copy application code
COPY . .

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

CMD ["npm", "run", "dev"]
