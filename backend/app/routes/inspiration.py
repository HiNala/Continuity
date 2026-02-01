"""
Continuity - Inspiration Routes
API endpoints for fetching design inspiration images and reference materials.

These endpoints use Browserbase to help users define their design goals
by providing relevant inspiration images, style examples, and mood boards.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_async_session
from app.browserbase_service import browserbase_service
from app.models import Project, Requirements

router = APIRouter(prefix="/api/inspiration", tags=["Inspiration"])


# ============================================
# Request/Response Models
# ============================================
class InspirationRequest(BaseModel):
    """Request for design inspiration images."""
    query: str  # User's description of what they want
    style: Optional[str] = None  # Design style preference
    space_type: Optional[str] = None  # Type of space
    limit: int = 12  # Number of images to return


class InspirationImage(BaseModel):
    """A single inspiration image."""
    id: str
    url: str
    thumbnail: str
    description: str
    source: str


class InspirationResponse(BaseModel):
    """Response with inspiration images."""
    success: bool
    query: str
    style: Optional[str]
    space_type: Optional[str]
    images: List[InspirationImage]
    total: int
    source: str
    timestamp: str
    note: Optional[str] = None


class StyleSearchRequest(BaseModel):
    """Request to search for style variations."""
    base_style: str
    limit: int = 6


class StyleVariation(BaseModel):
    """A style variation with example images."""
    variation: str
    images: List[InspirationImage]


class StyleSearchResponse(BaseModel):
    """Response with style variations."""
    success: bool
    base_style: str
    variations: List[StyleVariation]
    timestamp: str


class MoodBoardRequest(BaseModel):
    """Request to generate a mood board."""
    styles: List[str]
    space_type: str
    keywords: Optional[List[str]] = None
    limit: int = 9


class MoodBoardSection(BaseModel):
    """A section of the mood board for one style."""
    style: str
    images: List[InspirationImage]


class MoodBoardResponse(BaseModel):
    """Response with a complete mood board."""
    success: bool
    space_type: str
    styles: List[str]
    sections: List[MoodBoardSection]
    timestamp: str


class ProjectInspirationRequest(BaseModel):
    """Request inspiration based on a project's context."""
    include_styles: bool = True  # Include style-specific images
    include_space: bool = True  # Include space-specific images
    limit: int = 12


# ============================================
# Endpoints
# ============================================
@router.post("/search", response_model=InspirationResponse)
async def search_inspiration(request: InspirationRequest):
    """
    Search for design inspiration images based on user query.
    
    This uses Browserbase to scrape design websites for relevant images,
    helping users visualize and define their design goals.
    
    Example queries:
    - "modern spa bathroom with natural materials"
    - "minimalist kitchen with white cabinets"
    - "cozy living room mid-century style"
    """
    result = await browserbase_service.fetch_inspiration_images(
        query=request.query,
        style=request.style,
        space_type=request.space_type,
        limit=request.limit,
    )
    
    # Convert to response model
    images = [
        InspirationImage(**img) for img in result.get("images", [])
    ]
    
    return InspirationResponse(
        success=result.get("success", False),
        query=result.get("query", request.query),
        style=result.get("style"),
        space_type=result.get("space_type"),
        images=images,
        total=result.get("total", 0),
        source=result.get("source", "unknown"),
        timestamp=result.get("timestamp", ""),
        note=result.get("note"),
    )


@router.post("/styles", response_model=StyleSearchResponse)
async def search_styles(request: StyleSearchRequest):
    """
    Search for variations of a design style.
    
    Returns example images for different interpretations of the style,
    helping users refine their aesthetic preferences.
    
    Available base styles:
    - modern, minimalist, industrial, japandi
    - mid_century, traditional, luxury, rustic
    - coastal, bohemian
    """
    result = await browserbase_service.search_design_styles(
        base_style=request.base_style,
        limit=request.limit,
    )
    
    # Convert to response model
    variations = [
        StyleVariation(
            variation=v.get("variation", ""),
            images=[InspirationImage(**img) for img in v.get("images", [])]
        )
        for v in result.get("variations", [])
    ]
    
    return StyleSearchResponse(
        success=result.get("success", False),
        base_style=result.get("base_style", request.base_style),
        variations=variations,
        timestamp=result.get("timestamp", ""),
    )


@router.post("/mood-board", response_model=MoodBoardResponse)
async def create_mood_board(request: MoodBoardRequest):
    """
    Create a mood board with inspiration images from multiple styles.
    
    Combines images from selected styles to help users visualize
    how different design elements might work together.
    """
    result = await browserbase_service.fetch_mood_board(
        styles=request.styles,
        space_type=request.space_type,
        keywords=request.keywords,
        limit=request.limit,
    )
    
    # Convert to response model
    sections = [
        MoodBoardSection(
            style=s.get("style", ""),
            images=[InspirationImage(**img) for img in s.get("images", [])]
        )
        for s in result.get("sections", [])
    ]
    
    return MoodBoardResponse(
        success=result.get("success", False),
        space_type=result.get("space_type", request.space_type),
        styles=result.get("styles", request.styles),
        sections=sections,
        timestamp=result.get("timestamp", ""),
    )


@router.get("/project/{project_id}")
async def get_project_inspiration(
    project_id: UUID,
    include_styles: bool = True,
    include_space: bool = True,
    limit: int = 12,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Get inspiration images based on a project's existing requirements.
    
    Automatically fetches relevant inspiration based on the project's
    detected space type and style preferences.
    """
    # Load project and requirements
    result = await session.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Load requirements if they exist
    req_result = await session.execute(
        select(Requirements).where(Requirements.project_id == project_id)
    )
    requirements = req_result.scalar_one_or_none()
    
    # Build search parameters
    query_parts = []
    style = None
    space_type = None
    
    if project.goal:
        query_parts.append(project.goal[:100])  # Limit to first 100 chars
    
    if requirements:
        if requirements.space_type:
            space_type = requirements.space_type
            if include_space:
                query_parts.append(f"{requirements.space_type} design")
        
        if requirements.style_targets:
            styles = requirements.style_targets
            if isinstance(styles, list) and styles:
                style = styles[0]
                if include_styles:
                    query_parts.append(f"{style} style")
    
    # Default query if nothing specific
    if not query_parts:
        query_parts = ["interior design inspiration"]
    
    # Fetch inspiration
    query = " ".join(query_parts[:3])
    result = await browserbase_service.fetch_inspiration_images(
        query=query,
        style=style,
        space_type=space_type,
        limit=limit,
    )
    
    return {
        "project_id": str(project_id),
        "query_used": query,
        "detected_style": style,
        "detected_space_type": space_type,
        **result,
    }


@router.get("/styles/available")
async def get_available_styles():
    """
    Get list of available design styles with descriptions.
    
    Returns all supported styles that can be used for searching
    and filtering inspiration images.
    """
    from app.browserbase_service import STYLE_KEYWORDS, SPACE_KEYWORDS
    
    styles = {
        name: {
            "name": name.replace("_", " ").title(),
            "keywords": keywords[:3],
            "description": _get_style_description(name),
        }
        for name, keywords in STYLE_KEYWORDS.items()
    }
    
    spaces = {
        name: {
            "name": name.replace("_", " ").title(),
            "keywords": keywords[:2],
        }
        for name, keywords in SPACE_KEYWORDS.items()
    }
    
    return {
        "styles": styles,
        "space_types": spaces,
    }


def _get_style_description(style: str) -> str:
    """Get a description for a design style."""
    descriptions = {
        "modern": "Clean lines, neutral colors, and functional furniture with minimal ornamentation",
        "minimalist": "Simplicity and functionality with only essential elements and muted colors",
        "industrial": "Raw materials like exposed brick, metal, and wood with urban warehouse aesthetics",
        "japandi": "Blend of Japanese minimalism and Scandinavian functionality with natural materials",
        "mid_century": "Retro furniture from the 1950s-60s with organic shapes and warm wood tones",
        "traditional": "Classic elegance with ornate details, rich fabrics, and timeless patterns",
        "luxury": "High-end materials, sophisticated finishes, and opulent accessories",
        "rustic": "Natural wood, stone, and warm textures creating a cozy cabin-like atmosphere",
        "coastal": "Light colors, natural textures, and nautical elements inspired by beach living",
        "bohemian": "Eclectic mix of colors, patterns, and global influences with artistic flair",
    }
    return descriptions.get(style, "A distinctive interior design aesthetic")
