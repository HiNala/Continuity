"""
Clarity - Database Module
PostgreSQL connection and operations using SQLAlchemy.

Migration Strategy:
- Development: init.sql creates full schema, SQLAlchemy sync on startup
- Production: Use Alembic for proper migrations (not yet implemented)
"""

from datetime import datetime, timezone
from typing import AsyncGenerator, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.config import settings
from app.models import (
    Base, SystemStatus, Project, Requirements, Iteration, Constraint, Policy, 
    ProjectAnalysis, EvaluationDetail, PolicyChange, OrchestrationLog
)

# Current schema version - update when schema changes
SCHEMA_VERSION = "1.0.0"

# ============================================
# Database Configuration
# ============================================

# Convert postgres:// to postgresql:// and add async driver
DATABASE_URL = settings.database_url
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Async URL for asyncpg
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# Sync URL for migrations and simple operations
SYNC_DATABASE_URL = DATABASE_URL

# Create engines
async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=settings.debug,
    pool_pre_ping=True,
)

sync_engine = create_engine(
    SYNC_DATABASE_URL,
    echo=settings.debug,
    pool_pre_ping=True,
)

# Session factories
AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ============================================
# Database Operations
# ============================================
async def init_db():
    """
    Initialize database tables.
    Creates all tables if they don't exist.
    """
    # Use sync engine for table creation (simpler during startup)
    Base.metadata.create_all(bind=sync_engine)


async def get_db_status() -> dict:
    """
    Test database connectivity by writing and reading a record.
    Returns status information.
    """
    async with AsyncSessionLocal() as session:
        async with session.begin():
            # Create a test record
            test_message = f"Connection test at {datetime.now(timezone.utc).isoformat()}"
            status = SystemStatus(message=test_message)
            session.add(status)
            await session.flush()
            
            # Read it back
            record_id = status.id
            
        # Query the record
        result = await session.execute(
            text("SELECT message, created_at FROM system_status WHERE id = :id"),
            {"id": record_id}
        )
        row = result.fetchone()
        
        return {
            "message": f"Database connected. Test record #{record_id}: {row[0] if row else 'N/A'}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting async database sessions.
    Use with FastAPI's Depends().
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def check_schema_version() -> Optional[str]:
    """
    Check the current schema version from the database.
    Returns the version string or None if not found.
    """
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text("SELECT message FROM system_status WHERE id = 1")
            )
            row = result.fetchone()
            if row and row[0]:
                # Extract version from message like "Schema v1.0.0 - Initial schema"
                message = row[0]
                if "Schema v" in message:
                    version = message.split("Schema v")[1].split(" ")[0]
                    return version
            return None
    except Exception as e:
        print(f"Warning: Could not check schema version: {e}")
        return None


async def verify_database_ready() -> dict:
    """
    Verify database is ready and schema is compatible.
    Returns status dict with version info.
    """
    db_version = await check_schema_version()
    
    status = {
        "database_connected": True,
        "schema_version": db_version,
        "expected_version": SCHEMA_VERSION,
        "compatible": db_version == SCHEMA_VERSION if db_version else True,  # Assume compatible if no version
    }
    
    if not status["compatible"]:
        print(f"Warning: Schema version mismatch. DB: {db_version}, Expected: {SCHEMA_VERSION}")
    
    return status


# ============================================
# Export models for convenience
# ============================================
__all__ = [
    "Base",
    "SystemStatus", 
    "Project",
    "Requirements",
    "Iteration",
    "Constraint",
    "Policy",
    "ProjectAnalysis",
    "EvaluationDetail",
    "PolicyChange",
    "OrchestrationLog",
    "async_engine",
    "sync_engine",
    "AsyncSessionLocal",
    "init_db",
    "get_db_status",
    "get_async_session",
    "check_schema_version",
    "verify_database_ready",
    "SCHEMA_VERSION",
]
