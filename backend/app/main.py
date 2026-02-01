"""
Clarity - Main FastAPI Application
Self-Improving Agent System for Design Visualization
WeaveHacks 3 - January 31-February 1, 2026
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone

import weave
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.database import init_db, get_db_status
from app.weave_ops import test_weave_operation
from app.redis_service import redis_service
from app.routes.projects import router as projects_router
from app.routes.settings import router as settings_router
from app.routes.inspiration import router as inspiration_router


# ============================================
# Lifespan Management
# ============================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage application startup and shutdown.
    Initialize Weave, database connections, Redis, etc.
    """
    # Startup
    print("🚀 Starting Clarity Backend...")
    
    # Initialize Weave for observability
    if settings.wandb_api_key:
        # Weave project name format: "entity/project" or just "project"
        project_name = settings.weave_project_name
        if settings.wandb_entity and "/" not in project_name:
            project_name = f"{settings.wandb_entity}/{project_name}"
        
        weave.init(project_name)
        print(f"✅ Weave initialized: {project_name}")
    else:
        print("⚠️  WANDB_API_KEY not set - Weave tracing disabled")
    
    # Initialize database
    await init_db()
    print("✅ Database initialized")
    
    # Initialize Redis for caching
    try:
        await redis_service.connect()
        if await redis_service.health_check():
            print("✅ Redis connected")
        else:
            print("⚠️  Redis connection failed - caching disabled")
    except Exception as e:
        print(f"⚠️  Redis initialization error: {e}")
    
    yield
    
    # Shutdown
    print("👋 Shutting down Clarity Backend...")
    await redis_service.disconnect()


# ============================================
# FastAPI Application
# ============================================
app = FastAPI(
    title="Clarity API",
    description="""
    ## Self-Improving Agent System for Design Visualization
    
    Clarity transforms raw photographs of unfinished or existing spaces 
    into realistic, professionally staged renovation visualizations using 
    a multi-agent architecture with Weave observability.
    
    ### Features
    - **Spatial Analysis**: Extracts physical constraints from input images
    - **Phased Generation**: Iterative improvement through cleanup, structural, fixture, and style phases
    - **Self-Improvement**: Quality control agent modifies process based on Weave traces
    - **Multiple Styles**: Generate various design options while respecting constraints
    
    ### Built for WeaveHacks 3 - Self-Improving Agents Hackathon
    """,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Ensure static file directories exist before mounting
os.makedirs("generated_images", exist_ok=True)
os.makedirs("uploaded_images", exist_ok=True)

# Serve generated images from the local output directory
app.mount("/generated_images", StaticFiles(directory="generated_images"), name="generated_images")
# Serve uploaded images for processing
app.mount("/uploaded_images", StaticFiles(directory="uploaded_images"), name="uploaded_images")


# ============================================
# Security Headers Middleware
# ============================================
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""
    
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Cache control for API responses (not static files)
        if not request.url.path.startswith("/generated_images"):
            response.headers["Cache-Control"] = "no-store, max-age=0"
        
        return response

app.add_middleware(SecurityHeadersMiddleware)


# ============================================
# CORS Configuration
# ============================================
# Define allowed origins explicitly
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
# Add frontend URL if it's a valid URL and not localhost (to avoid duplicates)
if settings.frontend_url and settings.frontend_url not in ALLOWED_ORIGINS:
    ALLOWED_ORIGINS.append(settings.frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    # Restrict to actual methods used
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    # Restrict to common headers
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-Requested-With",
        "X-Request-ID",
    ],
    # Allow frontend to read these response headers
    expose_headers=["X-Request-ID", "Content-Disposition"],
)


# ============================================
# Global Exception Handlers
# ============================================
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import traceback
import logging

logger = logging.getLogger(__name__)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions with consistent JSON responses."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail if isinstance(exc.detail, str) else "HTTP Error",
            "detail": exc.detail if isinstance(exc.detail, str) else str(exc.detail),
            "status_code": exc.status_code,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with detailed messages."""
    errors = []
    for error in exc.errors():
        loc = " -> ".join(str(x) for x in error["loc"])
        errors.append(f"{loc}: {error['msg']}")
    
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation Error",
            "details": errors,
            "status_code": 422,
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions gracefully."""
    # Log the full traceback for debugging
    logger.error(f"Unexpected error: {exc}\n{traceback.format_exc()}")
    
    # Return a generic error message in production
    if settings.debug:
        detail = str(exc)
    else:
        detail = "An unexpected error occurred. Please try again later."
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": detail,
            "status_code": 500,
        },
    )


# ============================================
# Response Models
# ============================================
class HealthResponse(BaseModel):
    """Health check response model."""
    status: str
    timestamp: str
    version: str
    environment: str


class DatabaseTestResponse(BaseModel):
    """Database test response model."""
    status: str
    message: str
    timestamp: str


class WeaveTestRequest(BaseModel):
    """Weave test request model."""
    input_text: str = "Hello, Continuity!"


class WeaveTestResponse(BaseModel):
    """Weave test response model."""
    status: str
    input_text: str
    output_text: str
    traced: bool
    timestamp: str


# ============================================
# Health & Status Endpoints
# ============================================
@app.get("/", tags=["Status"])
async def root():
    """Root endpoint with API information."""
    return {
        "name": "Clarity API",
        "description": "Self-Improving Agent System for Design Visualization",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", response_model=HealthResponse, tags=["Status"])
async def health_check():
    """
    Health check endpoint.
    Returns the current status of the API.
    """
    return HealthResponse(
        status="ok",
        timestamp=datetime.now(timezone.utc).isoformat(),
        version="0.1.0",
        environment=settings.environment,
    )


class DetailedHealthResponse(BaseModel):
    """Detailed health check response model."""
    status: str
    timestamp: str
    version: str
    environment: str
    services: dict


@app.get("/health/detailed", response_model=DetailedHealthResponse, tags=["Status"])
async def detailed_health_check():
    """
    Detailed health check endpoint.
    Returns the status of all services including database and Redis.
    """
    services = {
        "api": {"status": "ok"},
        "database": {"status": "unknown"},
        "redis": {"status": "unknown"},
        "weave": {"status": "disabled" if not settings.wandb_api_key else "enabled"},
    }
    
    overall_status = "ok"
    
    # Check database
    try:
        db_status = await get_db_status()
        services["database"] = {
            "status": "ok",
            "message": db_status.get("message", "Connected"),
        }
    except Exception as e:
        services["database"] = {
            "status": "error",
            "message": str(e),
        }
        overall_status = "degraded"
    
    # Check Redis
    try:
        redis_ok = await redis_service.health_check()
        services["redis"] = {
            "status": "ok" if redis_ok else "error",
        }
        if not redis_ok:
            overall_status = "degraded"
    except Exception as e:
        services["redis"] = {
            "status": "error",
            "message": str(e),
        }
        overall_status = "degraded"
    
    return DetailedHealthResponse(
        status=overall_status,
        timestamp=datetime.now(timezone.utc).isoformat(),
        version="0.1.0",
        environment=settings.environment,
        services=services,
    )


# ============================================
# Database Test Endpoint
# ============================================
@app.get("/db-test", response_model=DatabaseTestResponse, tags=["Status"])
async def database_test():
    """
    Test database connectivity.
    Writes and reads a test record to verify the connection.
    """
    try:
        status = await get_db_status()
        return DatabaseTestResponse(
            status="ok",
            message=status["message"],
            timestamp=status["timestamp"],
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database connection failed: {str(e)}"
        )


# ============================================
# Weave Test Endpoint
# ============================================
@app.post("/weave-test", response_model=WeaveTestResponse, tags=["Status"])
async def weave_test(request: WeaveTestRequest):
    """
    Test Weave observability integration.
    Calls a traced operation that should appear in the Weave UI.
    """
    try:
        result = test_weave_operation(request.input_text)
        return WeaveTestResponse(
            status="ok",
            input_text=request.input_text,
            output_text=result,
            traced=bool(settings.wandb_api_key),
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Weave test failed: {str(e)}"
        )


# ============================================
# API Routes
# ============================================
# Include the projects router (Mission 02)
app.include_router(projects_router)

# Include the settings router (API key testing)
app.include_router(settings_router)

# Include the inspiration router (Browserbase integration)
app.include_router(inspiration_router)
