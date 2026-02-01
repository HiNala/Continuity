"""
Continuity - Browserbase + Stagehand Service
AI-powered web automation for fetching design inspiration images and reference materials.

Uses Stagehand (https://stagehand.dev) for AI-powered browser automation:
- Natural language instructions for browser actions
- AI-powered element detection and interaction
- Intelligent data extraction from web pages

Browserbase provides the cloud browser infrastructure, while Stagehand adds
the AI layer for intelligent automation.

This enables users to:
1. Find real inspiration images based on their design goals
2. Search for specific design styles with AI-assisted navigation
3. Gather reference materials from design websites automatically
4. Create mood boards with curated design content
"""

import asyncio
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

import httpx
import weave

from app.config import settings


# ============================================
# Design Websites for Inspiration
# ============================================
DESIGN_SOURCES = {
    "unsplash": {
        "search_url": "https://unsplash.com/s/photos/{query}",
        "name": "Unsplash",
        "type": "photos",
    },
    "pexels": {
        "search_url": "https://www.pexels.com/search/{query}/",
        "name": "Pexels",
        "type": "photos",
    },
}

# Style keywords for different design aesthetics
STYLE_KEYWORDS = {
    "modern": ["modern interior design", "contemporary design", "clean lines minimalist"],
    "minimalist": ["minimalist interior", "scandinavian design", "simple elegant spaces"],
    "industrial": ["industrial interior design", "loft style", "exposed brick metal"],
    "japandi": ["japandi design", "japanese scandinavian interior", "zen minimal"],
    "mid_century": ["mid century modern", "retro interior design", "60s furniture"],
    "traditional": ["traditional interior design", "classic elegant rooms", "timeless decor"],
    "luxury": ["luxury interior design", "high end residential", "opulent spaces"],
    "rustic": ["rustic interior", "farmhouse design", "natural wood cabin"],
    "coastal": ["coastal interior design", "beach house style", "nautical decor"],
    "bohemian": ["bohemian interior", "boho chic design", "eclectic colorful spaces"],
}

# Space type search terms
SPACE_KEYWORDS = {
    "bathroom": ["bathroom design", "modern bathroom", "spa bathroom"],
    "kitchen": ["kitchen design", "modern kitchen", "gourmet kitchen"],
    "bedroom": ["bedroom design", "master bedroom", "cozy bedroom"],
    "living_room": ["living room design", "modern living room", "cozy living space"],
    "office": ["home office design", "modern workspace", "productive office"],
    "dining": ["dining room design", "modern dining", "elegant dining space"],
}


class StagehandBrowserbaseService:
    """
    AI-powered browser automation service using Stagehand + Browserbase.
    
    Stagehand provides the AI layer for intelligent browser automation,
    while Browserbase provides the cloud browser infrastructure.
    """
    
    def __init__(self):
        self.browserbase_api_key = settings.browserbase_api_key
        self.browserbase_project_id = settings.browserbase_project_id
        # Stagehand model key: prefer stagehand_model_api_key, fall back to gemini keys
        # This allows using the same Gemini key for both image generation AND browser automation
        self.model_api_key = (
            settings.stagehand_model_api_key 
            or settings.google_generative_ai_api_key 
            or settings.gemini_api_key
        )
        self.base_url = "https://www.browserbase.com/v1"
        self._stagehand_available = None
    
    @property
    def is_browserbase_configured(self) -> bool:
        """Check if Browserbase credentials are configured."""
        return bool(self.browserbase_api_key and self.browserbase_project_id)
    
    @property
    def is_stagehand_configured(self) -> bool:
        """Check if Stagehand (with model API key) is fully configured.
        
        Stagehand supports Gemini, OpenAI, and Anthropic models.
        We use the Gemini key by default since it's already configured.
        """
        return self.is_browserbase_configured and bool(self.model_api_key)
    
    async def _check_stagehand_availability(self) -> bool:
        """Check if Stagehand package is available and configured."""
        if self._stagehand_available is not None:
            return self._stagehand_available
        
        try:
            # Import the v3 SDK
            from stagehand import AsyncStagehand
            self._stagehand_available = self.is_stagehand_configured
            if self._stagehand_available:
                print("[Stagehand] AI-powered browser automation available")
            else:
                print("[Stagehand] Package found but STAGEHAND_MODEL_API_KEY not configured")
            return self._stagehand_available
        except ImportError as e:
            print(f"[Stagehand] Package not available: {e}")
            self._stagehand_available = False
            return False
    
    async def _create_browserbase_session(self) -> Optional[str]:
        """Create a Browserbase session for tracking (without Stagehand)."""
        if not self.is_browserbase_configured:
            return None
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/sessions",
                    headers={
                        "x-bb-api-key": self.browserbase_api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "projectId": self.browserbase_project_id,
                        "browserSettings": {
                            "fingerprint": {
                                "devices": ["desktop"],
                                "locales": ["en-US"],
                            }
                        }
                    },
                    timeout=30.0,
                )
                
                if response.status_code == 201:
                    data = response.json()
                    return data.get("id")
                else:
                    print(f"[Browserbase] Session creation failed: {response.status_code}")
                    return None
        except Exception as e:
            print(f"[Browserbase] Session error: {e}")
            return None
    
    async def _close_browserbase_session(self, session_id: str) -> None:
        """Close a Browserbase session."""
        if not session_id:
            return
        
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{self.base_url}/sessions/{session_id}/stop",
                    headers={"x-bb-api-key": self.browserbase_api_key},
                    timeout=10.0,
                )
        except Exception:
            pass  # Session cleanup is best-effort
    
    @weave.op(name="stagehand_fetch_inspiration")
    async def fetch_inspiration_images(
        self,
        query: str,
        style: Optional[str] = None,
        space_type: Optional[str] = None,
        limit: int = 12,
    ) -> Dict[str, Any]:
        """
        Fetch design inspiration images using AI-powered browser automation.
        
        If Stagehand is configured, uses AI to intelligently navigate and extract
        images from design websites. Falls back to curated gallery if not available.
        
        Args:
            query: User's design goal description
            style: Optional design style (modern, minimalist, etc.)
            space_type: Optional space type (bathroom, kitchen, etc.)
            limit: Maximum number of images to return
            
        Returns:
            Dict with inspiration images and metadata
        """
        # Try Stagehand-powered extraction first
        if await self._check_stagehand_availability():
            try:
                result = await self._fetch_with_stagehand(query, style, space_type, limit)
                if result and result.get("images"):
                    return result
            except Exception as e:
                print(f"[Stagehand] Extraction failed, using fallback: {e}")
        
        # Track with Browserbase session (analytics) even without Stagehand
        session_id = None
        if self.is_browserbase_configured:
            session_id = await self._create_browserbase_session()
            if session_id:
                print(f"[Browserbase] Session {session_id[:8]}... - Fetching inspiration for: {query}")
                await self._close_browserbase_session(session_id)
        
        # Return curated inspiration images
        return await self._get_curated_inspiration(query, style, space_type, limit)
    
    async def _fetch_with_stagehand(
        self,
        query: str,
        style: Optional[str],
        space_type: Optional[str],
        limit: int,
    ) -> Optional[Dict[str, Any]]:
        """
        Use Stagehand AI to extract inspiration images from the web.
        
        This uses the Stagehand Python SDK v3 with natural language instructions to:
        1. Navigate to a design inspiration website
        2. Search for relevant content
        3. Extract image URLs with AI assistance
        """
        from stagehand import AsyncStagehand
        
        # Build search query
        search_terms = [query]
        if style:
            search_terms.append(f"{style} style")
        if space_type:
            search_terms.append(f"{space_type} design")
        full_query = " ".join(search_terms).replace(" ", "-")
        
        # Use Unsplash as primary source (free, high-quality images)
        search_url = f"https://unsplash.com/s/photos/{full_query}"
        
        # Create Stagehand client with Browserbase credentials and Gemini model
        # SDK docs: https://docs.stagehand.dev/v3/sdk/python
        client = AsyncStagehand(
            browserbase_api_key=self.browserbase_api_key,
            browserbase_project_id=self.browserbase_project_id,
            model_api_key=self.model_api_key,
        )
        
        session = None
        try:
            # Start a new browser session with Gemini model
            session = await client.sessions.create(
                model_name="google/gemini-2.5-flash",  # Fast, accurate, cost-effective
            )
            print(f"[Stagehand] Session started: {session.id}")
            
            # Navigate to the search results
            await session.navigate(url=search_url)
            print(f"[Stagehand] Navigated to {search_url}")
            
            # Wait for content to load
            await asyncio.sleep(2)
            
            # Extract image data using Stagehand's AI-powered extraction
            extract_response = await session.extract(
                instruction=f"""
                Find interior design images on this page related to: {query}
                For each image, extract:
                1. The image URL (src attribute of img tags, prefer high resolution)
                2. A brief description (alt text or inferred from context)
                Focus on actual room/interior photos, not profile pictures or icons.
                Return up to {limit} high-quality images.
                """,
                schema={
                    "type": "object",
                    "properties": {
                        "images": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "url": {"type": "string"},
                                    "description": {"type": "string"},
                                },
                                "required": ["url"]
                            }
                        }
                    }
                }
            )
            
            # Process extracted data
            images_data = extract_response.data.result if hasattr(extract_response.data, 'result') else None
            if images_data and isinstance(images_data, dict):
                images = images_data.get("images", [])
                if images:
                    formatted = [
                        {
                            "id": f"stagehand_{i}",
                            "url": img.get("url", ""),
                            "thumbnail": img.get("url", ""),
                            "description": img.get("description", "Design inspiration"),
                            "source": "unsplash_stagehand",
                        }
                        for i, img in enumerate(images[:limit])
                        if img.get("url")
                    ]
                    
                    print(f"[Stagehand] Extracted {len(formatted)} images")
                    
                    return {
                        "success": True,
                        "query": query,
                        "style": style,
                        "space_type": space_type,
                        "images": formatted,
                        "total": len(formatted),
                        "source": "stagehand_ai_extraction",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
            
        except Exception as e:
            print(f"[Stagehand] Error during extraction: {e}")
            raise
        finally:
            # Clean up session
            if session:
                try:
                    await session.end()
                except Exception:
                    pass
        
        return None
    
    async def _get_curated_inspiration(
        self,
        query: str,
        style: Optional[str],
        space_type: Optional[str],
        limit: int
    ) -> Dict[str, Any]:
        """
        Return curated placeholder images when Stagehand is unavailable.
        These are royalty-free images from Unsplash for different design styles.
        """
        # Curated Unsplash images for design inspiration by style
        style_images = {
            "modern": [
                {"url": "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400", "description": "Modern living room with clean lines"},
                {"url": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400", "description": "Contemporary interior design"},
                {"url": "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=400", "description": "Modern minimalist space"},
                {"url": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400", "description": "Contemporary home design"},
            ],
            "minimalist": [
                {"url": "https://images.unsplash.com/photo-1598928506311-c55ez83dc9ae?w=400", "description": "Minimalist white interior"},
                {"url": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400", "description": "Clean simple design"},
                {"url": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400", "description": "Minimal furniture styling"},
                {"url": "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=400", "description": "Sparse elegant interior"},
            ],
            "industrial": [
                {"url": "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=400", "description": "Industrial loft design"},
                {"url": "https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=400", "description": "Exposed brick interior"},
                {"url": "https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=400", "description": "Urban industrial style"},
                {"url": "https://images.unsplash.com/photo-1600566752229-250ed79470f8?w=400", "description": "Metal and wood accents"},
            ],
            "luxury": [
                {"url": "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400", "description": "Luxury interior design"},
                {"url": "https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=400", "description": "Elegant high-end space"},
                {"url": "https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?w=400", "description": "Opulent living room"},
                {"url": "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=400", "description": "Premium residential design"},
            ],
            "mid_century": [
                {"url": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400", "description": "Mid-century modern living"},
                {"url": "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=400", "description": "Retro furniture design"},
                {"url": "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=400", "description": "60s inspired interior"},
                {"url": "https://images.unsplash.com/photo-1567016432779-094069958ea5?w=400", "description": "Vintage modern blend"},
            ],
            "default": [
                {"url": "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400", "description": "Contemporary interior"},
                {"url": "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=400", "description": "Stylish living space"},
                {"url": "https://images.unsplash.com/photo-1615873968403-89e068629265?w=400", "description": "Modern home design"},
                {"url": "https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=400", "description": "Beautiful interior"},
                {"url": "https://images.unsplash.com/photo-1616137466211-f939a420be84?w=400", "description": "Design inspiration"},
                {"url": "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=400", "description": "Interior styling"},
            ],
        }
        
        # Space-specific images
        space_images = {
            "bathroom": [
                {"url": "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=400", "description": "Modern bathroom design"},
                {"url": "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=400", "description": "Spa bathroom inspiration"},
                {"url": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400", "description": "Contemporary bathroom"},
            ],
            "kitchen": [
                {"url": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400", "description": "Modern kitchen design"},
                {"url": "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=400", "description": "Contemporary kitchen"},
                {"url": "https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=400", "description": "Kitchen inspiration"},
            ],
            "bedroom": [
                {"url": "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=400", "description": "Modern bedroom design"},
                {"url": "https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?w=400", "description": "Cozy bedroom inspiration"},
                {"url": "https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?w=400", "description": "Elegant bedroom"},
            ],
            "living_room": [
                {"url": "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400", "description": "Modern living room"},
                {"url": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400", "description": "Contemporary living space"},
                {"url": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400", "description": "Stylish living room"},
            ],
            "office": [
                {"url": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400", "description": "Modern home office"},
                {"url": "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=400", "description": "Professional workspace"},
                {"url": "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=400", "description": "Creative office design"},
            ],
        }
        
        # Combine images based on style and space type
        images = []
        
        # Add style-specific images
        if style and style in style_images:
            images.extend(style_images[style])
        
        # Add space-specific images
        if space_type and space_type in space_images:
            images.extend(space_images[space_type])
        
        # Fill with default images if needed
        if len(images) < limit:
            remaining = limit - len(images)
            images.extend(style_images["default"][:remaining])
        
        # Format results
        formatted = [
            {
                "id": f"curated_{i}",
                "url": img["url"],
                "thumbnail": img["url"],
                "description": img["description"],
                "source": "curated_gallery",
            }
            for i, img in enumerate(images[:limit])
        ]
        
        return {
            "success": True,
            "query": query,
            "style": style,
            "space_type": space_type,
            "images": formatted,
            "total": len(formatted),
            "source": "curated_gallery",
            "note": "Using curated gallery. Set STAGEHAND_MODEL_API_KEY for AI-powered web search.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    
    @weave.op(name="stagehand_search_styles")
    async def search_design_styles(
        self,
        base_style: str,
        limit: int = 6
    ) -> Dict[str, Any]:
        """
        Search for variations of a design style.
        """
        keywords = STYLE_KEYWORDS.get(base_style, STYLE_KEYWORDS.get("modern", []))
        
        results = []
        for keyword in keywords[:limit]:
            images = await self.fetch_inspiration_images(keyword, style=base_style, limit=3)
            results.append({
                "variation": keyword,
                "images": images.get("images", [])[:2],
            })
        
        return {
            "success": True,
            "base_style": base_style,
            "variations": results,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    
    @weave.op(name="stagehand_fetch_mood_board")
    async def fetch_mood_board(
        self,
        styles: List[str],
        space_type: str,
        keywords: Optional[List[str]] = None,
        limit: int = 9,
    ) -> Dict[str, Any]:
        """
        Create a mood board with inspiration images from multiple sources.
        """
        mood_board = {
            "success": True,
            "space_type": space_type,
            "styles": styles,
            "sections": [],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        images_per_style = max(2, limit // len(styles)) if styles else limit
        
        for style in styles:
            query = f"{space_type} {style} design"
            if keywords:
                query += " " + " ".join(keywords[:2])
            
            result = await self.fetch_inspiration_images(
                query=query,
                style=style,
                space_type=space_type,
                limit=images_per_style,
            )
            
            mood_board["sections"].append({
                "style": style,
                "images": result.get("images", []),
            })
        
        return mood_board
    
    async def get_status(self) -> Dict[str, Any]:
        """Get the current status of Browserbase and Stagehand integration."""
        stagehand_available = await self._check_stagehand_availability()
        
        return {
            "browserbase_configured": self.is_browserbase_configured,
            "stagehand_configured": self.is_stagehand_configured,
            "stagehand_available": stagehand_available,
            "model": "google/gemini-2.5-flash" if stagehand_available else None,
            "model_key_source": (
                "STAGEHAND_MODEL_API_KEY" if settings.stagehand_model_api_key
                else "GOOGLE_GENERATIVE_AI_API_KEY" if settings.google_generative_ai_api_key
                else "GEMINI_API_KEY" if settings.gemini_api_key
                else None
            ) if self.model_api_key else None,
            "mode": "ai_powered" if stagehand_available else "curated_gallery",
            "capabilities": {
                "ai_extraction": stagehand_available,
                "session_tracking": self.is_browserbase_configured,
                "curated_images": True,
            }
        }


# ============================================
# Singleton Instance (backward compatible)
# ============================================
browserbase_service = StagehandBrowserbaseService()
