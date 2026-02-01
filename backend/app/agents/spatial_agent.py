"""
Continuity - Spatial Analysis Agent
Mission 03: Analyze input images to extract ground truth physical constraints.

This agent is the anti-hallucination layer. It examines uploaded photographs
and identifies what exists in the space, what can move, and what cannot move.
"""

import json
import base64
import httpx
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID
from pathlib import Path

import weave
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models import (
    Project, Constraint, ProjectAnalysis, ProjectStatus,
    ConstraintClassification, ConstructionState, ElementType
)
from app.redis_service import redis_service


# ============================================
# Classification Rules
# ============================================
# Elements that are ALWAYS locked (cannot change)
ALWAYS_LOCKED = {
    ElementType.FLOOR_DRAIN,
    ElementType.TOILET_FLANGE,
    ElementType.STRUCTURAL_COLUMN,
    ElementType.EXTERIOR_WALL,
    ElementType.ELECTRICAL_PANEL,
    ElementType.WATER_HEATER_CONNECTION,
    ElementType.PIPE_CHASE,
}

# Elements that are usually locked (check context)
USUALLY_LOCKED = {
    ElementType.INTERIOR_WALL,  # Could be non-load-bearing
    ElementType.WINDOW,         # Expensive to move but possible
    ElementType.DOOR,           # Location usually fixed
    ElementType.BEAM,
}

# Elements that are preferred but could change
PREFERRED_ELEMENTS = {
    ElementType.SINK_PLUMBING_STUB,
    ElementType.SHOWER_DRAIN,
    ElementType.OUTLET_LOCATION,
    ElementType.LIGHT_FIXTURE_JUNCTION,
    ElementType.SWITCH_LOCATION,
    ElementType.VENT_LOCATION,
}

# Elements that are always flexible
ALWAYS_FLEXIBLE = {
    ElementType.CONSTRUCTION_DEBRIS,
    ElementType.TEMPORARY_FIXTURE,
    ElementType.FURNITURE,
    ElementType.EQUIPMENT,
    ElementType.STAGING_ITEMS,
}


# ============================================
# Vision Prompt Template
# ============================================
SPATIAL_ANALYSIS_PROMPT = """You are a spatial analysis expert for architectural renovation visualization. 
Analyze this image of a space and identify all physical elements that would constrain or influence a renovation design.

Your task is to identify:

1. **Structural Elements**: walls, floors, ceilings, doors, windows, columns, beams
2. **Plumbing Indicators**: floor drains, toilet flanges, sink plumbing stubs, shower drains, visible pipes
3. **Electrical Indicators**: electrical panels, outlet locations, light fixture junctions, switches
4. **HVAC Indicators**: vents, HVAC units, visible ductwork
5. **Movable Items**: construction debris, temporary fixtures, furniture, equipment

For each element you identify, provide:
- `element_type`: The type of element (use lowercase_snake_case)
- `location`: A brief description of where it is in the image (e.g., "left wall", "center floor", "near window")
- `confidence`: Your confidence in this identification (0.0 to 1.0)
- `notes`: Any relevant observations about this element

Also assess the overall construction state:
- `unfinished`: Exposed studs, no finishes, raw construction
- `partially_complete`: Some finishes installed but incomplete
- `existing_finish`: Fully finished space being considered for redesign

Return your analysis as JSON in this exact format:
```json
{
  "construction_state": "unfinished|partially_complete|existing_finish",
  "image_quality": "good|fair|poor",
  "overall_confidence": 0.0-1.0,
  "elements": [
    {
      "element_type": "floor_drain",
      "location": "center of floor",
      "confidence": 0.95,
      "notes": "Clear floor drain visible, indicates toilet placement constraint"
    }
  ],
  "summary": "Brief summary of the space and key constraints identified"
}
```

Focus on elements that would constrain renovation design. Be thorough but only report what you can clearly see.
If the image is unclear or low quality, note this in your confidence scores."""


# ============================================
# Spatial Analysis Agent Class
# ============================================
class SpatialAnalysisAgent:
    """
    The Spatial Analysis Agent examines input images to extract
    ground truth physical constraints for renovation visualization.
    """
    
    def __init__(self):
        self.gemini_api_key = settings.gemini_api_key
        self.gemini_model = settings.gemini_vision_model or settings.gemini_model
    
    @weave.op(name="spatial_agent_prepare_image")
    def prepare_image(self, image_path: str) -> Optional[Dict[str, Any]]:
        """
        Prepare an image for vision API analysis.
        
        Args:
            image_path: Path to the image file or URL
            
        Returns:
            Dict with image data ready for API, or None if failed
        """
        try:
            # Handle URL vs local file
            if image_path.startswith("data:"):
                header, encoded = image_path.split(",", 1)
                mime_type = "image/jpeg"
                if ";base64" in header:
                    mime_type = header[5:].split(";")[0] or mime_type
                if not encoded:
                    return None
                return {
                    "type": "base64",
                    "data": encoded,
                    "mime_type": mime_type,
                }
            if image_path.startswith(('http://', 'https://')):
                return {
                    "type": "url",
                    "url": image_path,
                }
            else:
                # Read local file and encode as base64
                path = Path(image_path)
                if not path.exists():
                    return None
                
                with open(path, "rb") as f:
                    image_data = base64.standard_b64encode(f.read()).decode("utf-8")
                
                # Determine mime type
                suffix = path.suffix.lower()
                mime_types = {
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".png": "image/png",
                    ".gif": "image/gif",
                    ".webp": "image/webp",
                }
                mime_type = mime_types.get(suffix, "image/jpeg")
                
                return {
                    "type": "base64",
                    "mime_type": mime_type,
                    "data": image_data,
                }
        except Exception as e:
            print(f"Error preparing image {image_path}: {e}")
            return None
    
    @weave.op(name="spatial_agent_analyze_image")
    async def analyze_single_image(
        self,
        image_data: Dict[str, Any],
        image_index: int = 0,
        project_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze a single image using Gemini vision.
        Uses Redis caching to avoid re-analyzing the same image.
        
        Args:
            image_data: Prepared image data from prepare_image()
            image_index: Index of this image (for multi-image tracking)
            project_id: Optional project ID for caching
            
        Returns:
            Analysis results as structured dict
        """
        if not self.gemini_api_key:
            return {
                "error": "GEMINI_API_KEY not configured",
                "elements": [],
                "construction_state": None,
            }
        
        # Generate cache key from image data
        image_hash = None
        if project_id:
            if image_data["type"] == "url":
                image_hash = redis_service.hash_image_url(image_data["url"])
            elif image_data["type"] == "base64":
                # Hash the base64 data (first 1000 chars for efficiency)
                image_hash = redis_service.hash_image_url(image_data["data"][:1000])
            
            # Check Redis cache
            if image_hash:
                try:
                    cached = await redis_service.get_cached_spatial_analysis(project_id, image_hash)
                    if cached:
                        cached["from_cache"] = True
                        return cached
                except Exception:
                    pass  # Redis unavailable, continue with API call
        
        try:
            # Build the Gemini API request
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent"
            
            # Construct image part based on type
            if image_data["type"] == "url":
                image_part = {
                    "file_data": {
                        "mime_type": "image/jpeg",
                        "file_uri": image_data["url"]
                    }
                }
            else:
                image_part = {
                    "inline_data": {
                        "mime_type": image_data["mime_type"],
                        "data": image_data["data"]
                    }
                }
            
            payload = {
                "contents": [{
                    "parts": [
                        {"text": SPATIAL_ANALYSIS_PROMPT},
                        image_part
                    ]
                }],
                "generationConfig": {
                    "temperature": 0.2,
                    "topP": 0.8,
                    "maxOutputTokens": 4096,
                }
            }
            
            headers = {
                "Content-Type": "application/json",
            }
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{url}?key={self.gemini_api_key}",
                    json=payload,
                    headers=headers
                )
                response.raise_for_status()
                result = response.json()
            
            # Extract the text response
            text_response = result["candidates"][0]["content"]["parts"][0]["text"]
            
            # Parse JSON from response (handle markdown code blocks)
            json_str = text_response
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            
            analysis = json.loads(json_str.strip())
            analysis["image_index"] = image_index
            analysis["analyzed_at"] = datetime.now(timezone.utc).isoformat()
            
            # Cache the result in Redis for future requests
            if project_id and image_hash:
                try:
                    await redis_service.cache_spatial_analysis(project_id, image_hash, analysis)
                except Exception:
                    pass  # Redis unavailable, continue without caching
            
            return analysis
            
        except httpx.HTTPStatusError as e:
            return {
                "error": f"Gemini API error: {e.response.status_code}",
                "elements": [],
                "construction_state": None,
            }
        except json.JSONDecodeError as e:
            return {
                "error": f"Failed to parse Gemini response as JSON: {str(e)}",
                "raw_response": text_response if 'text_response' in locals() else None,
                "elements": [],
                "construction_state": None,
            }
        except Exception as e:
            return {
                "error": f"Analysis failed: {str(e)}",
                "elements": [],
                "construction_state": None,
            }
    
    @weave.op(name="spatial_agent_merge_analysis")
    def merge_multi_image_analysis(
        self,
        analyses: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Merge analysis results from multiple images into a unified constraint map.
        
        Args:
            analyses: List of analysis results from analyze_single_image()
            
        Returns:
            Merged analysis with deduplicated elements
        """
        if not analyses:
            return {
                "construction_state": None,
                "elements": [],
                "image_quality": "unknown",
                "overall_confidence": 0.0,
                "summary": "No images analyzed",
            }
        
        # If only one image, return it directly
        if len(analyses) == 1:
            return analyses[0]
        
        # Merge multiple analyses
        merged_elements = []
        construction_states = []
        confidences = []
        summaries = []
        
        for analysis in analyses:
            if "error" in analysis:
                continue
                
            # Collect construction states
            if analysis.get("construction_state"):
                construction_states.append(analysis["construction_state"])
            
            # Collect confidences
            if analysis.get("overall_confidence"):
                confidences.append(analysis["overall_confidence"])
            
            # Collect summaries
            if analysis.get("summary"):
                summaries.append(analysis["summary"])
            
            # Merge elements (track source image)
            for element in analysis.get("elements", []):
                element["source_image_index"] = analysis.get("image_index", 0)
                merged_elements.append(element)
        
        # Determine overall construction state (most common)
        construction_state = None
        if construction_states:
            from collections import Counter
            construction_state = Counter(construction_states).most_common(1)[0][0]
        
        # Average confidence
        overall_confidence = sum(confidences) / len(confidences) if confidences else 0.5
        
        return {
            "construction_state": construction_state,
            "elements": merged_elements,
            "image_quality": "good" if overall_confidence > 0.7 else "fair" if overall_confidence > 0.4 else "poor",
            "overall_confidence": overall_confidence,
            "summary": " | ".join(summaries) if summaries else "Multi-image analysis complete",
            "images_analyzed": len(analyses),
        }
    
    @weave.op(name="spatial_agent_classify_elements")
    def classify_elements(
        self,
        elements: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Apply classification rules to categorize elements as locked/preferred/flexible.
        
        Args:
            elements: List of element dicts from vision analysis
            
        Returns:
            Elements with classification added
        """
        classified = []
        
        for element in elements:
            element_type = element.get("element_type", "").lower()
            
            # Apply classification rules
            if element_type in ALWAYS_LOCKED or any(t in element_type for t in ["floor_drain", "toilet_flange", "structural", "electrical_panel"]):
                classification = ConstraintClassification.LOCKED
            elif element_type in USUALLY_LOCKED or any(t in element_type for t in ["wall", "window", "door", "beam"]):
                classification = ConstraintClassification.LOCKED
            elif element_type in PREFERRED_ELEMENTS or any(t in element_type for t in ["plumbing", "outlet", "vent", "switch"]):
                classification = ConstraintClassification.PREFERRED
            elif element_type in ALWAYS_FLEXIBLE or any(t in element_type for t in ["debris", "furniture", "equipment", "staging", "temporary"]):
                classification = ConstraintClassification.FLEXIBLE
            else:
                # Default to preferred for unknown structural elements
                classification = ConstraintClassification.PREFERRED
            
            element["classification"] = classification
            classified.append(element)
        
        return classified
    
    @weave.op(name="spatial_agent_assess_construction")
    def assess_construction_state(
        self,
        analysis: Dict[str, Any]
    ) -> str:
        """
        Assess or validate the construction state based on analysis.
        
        Args:
            analysis: The merged analysis results
            
        Returns:
            Construction state string
        """
        # Trust the vision model's assessment if provided
        if analysis.get("construction_state"):
            return analysis["construction_state"]
        
        # Fallback: infer from elements
        elements = analysis.get("elements", [])
        
        # Look for indicators
        has_debris = any("debris" in e.get("element_type", "").lower() for e in elements)
        has_exposed = any("exposed" in e.get("notes", "").lower() for e in elements)
        has_furniture = any("furniture" in e.get("element_type", "").lower() for e in elements)
        
        if has_debris or has_exposed:
            return ConstructionState.UNFINISHED
        elif has_furniture:
            return ConstructionState.EXISTING_FINISH
        else:
            return ConstructionState.PARTIALLY_COMPLETE
    
    @weave.op(name="spatial_agent_analyze_images")
    async def analyze_images(
        self,
        session: AsyncSession,
        project_id: UUID,
        images: List[str]
    ) -> Dict[str, Any]:
        """
        Complete workflow to analyze all project images and save results.
        
        This method orchestrates:
        1. Preparing each image for analysis
        2. Running Gemini Vision analysis on each
        3. Merging multi-image results
        4. Classifying elements
        5. Saving to database
        
        Args:
            session: Database session
            project_id: The project ID
            images: List of image paths or URLs
            
        Returns:
            Analysis summary with constraint counts
        """
        if not images:
            return {
                "success": False,
                "error": "No images provided",
                "constraints_count": 0,
            }
        
        # Step 1: Analyze each image
        analyses = []
        for i, image_path in enumerate(images[:5]):  # Limit to 5 images
            image_data = self.prepare_image(image_path)
            if image_data:
                analysis = await self.analyze_single_image(
                    image_data, 
                    i, 
                    str(project_id)
                )
                if analysis and "error" not in analysis:
                    analyses.append(analysis)
        
        if not analyses:
            return {
                "success": False,
                "error": "Failed to analyze any images",
                "constraints_count": 0,
            }
        
        # Step 2: Merge results from multiple images
        merged = self.merge_multi_image_analysis(analyses)
        
        # Step 3: Classify elements
        elements = merged.get("elements", [])
        classified = self.classify_elements(elements)
        
        # Step 4: Determine construction state
        construction_state = self.assess_construction_state(merged)
        merged["construction_state"] = construction_state
        
        # Step 5: Save to database
        try:
            project_analysis = await self.save_constraints(
                session, project_id, merged, classified
            )
            await session.flush()
            
            return {
                "success": True,
                "constraints_count": len(classified),
                "construction_state": construction_state,
                "locked_count": project_analysis.locked_count,
                "preferred_count": project_analysis.preferred_count,
                "flexible_count": project_analysis.flexible_count,
                "images_analyzed": len(analyses),
                "overall_confidence": merged.get("overall_confidence", 0.5),
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "constraints_count": len(classified),
                "construction_state": construction_state,
            }

    @weave.op(name="spatial_agent_save_constraints")
    async def save_constraints(
        self,
        session: AsyncSession,
        project_id: UUID,
        analysis: Dict[str, Any],
        classified_elements: List[Dict[str, Any]]
    ) -> ProjectAnalysis:
        """
        Save the analysis results to the database.
        
        Args:
            session: Database session
            project_id: The project ID
            analysis: The merged analysis results
            classified_elements: Elements with classifications
            
        Returns:
            The created ProjectAnalysis record
        """
        # Count by classification
        locked_count = sum(1 for e in classified_elements if e.get("classification") == ConstraintClassification.LOCKED)
        preferred_count = sum(1 for e in classified_elements if e.get("classification") == ConstraintClassification.PREFERRED)
        flexible_count = sum(1 for e in classified_elements if e.get("classification") == ConstraintClassification.FLEXIBLE)
        
        # Create the project analysis record
        project_analysis = ProjectAnalysis(
            project_id=project_id,
            construction_state=analysis.get("construction_state"),
            analysis_summary={
                "summary": analysis.get("summary", ""),
                "images_analyzed": analysis.get("images_analyzed", 1),
                "total_elements": len(classified_elements),
            },
            recommended_phase_sequence=self._recommend_phases(analysis, classified_elements),
            locked_count=locked_count,
            preferred_count=preferred_count,
            flexible_count=flexible_count,
            image_quality_assessment=analysis.get("image_quality"),
            confidence_overall=analysis.get("overall_confidence", 0.5),
        )
        
        session.add(project_analysis)
        
        # Create constraint records for each element
        for element in classified_elements:
            constraint = Constraint(
                project_id=project_id,
                element_type=element.get("element_type", "unknown"),
                element_location=element.get("location", ""),
                classification=element.get("classification", ConstraintClassification.FLEXIBLE),
                confidence_score=element.get("confidence", 0.5),
                source_image=str(element.get("source_image_index", 0)),
                notes=element.get("notes", ""),
            )
            session.add(constraint)
        
        # Update project status
        result = await session.execute(
            select(Project).where(Project.id == project_id)
        )
        project = result.scalar_one_or_none()
        if project:
            project.status = ProjectStatus.ANALYZING
        
        await session.flush()
        return project_analysis
    
    def _recommend_phases(
        self,
        analysis: Dict[str, Any],
        elements: List[Dict[str, Any]]
    ) -> List[str]:
        """
        Recommend generation phases based on analysis.
        
        Args:
            analysis: The analysis results
            elements: Classified elements
            
        Returns:
            List of recommended phase names in order
        """
        phases = []
        construction_state = analysis.get("construction_state", "")
        
        # If unfinished, start with cleanup phase
        has_debris = any("debris" in e.get("element_type", "").lower() for e in elements)
        if has_debris or construction_state == ConstructionState.UNFINISHED:
            phases.append("cleanup")
        
        # Structural phase for unfinished/partial
        if construction_state in [ConstructionState.UNFINISHED, ConstructionState.PARTIALLY_COMPLETE]:
            phases.append("structural")
        
        # Fixture phase if there are plumbing/electrical constraints
        has_plumbing = any("plumbing" in e.get("element_type", "").lower() or "drain" in e.get("element_type", "").lower() for e in elements)
        if has_plumbing:
            phases.append("fixture")
        
        # Always end with style phase
        phases.append("style")
        
        return phases


# ============================================
# Singleton Instance
# ============================================
spatial_agent = SpatialAnalysisAgent()
