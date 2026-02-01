# ============================================
# Clarity Backend - Python FastAPI
# ============================================
# Multi-stage build for production efficiency
# Use BUILD_ENV=production for production builds

# Build argument for environment
ARG BUILD_ENV=development

# ============================================
# Base Stage - Common dependencies
# ============================================
FROM python:3.12-slim AS base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install minimal system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ============================================
# Development Stage
# ============================================
FROM base AS development

# Copy application code
COPY . .

# Create directory for generated images
RUN mkdir -p /app/generated_images

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Development: with hot-reload
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ============================================
# Production Stage
# ============================================
FROM base AS production

# Create non-root user for security
RUN groupadd --gid 1000 clarity \
    && useradd --uid 1000 --gid clarity --shell /bin/bash --create-home clarity

# Copy application code
COPY --chown=clarity:clarity . .

# Create directory for generated images with proper permissions
RUN mkdir -p /app/generated_images && chown -R clarity:clarity /app/generated_images

# Switch to non-root user
USER clarity

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production: no hot-reload, multiple workers
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]

# ============================================
# Default target (development)
# ============================================
FROM ${BUILD_ENV} AS final
