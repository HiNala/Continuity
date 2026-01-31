"""
Continuity - Database Module
PostgreSQL connection and operations using SQLAlchemy.
"""

from datetime import datetime, timezone
from typing import Optional, AsyncGenerator

from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import (
    Base, SystemStatus, Project, Requirements, Iteration, Constraint, Policy, 
    ProjectAnalysis, EvaluationDetail, PolicyChange, OrchestrationLog
)

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
]
