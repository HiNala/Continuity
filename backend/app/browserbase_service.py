"""
Continuity - Browserbase Service
Web automation service for fetching design inspiration images and reference materials.

Browserbase provides cloud browser automation to help users:
1. Find inspiration images based on their design goals
2. Search for specific design styles (modern, minimalist, etc.)
3. Gather reference materials from design websites
4. Fetch mood boards and color palettes

This enables users to better define their vision during requirements gathering.
"""

import asyncio
import base64
import json
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from urllib.parse import quote_plus

import httpx
import weave

from app.config import settings


# ============================================
# Design Websites for Inspiration
# ============================================
DESIGN_SOURCES = {
    "pinterest": {
        "search_url": "https://www.pinterest.com/search/pins/?q={query}",
        "name": "Pinterest",
        "type": "inspiration",
    },
    "houzz": {
        "search_url": "https://www.houzz.com/photos/query/{query}",
        "name": "Houzz",
        "type": "interior_design",
    },
    "dezeen": {
        "search_url": "https://www.dezeen.com/?s={query}",
        "name": "Dezeen",
        "type": "architecture",
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


class BrowserbaseService:
    """
    Service for fetching design inspiration using Browserbase cloud browsers.
    """
    
    def __init__(self):
        self.api_key = settings.browserbase_api_key
        self.project_id = settings.browserbase_project_id
        self.base_url = "https://www.browserbase.com/v1"
        self.connect_url = "https://connect.browserbase.com"
    
    @property
    def is_configured(self) -> bool:
        """Check if Browserbase is configured."""
        return bool(self.api_key and self.project_id)
    
    async def _create_session(self) -> Optional[str]:
        """Create a new Browserbase session."""
        if not self.is_configured:
            return None
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/sessions",
                    headers={
                        "x-bb-api-key": self.api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "projectId": self.project_id,
                        "browserSettings": {
                            "fingerprint": {
                                "devices": ["desktop"],
                                "locales": ["en-US"],
                                "operatingSystems": ["macos"],
                            }
                        }
                    },
                    timeout=30.0,
                )
                
                if response.status_code == 201:
                    data = response.json()
                    return data.get("id")
                else:
                    print(f"Failed to create session: {response.status_code}")
                    return None
        except Exception as e:
            print(f"Session creation error: {e}")
            return None
    
    async def _close_session(self, session_id: str) -> None:
        """Close a Browserbase session."""
        if not session_id:
            return
        
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{self.base_url}/sessions/{session_id}/stop",
                    headers={"x-bb-api-key": self.api_key},
                    timeout=10.0,
                )
        except Exception:
            pass  # Session cleanup is best-effort
    
    @weave.op(name="browserbase_fetch_inspiration")
    async def fetch_inspiration_images(
        self,
        query: str,
        style: Optional[str] = None,
        space_type: Optional[str] = None,
        limit: int = 12,
    ) -> Dict[str, Any]:
        """
        Fetch design inspiration images based on user query.
        
        Args:
            query: User's design goal description
            style: Optional design style (modern, minimalist, etc.)
            space_type: Optional space type (bathroom, kitchen, etc.)
            limit: Maximum number of images to return
            
        Returns:
            Dict with inspiration images and metadata
        """
        if not self.is_configured:
            # Return mock data for development/testing
            return await self._get_placeholder_inspiration(query, style, space_type, limit)
        
        # Build enhanced search query
        search_terms = [query]
        
        if style and style in STYLE_KEYWORDS:
            search_terms.extend(STYLE_KEYWORDS[style][:1])
        
        if space_type and space_type in SPACE_KEYWORDS:
            search_terms.extend(SPACE_KEYWORDS[space_type][:1])
        
        search_query = " ".join(search_terms[:3])  # Limit to 3 terms
        
        # Create browser session
        session_id = await self._create_session()
        
        if not session_id:
            return await self._get_placeholder_inspiration(query, style, space_type, limit)
        
        try:
            images = await self._scrape_design_images(session_id, search_query, limit)
            
            return {
                "success": True,
                "query": query,
                "style": style,
                "space_type": space_type,
                "images": images,
                "total": len(images),
                "source": "browserbase",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        finally:
            await self._close_session(session_id)
    
    async def _scrape_design_images(
        self,
        session_id: str,
        query: str,
        limit: int
    ) -> List[Dict[str, Any]]:
        """
        Scrape design images using Playwright through Browserbase.
        """
        try:
            # Connect to Browserbase via CDP
            from playwright.async_api import async_playwright
            
            ws_url = f"wss://connect.browserbase.com?apiKey={self.api_key}&sessionId={session_id}"
            
            async with async_playwright() as p:
                browser = await p.chromium.connect_over_cdp(ws_url)
                context = browser.contexts[0] if browser.contexts else await browser.new_context()
                page = await context.new_page()
                
                # Search on Google Images for design inspiration
                encoded_query = quote_plus(f"{query} interior design inspiration")
                await page.goto(
                    f"https://www.google.com/search?q={encoded_query}&tbm=isch",
                    wait_until="networkidle",
                    timeout=30000,
                )
                
                # Wait for images to load
                await page.wait_for_timeout(2000)
                
                # Extract image data
                images = await page.evaluate("""
                    () => {
                        const images = [];
                        const imgElements = document.querySelectorAll('img[data-src], img[src]');
                        
                        imgElements.forEach((img, index) => {
                            if (images.length >= 20) return;
                            
                            const src = img.getAttribute('data-src') || img.getAttribute('src');
                            if (src && src.startsWith('http') && !src.includes('google.com/images')) {
                                images.push({
                                    url: src,
                                    alt: img.alt || '',
                                    index: index,
                                });
                            }
                        });
                        
                        return images;
                    }
                """)
                
                await browser.close()
                
                # Format results
                return [
                    {
                        "id": f"img_{i}",
                        "url": img.get("url"),
                        "thumbnail": img.get("url"),
                        "description": img.get("alt", "Design inspiration image"),
                        "source": "web_search",
                    }
                    for i, img in enumerate(images[:limit])
                ]
                
        except Exception as e:
            print(f"Scraping error: {e}")
            return []
    
    async def _get_placeholder_inspiration(
        self,
        query: str,
        style: Optional[str],
        space_type: Optional[str],
        limit: int
    ) -> Dict[str, Any]:
        """
        Return curated placeholder images when Browserbase is unavailable.
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
                {"url": "https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=400", "description": "Modern bathroom design"},
                {"url": "https://images.unsplash.com/photo-1600566752229-250ed79470f8?w=400", "description": "Spa bathroom inspiration"},
                {"url": "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=400", "description": "Contemporary bathroom"},
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
                "id": f"placeholder_{i}",
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
            "note": "Using curated gallery images. Connect Browserbase for live web search.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    
    @weave.op(name="browserbase_search_styles")
    async def search_design_styles(
        self,
        base_style: str,
        limit: int = 6
    ) -> Dict[str, Any]:
        """
        Search for variations of a design style.
        
        Args:
            base_style: The main style (modern, minimalist, etc.)
            limit: Number of style variations to return
            
        Returns:
            Dict with style variations and example images
        """
        # Get keywords for the style
        keywords = STYLE_KEYWORDS.get(base_style, STYLE_KEYWORDS["modern"])
        
        # Fetch inspiration for each keyword variation
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
    
    @weave.op(name="browserbase_fetch_mood_board")
    async def fetch_mood_board(
        self,
        styles: List[str],
        space_type: str,
        keywords: List[str] = None,
        limit: int = 9,
    ) -> Dict[str, Any]:
        """
        Create a mood board with inspiration images from multiple sources.
        
        Args:
            styles: List of design styles to include
            space_type: Type of space
            keywords: Additional search keywords
            limit: Total images for the mood board
            
        Returns:
            Dict with mood board images organized by style
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


# ============================================
# Singleton Instance
# ============================================
browserbase_service = BrowserbaseService()
