"""
Continuity - Configuration Management
Loads settings from environment variables with validation.
"""

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    Uses pydantic-settings for validation and type coercion.
    """
    
    # ==========================================
    # Environment
    # ==========================================
    environment: str = "development"
    debug: bool = True
    
    # ==========================================
    # API Keys
    # ==========================================
    gemini_api_key: Optional[str] = None
    wandb_api_key: Optional[str] = None
    browserbase_api_key: Optional[str] = None
    browserbase_project_id: Optional[str] = None
    
    # ==========================================
    # Weave Configuration
    # ==========================================
    weave_project_name: str = "continuity"
    
    # ==========================================
    # Database
    # ==========================================
    database_url: str = "postgresql://continuity:continuity_dev_password@localhost:5432/continuity"
    
    # ==========================================
    # Redis
    # ==========================================
    redis_url: str = "redis://localhost:6379/0"
    
    # ==========================================
    # URLs
    # ==========================================
    frontend_url: str = "http://localhost:3000"
    
    # ==========================================
    # Model Configuration
    # ==========================================
    default_model: str = "gemini-2.0-flash"
    gemini_model: str = "gemini-2.0-flash"  # Vision model for spatial analysis
    max_iterations: int = 5
    quality_threshold: float = 0.7
    
    class Config:
        """Pydantic configuration."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.
    Uses lru_cache to avoid re-reading environment on every call.
    """
    return Settings()


# Global settings instance
settings = get_settings()
