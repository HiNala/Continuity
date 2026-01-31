"""
Continuity - Settings & API Test Routes
Provides endpoints to test API key connectivity for all third-party services.
"""

import asyncio
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/api/settings", tags=["Settings"])


# ============================================
# Response Models
# ============================================
class APITestResult(BaseModel):
    """Result of an API key test."""
    service: str
    success: bool
    message: str
    timestamp: str
    details: Optional[dict] = None


class AllAPITestsResult(BaseModel):
    """Results of all API key tests."""
    weave: APITestResult
    gemini: APITestResult
    browserbase: APITestResult
    database: APITestResult


class SettingsStatusResponse(BaseModel):
    """Current settings status (keys configured, not the actual keys)."""
    weave_configured: bool
    gemini_configured: bool
    browserbase_configured: bool
    database_configured: bool
    environment: str


# ============================================
# Test Functions
# ============================================
async def test_weave_api() -> APITestResult:
    """Test W&B/Weave API key by making a simple API call."""
    service = "weave"
    timestamp = datetime.now(timezone.utc).isoformat()
    
    if not settings.wandb_api_key:
        return APITestResult(
            service=service,
            success=False,
            message="WANDB_API_KEY not configured",
            timestamp=timestamp,
        )
    
    try:
        # Test by calling W&B API to get user info
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.wandb.ai/graphql",
                headers={
                    "Authorization": f"Basic {settings.wandb_api_key}",
                    "Content-Type": "application/json",
                },
                json={"query": "{ viewer { username } }"},
                timeout=10.0,
            )
            
            if response.status_code == 200:
                data = response.json()
                username = data.get("data", {}).get("viewer", {}).get("username", "unknown")
                return APITestResult(
                    service=service,
                    success=True,
                    message=f"Connected as: {username}",
                    timestamp=timestamp,
                    details={"username": username},
                )
            else:
                return APITestResult(
                    service=service,
                    success=False,
                    message=f"API returned status {response.status_code}",
                    timestamp=timestamp,
                )
    except Exception as e:
        return APITestResult(
            service=service,
            success=False,
            message=f"Connection error: {str(e)}",
            timestamp=timestamp,
        )


async def test_gemini_api() -> APITestResult:
    """Test Google Gemini API key by listing models."""
    service = "gemini"
    timestamp = datetime.now(timezone.utc).isoformat()
    
    if not settings.gemini_api_key:
        return APITestResult(
            service=service,
            success=False,
            message="GEMINI_API_KEY not configured",
            timestamp=timestamp,
        )
    
    try:
        # Test by listing available models
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://generativelanguage.googleapis.com/v1beta/models?key={settings.gemini_api_key}",
                timeout=10.0,
            )
            
            if response.status_code == 200:
                data = response.json()
                models = data.get("models", [])
                model_names = [m.get("name", "").split("/")[-1] for m in models[:5]]
                return APITestResult(
                    service=service,
                    success=True,
                    message=f"Connected! {len(models)} models available",
                    timestamp=timestamp,
                    details={"model_count": len(models), "sample_models": model_names},
                )
            elif response.status_code == 400:
                return APITestResult(
                    service=service,
                    success=False,
                    message="Invalid API key format",
                    timestamp=timestamp,
                )
            elif response.status_code == 403:
                return APITestResult(
                    service=service,
                    success=False,
                    message="API key unauthorized or expired",
                    timestamp=timestamp,
                )
            else:
                return APITestResult(
                    service=service,
                    success=False,
                    message=f"API returned status {response.status_code}",
                    timestamp=timestamp,
                )
    except Exception as e:
        return APITestResult(
            service=service,
            success=False,
            message=f"Connection error: {str(e)}",
            timestamp=timestamp,
        )


async def test_browserbase_api() -> APITestResult:
    """Test Browserbase API key by getting account info."""
    service = "browserbase"
    timestamp = datetime.now(timezone.utc).isoformat()
    
    if not settings.browserbase_api_key:
        return APITestResult(
            service=service,
            success=False,
            message="BROWSERBASE_API_KEY not configured",
            timestamp=timestamp,
        )
    
    try:
        # Test by listing sessions (empty is fine, just tests auth)
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.browserbase.com/v1/sessions",
                headers={
                    "x-bb-api-key": settings.browserbase_api_key,
                },
                timeout=10.0,
            )
            
            if response.status_code == 200:
                return APITestResult(
                    service=service,
                    success=True,
                    message="Connected to Browserbase",
                    timestamp=timestamp,
                    details={"project_id": settings.browserbase_project_id},
                )
            elif response.status_code == 401:
                return APITestResult(
                    service=service,
                    success=False,
                    message="Invalid API key",
                    timestamp=timestamp,
                )
            else:
                return APITestResult(
                    service=service,
                    success=False,
                    message=f"API returned status {response.status_code}",
                    timestamp=timestamp,
                )
    except Exception as e:
        return APITestResult(
            service=service,
            success=False,
            message=f"Connection error: {str(e)}",
            timestamp=timestamp,
        )


async def test_database() -> APITestResult:
    """Test database connectivity."""
    service = "database"
    timestamp = datetime.now(timezone.utc).isoformat()
    
    try:
        from app.database import get_db_status
        status = await get_db_status()
        return APITestResult(
            service=service,
            success=True,
            message="Database connected",
            timestamp=timestamp,
            details={"message": status.get("message", "")},
        )
    except Exception as e:
        return APITestResult(
            service=service,
            success=False,
            message=f"Database error: {str(e)}",
            timestamp=timestamp,
        )


# ============================================
# Endpoints
# ============================================
@router.get("/status", response_model=SettingsStatusResponse)
async def get_settings_status():
    """
    Get current settings status (whether keys are configured).
    Does NOT return actual key values.
    """
    return SettingsStatusResponse(
        weave_configured=bool(settings.wandb_api_key),
        gemini_configured=bool(settings.gemini_api_key),
        browserbase_configured=bool(settings.browserbase_api_key),
        database_configured=bool(settings.database_url),
        environment=settings.environment,
    )


@router.post("/test/weave", response_model=APITestResult)
async def test_weave_endpoint():
    """Test W&B/Weave API connectivity."""
    return await test_weave_api()


@router.post("/test/gemini", response_model=APITestResult)
async def test_gemini_endpoint():
    """Test Google Gemini API connectivity."""
    return await test_gemini_api()


@router.post("/test/browserbase", response_model=APITestResult)
async def test_browserbase_endpoint():
    """Test Browserbase API connectivity."""
    return await test_browserbase_api()


@router.post("/test/database", response_model=APITestResult)
async def test_database_endpoint():
    """Test database connectivity."""
    return await test_database()


@router.post("/test/all", response_model=AllAPITestsResult)
async def test_all_apis():
    """
    Test all API keys at once.
    Returns results for each service.
    """
    # Run all tests in parallel for speed
    weave_result, gemini_result, browserbase_result, database_result = await asyncio.gather(
        test_weave_api(),
        test_gemini_api(),
        test_browserbase_api(),
        test_database(),
    )
    
    return AllAPITestsResult(
        weave=weave_result,
        gemini=gemini_result,
        browserbase=browserbase_result,
        database=database_result,
    )
