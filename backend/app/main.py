"""
Continuity - Main FastAPI Application
Self-Improving Agent System for Design Visualization
WeaveHacks 3 - January 31-February 1, 2026
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone

import weave
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

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
    print("🚀 Starting Continuity Backend...")
    
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
    print("👋 Shutting down Continuity Backend...")
    await redis_service.disconnect()


# ============================================
# FastAPI Application
# ============================================
app = FastAPI(
    title="Continuity API",
    description="""
    ## Self-Improving Agent System for Design Visualization
    
    Continuity transforms raw photographs of unfinished or existing spaces 
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

# Serve generated images from the local output directory
app.mount("/generated_images", StaticFiles(directory="generated_images"), name="generated_images")


# ============================================
# CORS Configuration
# ============================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        settings.frontend_url,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
        "name": "Continuity API",
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
