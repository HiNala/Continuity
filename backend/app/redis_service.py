"""
Continuity - Redis Service
Provides caching and session management using Redis.

Redis is used for:
1. Caching spatial analysis results (expensive Gemini Vision API calls)
2. Caching policy configurations (quick retrieval during generation)
3. Rate limiting API calls
4. Session/progress tracking for long-running orchestration
"""

import json
import hashlib
from typing import Optional, Any, Dict

import redis.asyncio as redis
from app.config import settings


class RedisService:
    """
    Redis service for caching and session management.
    
    Key Use Cases:
    - Cache expensive AI analysis results
    - Store orchestration session state
    - Track generation progress across requests
    - Rate limit external API calls
    """
    
    def __init__(self):
        self._client: Optional[redis.Redis] = None
        
    async def connect(self) -> None:
        """Initialize Redis connection."""
        if self._client is None:
            self._client = redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
    
    async def disconnect(self) -> None:
        """Close Redis connection."""
        if self._client:
            await self._client.close()
            self._client = None
    
    @property
    def client(self) -> redis.Redis:
        """Get Redis client, raising if not connected."""
        if self._client is None:
            raise RuntimeError("Redis not connected. Call connect() first.")
        return self._client
    
    # ==========================================
    # Spatial Analysis Cache
    # ==========================================
    async def cache_spatial_analysis(
        self, 
        project_id: str, 
        image_hash: str, 
        analysis: Dict[str, Any],
        ttl: int = 3600  # 1 hour default
    ) -> None:
        """
        Cache spatial analysis results to avoid re-analyzing the same image.
        
        Args:
            project_id: Project identifier
            image_hash: Hash of the image content
            analysis: Analysis results from Gemini Vision
            ttl: Time to live in seconds
        """
        key = f"spatial_analysis:{project_id}:{image_hash}"
        await self.client.setex(key, ttl, json.dumps(analysis))
    
    async def get_cached_spatial_analysis(
        self, 
        project_id: str, 
        image_hash: str
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached spatial analysis if available.
        
        Returns:
            Cached analysis dict or None if not found/expired
        """
        key = f"spatial_analysis:{project_id}:{image_hash}"
        data = await self.client.get(key)
        return json.loads(data) if data else None
    
    # ==========================================
    # Policy Cache
    # ==========================================
    async def cache_policy(
        self, 
        project_id: str, 
        policy: Dict[str, Any],
        ttl: int = 1800  # 30 minutes
    ) -> None:
        """Cache active policy for quick retrieval during generation."""
        key = f"policy:{project_id}"
        await self.client.setex(key, ttl, json.dumps(policy))
    
    async def get_cached_policy(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get cached policy configuration."""
        key = f"policy:{project_id}"
        data = await self.client.get(key)
        return json.loads(data) if data else None
    
    async def invalidate_policy_cache(self, project_id: str) -> None:
        """Invalidate policy cache when policy is updated."""
        key = f"policy:{project_id}"
        await self.client.delete(key)
    
    # ==========================================
    # Orchestration Progress Tracking
    # ==========================================
    async def set_orchestration_progress(
        self, 
        project_id: str, 
        progress: Dict[str, Any],
        ttl: int = 7200  # 2 hours
    ) -> None:
        """
        Store orchestration progress for real-time status updates.
        
        This allows the frontend to poll for progress without
        hitting the database on every request.
        """
        key = f"orchestration_progress:{project_id}"
        await self.client.setex(key, ttl, json.dumps(progress))
    
    async def get_orchestration_progress(
        self, 
        project_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get current orchestration progress."""
        key = f"orchestration_progress:{project_id}"
        data = await self.client.get(key)
        return json.loads(data) if data else None
    
    async def update_orchestration_phase(
        self, 
        project_id: str, 
        phase: str, 
        status: str,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Update just the current phase in progress tracking."""
        progress = await self.get_orchestration_progress(project_id) or {}
        progress["current_phase"] = phase
        progress["phase_status"] = status
        if details:
            progress["phase_details"] = details
        await self.set_orchestration_progress(project_id, progress)
    
    # ==========================================
    # Rate Limiting
    # ==========================================
    async def check_rate_limit(
        self, 
        key: str, 
        max_requests: int, 
        window_seconds: int
    ) -> bool:
        """
        Check if an operation is within rate limits.
        
        Returns:
            True if within limits, False if rate limited
        """
        rate_key = f"rate_limit:{key}"
        current = await self.client.incr(rate_key)
        
        if current == 1:
            await self.client.expire(rate_key, window_seconds)
        
        return current <= max_requests
    
    # ==========================================
    # Utility Methods
    # ==========================================
    @staticmethod
    def hash_image_url(url: str) -> str:
        """Generate a hash for an image URL for cache keys."""
        return hashlib.md5(url.encode()).hexdigest()
    
    async def health_check(self) -> bool:
        """Check Redis connectivity."""
        try:
            await self.client.ping()
            return True
        except Exception:
            return False


# Global Redis service instance
redis_service = RedisService()
