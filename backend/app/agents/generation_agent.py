"""
Continuity - Main Generation Agent
Mission 04: Phased image generation that respects spatial constraints.

This agent transforms input spaces through four phases:
1. Cleanup - Remove debris and distractions
2. Structural - Complete walls, ceiling, flooring
3. Fixture - Place fixtures according to constraints
4. Style - Apply target design styles

The agent follows policy configuration but does NOT modify it.
Quality Control Agent (Mission 05) handles policy modification.
"""

import base64
import httpx
import time
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID

import weave
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.config import settings
from app.models import (
    Project, Policy, Iteration, Constraint, ProjectAnalysis, Requirements,
    ProjectStatus, GenerationPhase, IterationStatus, ConstraintClassification,
    ReferenceImage
)
from app.redis_service import redis_service
from app.weave_ops import log_image_media


# ============================================
# Default Policy Configuration
# ============================================
DEFAULT_CLEANUP_CONFIG = {
    "prompt_template": """You are tasked with cleaning up a construction/renovation space image.

TASK: Remove all construction debris, temporary items, tools, and visual distractions from this image while preserving the underlying structure.

PRESERVE:
- All walls, floors, ceilings
- All structural elements (columns, beams)
- All plumbing indicators (drains, stubs)
- All electrical indicators (panels, outlets)
- The overall room geometry and perspective

REMOVE:
- Construction debris and waste
- Temporary scaffolding or supports
- Tools and equipment
- Dust and dirt
- Plastic sheeting or tarps

{constraint_instructions}

Output a clean version of this space with all distractions removed but all structural and constraint elements visible.""",
    "creativity_level": 0.3,
    "constraint_emphasis": "high",
    "max_retries": 2,
}

DEFAULT_STRUCTURAL_CONFIG = {
    "prompt_template": """You are completing the structural elements of an unfinished or partially complete space.

TASK: Complete all unfinished structural elements to create a clean, ready-for-finishing space.

COMPLETE:
- Finish all walls with smooth surfaces
- Complete the ceiling with appropriate finish
- Install finished flooring
- Ensure all doors and windows are properly framed

PRESERVE:
{constraint_instructions}

The space should look structurally complete and ready for fixtures and finishes.
Maintain the exact room dimensions and perspective from the input image.""",
    "creativity_level": 0.4,
    "constraint_emphasis": "high",
    "max_retries": 2,
}

DEFAULT_FIXTURE_CONFIG = {
    "prompt_template": """You are placing fixtures in a {space_type} according to the spatial constraints identified.

TASK: Install appropriate fixtures in their correct positions based on the constraint map.

FIXTURE PLACEMENT RULES:
{constraint_instructions}

INSTALL:
- Primary fixtures appropriate for a {space_type}
- Standard supporting fixtures appropriate for the space (e.g., storage, lighting, seating, appliances)
- Lighting fixtures

Ensure all fixtures are positioned correctly according to the locked constraints.
The space should look functional and properly equipped.""",
    "creativity_level": 0.5,
    "constraint_emphasis": "high",
    "max_retries": 2,
}

DEFAULT_STYLE_CONFIG = {
    "prompt_template": """You are applying {target_style} design style to this {space_type}.

TASK: Transform this space into a beautiful {target_style} design while maintaining all fixture positions and constraints.

STYLE CHARACTERISTICS:
{style_guidance}

REQUIREMENTS:
- Apply the {target_style} aesthetic throughout
- Maintain all fixture positions exactly as shown
- Respect accessibility requirements: {accessibility}
- Target budget tier: {budget_tier}

{constraint_instructions}

Create a professionally designed, photorealistic visualization that could be presented to clients.""",
    "creativity_level": 0.7,
    "constraint_emphasis": "medium",
    "max_retries": 3,
    "style_guidance": {
        "modern": "Clean lines, minimalist aesthetic, neutral colors with bold accents, sleek materials like glass and metal",
        "minimalist": "Extremely simple, uncluttered, monochromatic palette, functional beauty, hidden storage",
        "industrial": "Exposed materials, metal fixtures, concrete, raw textures, warehouse aesthetic",
        "japandi": "Japanese minimalism meets Scandinavian warmth, natural materials, neutral palette, wabi-sabi elements",
        "scandinavian": "Light wood, white walls, cozy textiles, functional simplicity, hygge atmosphere",
        "mid_century": "Retro 1950s-60s aesthetic, organic curves, warm wood tones, iconic furniture silhouettes",
        "traditional": "Classic elegance, rich materials, ornate details, symmetry, timeless quality",
        "luxury": "High-end materials, statement fixtures, sophisticated palette, attention to detail",
        "rustic": "Natural materials, warm wood, stone elements, cozy farmhouse aesthetic",
        "coastal": "Beach-inspired, light blues and whites, natural textures, relaxed atmosphere",
    },
}

DEFAULT_POLICY = {
    "cleanup_config": DEFAULT_CLEANUP_CONFIG,
    "structural_config": DEFAULT_STRUCTURAL_CONFIG,
    "fixture_config": DEFAULT_FIXTURE_CONFIG,
    "style_config": DEFAULT_STYLE_CONFIG,
}


# ============================================
# Generation Agent Class
# ============================================
class GenerationAgent:
    """
    The Generation Agent executes phased image generation.
    It follows policy configuration but does not modify it.
    """
    
    def __init__(self):
        self.gemini_api_key = settings.gemini_api_key
        self.gemini_model = settings.gemini_image_model or settings.gemini_model
        self.image_aspect_ratio = settings.gemini_image_aspect_ratio
        self.image_size = settings.gemini_image_size
        self.output_dir = Path("generated_images")
        self.output_dir.mkdir(exist_ok=True)
    
    @weave.op(name="generation_agent_load_policy")
    async def load_policy(
        self,
        session: AsyncSession,
        project_id: UUID
    ) -> Dict[str, Any]:
        """
        Load the current policy configuration for a project.
        Uses Redis cache for faster retrieval during generation.
        Falls back to default policy if none exists.
        """
        # Check Redis cache first
        try:
            cached_policy = await redis_service.get_cached_policy(str(project_id))
            if cached_policy:
                return cached_policy
        except Exception:
            pass  # Redis unavailable, continue with database
        
        # Try to find project-specific policy in database
        result = await session.execute(
            select(Policy)
            .where(and_(Policy.project_id == project_id, Policy.is_active.is_(True)))
            .order_by(Policy.version.desc())
            .limit(1)
        )
        policy = result.scalar_one_or_none()
        
        if policy:
            policy_data = {
                "id": policy.id,
                "version": policy.version,
                "cleanup_config": policy.cleanup_config or DEFAULT_CLEANUP_CONFIG,
                "structural_config": policy.structural_config or DEFAULT_STRUCTURAL_CONFIG,
                "fixture_config": policy.fixture_config or DEFAULT_FIXTURE_CONFIG,
                "style_config": policy.style_config or DEFAULT_STYLE_CONFIG,
            }
        else:
            # Fall back to default policy
            policy_data = {
                "id": None,
                "version": 1,
                **DEFAULT_POLICY,
            }
        
        # Cache in Redis for subsequent calls
        try:
            await redis_service.cache_policy(str(project_id), policy_data)
        except Exception:
            pass  # Redis unavailable, continue without caching
        
        return policy_data
    
    @weave.op(name="generation_agent_load_constraints")
    async def load_constraints(
        self,
        session: AsyncSession,
        project_id: UUID,
        scene_id: Optional[UUID] = None
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Load spatial constraints and analysis for a project.
        Returns (constraints_list, analysis_summary)
        
        If scene_id is provided, returns only constraints for that scene.
        """
        # Load constraints - either for specific scene or entire project
        from sqlalchemy import and_, or_
        
        if scene_id:
            # Load constraints for this specific scene, plus any project-level constraints
            result = await session.execute(
                select(Constraint).where(
                    and_(
                        Constraint.project_id == project_id,
                        or_(
                            Constraint.scene_id == scene_id,
                            Constraint.scene_id.is_(None)
                        )
                    )
                )
            )
        else:
            result = await session.execute(
                select(Constraint).where(Constraint.project_id == project_id)
            )
        constraints = result.scalars().all()
        
        constraints_list = [
            {
                "element_type": c.element_type,
                "location": c.element_location,
                "classification": c.classification,
                "confidence": c.confidence_score,
                "notes": c.notes,
            }
            for c in constraints
        ]
        
        # Load analysis summary
        result = await session.execute(
            select(ProjectAnalysis).where(ProjectAnalysis.project_id == project_id)
        )
        analysis = result.scalar_one_or_none()
        
        analysis_summary = {
            "construction_state": analysis.construction_state if analysis else None,
            "locked_count": analysis.locked_count if analysis else 0,
            "preferred_count": analysis.preferred_count if analysis else 0,
            "flexible_count": analysis.flexible_count if analysis else 0,
        }
        
        return constraints_list, analysis_summary
    
    @weave.op(name="generation_agent_load_requirements")
    async def load_requirements(
        self,
        session: AsyncSession,
        project_id: UUID
    ) -> Dict[str, Any]:
        """
        Load requirements for a project.
        """
        result = await session.execute(
            select(Requirements).where(Requirements.project_id == project_id)
        )
        req = result.scalar_one_or_none()
        
        if req:
            return {
                "space_type": req.space_type or "room",
                "style_targets": req.style_targets or ["modern"],
                "accessibility_required": req.accessibility_required,
                "budget_tier": req.budget_tier or "mid_range",
                "intended_use": req.intended_use,
            }
        
        return {
            "space_type": "room",
            "style_targets": ["modern"],
            "accessibility_required": False,
            "budget_tier": "mid_range",
            "intended_use": "personal",
        }
    
    @weave.op(name="generation_agent_load_reference_images")
    async def load_reference_images(
        self,
        session: AsyncSession,
        project_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        Load selected reference images for style guidance.
        
        These are images the user selected during the requirements phase
        to guide the style application in the generation process.
        """
        result = await session.execute(
            select(ReferenceImage)
            .where(
                ReferenceImage.project_id == project_id,
                ReferenceImage.is_selected == True
            )
            .order_by(ReferenceImage.selection_order)
        )
        images = result.scalars().all()
        
        return [
            {
                "url": img.url,
                "source": img.source_site or "web",
                "title": img.title or "Design inspiration",
            }
            for img in images
        ]
    
    def _build_reference_image_instructions(
        self,
        reference_images: List[Dict[str, Any]]
    ) -> str:
        """
        Build instructions for incorporating reference images into style generation.
        """
        if not reference_images:
            return ""
        
        instructions = ["\nREFERENCE IMAGES SELECTED BY USER:"]
        instructions.append("The user has selected the following images as style references.")
        instructions.append("Use these as visual guidance for the design aesthetic:\n")
        
        for i, img in enumerate(reference_images, 1):
            title = img.get("title", "Design inspiration")
            source = img.get("source", "web")
            instructions.append(f"Reference {i}: {title} (from {source})")
            instructions.append(f"  URL: {img.get('url', 'N/A')}")
        
        instructions.append("\nIncorporate the color palette, materials, fixtures style,")
        instructions.append("and overall aesthetic feeling from these reference images.")
        
        return "\n".join(instructions)
    
    def _build_constraint_instructions(
        self,
        constraints: List[Dict[str, Any]],
        emphasis: str = "high"
    ) -> str:
        """
        Build constraint instructions for prompts.
        """
        if not constraints:
            return "No specific spatial constraints identified."
        
        locked = [c for c in constraints if c["classification"] == ConstraintClassification.LOCKED]
        preferred = [c for c in constraints if c["classification"] == ConstraintClassification.PREFERRED]
        flexible = [c for c in constraints if c["classification"] == ConstraintClassification.FLEXIBLE]
        
        instructions = []
        
        if locked:
            instructions.append("LOCKED CONSTRAINTS (DO NOT CHANGE):")
            for c in locked:
                instructions.append(f"  - {c['element_type']} at {c['location']}: {c.get('notes', 'must remain fixed')}")
        
        if preferred and emphasis in ["medium", "high"]:
            instructions.append("\nPREFERRED ELEMENTS (preserve if possible):")
            for c in preferred:
                instructions.append(f"  - {c['element_type']} at {c['location']}")
        
        if flexible and emphasis == "high":
            instructions.append("\nFLEXIBLE ITEMS (can be changed/removed):")
            for c in flexible:
                instructions.append(f"  - {c['element_type']} at {c['location']}")
        
        return "\n".join(instructions)
    
    @weave.op(name="gemini_generate_image")
    async def generate_image(
        self,
        prompt: str,
        input_image_path: Optional[str] = None,
        creativity: float = 0.5
    ) -> Dict[str, Any]:
        """
        Call Gemini to generate/modify an image.
        Returns dict with output_path or error.
        """
        if not self.gemini_api_key:
            return {
                "success": False,
                "error": "GEMINI_API_KEY not configured",
            }
        
        start_time = time.time()
        
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent"
            
            # Build request parts
            parts = [{"text": prompt}]
            
            # Add input image if provided
            if input_image_path:
                if input_image_path.startswith("data:"):
                    header, encoded = input_image_path.split(",", 1)
                    mime_type = "image/jpeg"
                    if ";base64" in header:
                        mime_type = header[5:].split(";")[0] or mime_type
                    if encoded:
                        parts.insert(0, {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": encoded
                            }
                        })
                elif input_image_path.startswith(('http://', 'https://')):
                    # For URL images, instruct model to reference them
                    parts.insert(0, {
                        "text": f"Reference image URL: {input_image_path}\n\nBased on this reference:"
                    })
                elif Path(input_image_path).exists():
                    # Load and encode local file
                    with open(input_image_path, "rb") as f:
                        image_data = base64.standard_b64encode(f.read()).decode("utf-8")
                    
                    suffix = Path(input_image_path).suffix.lower()
                    mime_type = {
                        ".jpg": "image/jpeg",
                        ".jpeg": "image/jpeg",
                        ".png": "image/png",
                        ".webp": "image/webp",
                    }.get(suffix, "image/jpeg")
                    
                    parts.insert(0, {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": image_data
                        }
                    })
            
            payload = {
                "contents": [{"parts": parts}],
                "generationConfig": {
                    "temperature": creativity,
                    "topP": 0.9,
                    "maxOutputTokens": 8192,
                    "responseModalities": ["TEXT", "IMAGE"],
                    "imageConfig": {
                        "aspectRatio": self.image_aspect_ratio,
                        "imageSize": self.image_size,
                    },
                }
            }
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{url}?key={self.gemini_api_key}",
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                response.raise_for_status()
                result = response.json()
            
            latency_ms = int((time.time() - start_time) * 1000)
            
            # Extract response text (Gemini doesn't actually generate images yet,
            # but we'll structure this for when it does or for image editing APIs)
            parts_out = result.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            response_text = ""
            image_payload = None
            for part in parts_out:
                if not response_text and isinstance(part, dict) and part.get("text"):
                    response_text = part.get("text", "")
                if isinstance(part, dict):
                    if part.get("inline_data"):
                        image_payload = part["inline_data"]
                        break
                    if part.get("inlineData"):
                        image_payload = part["inlineData"]
                        break
            
            # Process and save any generated image
            output_path = None
            if image_payload and image_payload.get("data"):
                try:
                    image_bytes = base64.b64decode(image_payload["data"])
                    mime_type = image_payload.get("mime_type", "image/png")
                    ext = {
                        "image/png": "png",
                        "image/jpeg": "jpg",
                        "image/webp": "webp",
                    }.get(mime_type, "png")
                    # Better filename with timestamp for uniqueness
                    output_path = str(self.output_dir / f"gen_{int(time.time() * 1000)}.{ext}")
                    with open(output_path, "wb") as f:
                        f.write(image_bytes)
                    
                    print(f"[GenerationAgent] Saved image to: {output_path}")

                    try:
                        log_image_media(
                            output_path,
                            description=f"Generated image from {self.gemini_model}",
                            metadata={
                                "model": self.gemini_model,
                                "latency_ms": latency_ms,
                                "aspect_ratio": self.image_aspect_ratio,
                                "size": self.image_size,
                            }
                        )
                    except Exception:
                        pass
                except Exception as e:
                    print(f"[GenerationAgent] Failed to save image: {e}")
                    output_path = None
            else:
                return {
                    "success": False,
                    "error": "No image data returned by Gemini",
                    "latency_ms": latency_ms,
                    "model": self.gemini_model,
                }

            return {
                "success": True,
                "response_text": response_text,
                "latency_ms": latency_ms,
                "model": self.gemini_model,
                "output_path": output_path,
            }
            
        except httpx.HTTPStatusError as e:
            return {
                "success": False,
                "error": f"Gemini API error: {e.response.status_code}",
                "latency_ms": int((time.time() - start_time) * 1000),
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "latency_ms": int((time.time() - start_time) * 1000),
            }
    
    @weave.op(name="generation_agent_cleanup_phase")
    async def execute_cleanup_phase(
        self,
        session: AsyncSession,
        project_id: UUID,
        input_image: str,
        policy: Dict[str, Any],
        constraints: List[Dict[str, Any]],
        iteration_number: int = 1,
        scene_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Execute the cleanup phase - remove debris and distractions.
        """
        config = policy["cleanup_config"]
        
        # Build the prompt
        constraint_instructions = self._build_constraint_instructions(
            constraints, config.get("constraint_emphasis", "high")
        )
        
        prompt = config["prompt_template"].format(
            constraint_instructions=constraint_instructions
        )
        
        # Create iteration record
        iteration = Iteration(
            project_id=project_id,
            scene_id=scene_id,
            phase=GenerationPhase.CLEANUP,
            iteration_number=iteration_number,
            input_image_path=input_image,
            prompt_used=prompt,
            policy_version=policy.get("version", 1),
            status=IterationStatus.IN_PROGRESS,
        )
        session.add(iteration)
        await session.flush()
        
        # Generate
        result = await self.generate_image(
            prompt=prompt,
            input_image_path=input_image,
            creativity=config.get("creativity_level", 0.3)
        )
        
        # Update iteration
        iteration.generation_latency_ms = result.get("latency_ms")
        
        if result["success"]:
            output_path = result.get("output_path") or str(
                self.output_dir / f"{project_id}/{GenerationPhase.CLEANUP}_{iteration_number}_{int(time.time())}.png"
            )
            iteration.output_image_path = output_path
            iteration.status = IterationStatus.COMPLETED
            iteration.metadata_ = {"response": result.get("response_text", "")[:500]}
        else:
            iteration.status = IterationStatus.FAILED
            iteration.error_message = result.get("error")
        
        await session.flush()
        
        return {
            "phase": GenerationPhase.CLEANUP,
            "iteration_id": str(iteration.id),
            "input_path": input_image,
            "output_path": iteration.output_image_path,
            "success": result["success"],
            "error": result.get("error"),
            "latency_ms": result.get("latency_ms"),
        }
    
    @weave.op(name="generation_agent_structural_phase")
    async def execute_structural_phase(
        self,
        session: AsyncSession,
        project_id: UUID,
        input_image: str,
        policy: Dict[str, Any],
        constraints: List[Dict[str, Any]],
        iteration_number: int = 1,
        scene_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Execute the structural completion phase.
        """
        config = policy["structural_config"]
        
        constraint_instructions = self._build_constraint_instructions(
            constraints, config.get("constraint_emphasis", "high")
        )
        
        prompt = config["prompt_template"].format(
            constraint_instructions=constraint_instructions
        )
        
        iteration = Iteration(
            project_id=project_id,
            scene_id=scene_id,
            phase=GenerationPhase.STRUCTURAL,
            iteration_number=iteration_number,
            input_image_path=input_image,
            prompt_used=prompt,
            policy_version=policy.get("version", 1),
            status=IterationStatus.IN_PROGRESS,
        )
        session.add(iteration)
        await session.flush()
        
        result = await self.generate_image(
            prompt=prompt,
            input_image_path=input_image,
            creativity=config.get("creativity_level", 0.4)
        )
        
        iteration.generation_latency_ms = result.get("latency_ms")
        
        if result["success"]:
            output_path = result.get("output_path") or str(
                self.output_dir / f"{project_id}/{GenerationPhase.STRUCTURAL}_{iteration_number}_{int(time.time())}.png"
            )
            iteration.output_image_path = output_path
            iteration.status = IterationStatus.COMPLETED
            iteration.metadata_ = {"response": result.get("response_text", "")[:500]}
        else:
            iteration.status = IterationStatus.FAILED
            iteration.error_message = result.get("error")
        
        await session.flush()
        
        return {
            "phase": GenerationPhase.STRUCTURAL,
            "iteration_id": str(iteration.id),
            "input_path": input_image,
            "output_path": iteration.output_image_path,
            "success": result["success"],
            "error": result.get("error"),
            "latency_ms": result.get("latency_ms"),
        }
    
    @weave.op(name="generation_agent_fixture_phase")
    async def execute_fixture_phase(
        self,
        session: AsyncSession,
        project_id: UUID,
        input_image: str,
        policy: Dict[str, Any],
        constraints: List[Dict[str, Any]],
        requirements: Dict[str, Any],
        iteration_number: int = 1,
        scene_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Execute the fixture placement phase.
        """
        config = policy["fixture_config"]
        
        constraint_instructions = self._build_constraint_instructions(
            constraints, config.get("constraint_emphasis", "high")
        )
        
        prompt = config["prompt_template"].format(
            space_type=requirements.get("space_type", "room"),
            constraint_instructions=constraint_instructions
        )
        
        iteration = Iteration(
            project_id=project_id,
            scene_id=scene_id,
            phase=GenerationPhase.FIXTURE,
            iteration_number=iteration_number,
            input_image_path=input_image,
            prompt_used=prompt,
            policy_version=policy.get("version", 1),
            status=IterationStatus.IN_PROGRESS,
        )
        session.add(iteration)
        await session.flush()
        
        result = await self.generate_image(
            prompt=prompt,
            input_image_path=input_image,
            creativity=config.get("creativity_level", 0.5)
        )
        
        iteration.generation_latency_ms = result.get("latency_ms")
        
        if result["success"]:
            output_path = result.get("output_path") or str(
                self.output_dir / f"{project_id}/{GenerationPhase.FIXTURE}_{iteration_number}_{int(time.time())}.png"
            )
            iteration.output_image_path = output_path
            iteration.status = IterationStatus.COMPLETED
            iteration.metadata_ = {"response": result.get("response_text", "")[:500]}
        else:
            iteration.status = IterationStatus.FAILED
            iteration.error_message = result.get("error")
        
        await session.flush()
        
        return {
            "phase": GenerationPhase.FIXTURE,
            "iteration_id": str(iteration.id),
            "input_path": input_image,
            "output_path": iteration.output_image_path,
            "success": result["success"],
            "error": result.get("error"),
            "latency_ms": result.get("latency_ms"),
        }
    
    @weave.op(name="generation_agent_style_phase")
    async def execute_style_phase(
        self,
        session: AsyncSession,
        project_id: UUID,
        input_image: str,
        policy: Dict[str, Any],
        constraints: List[Dict[str, Any]],
        requirements: Dict[str, Any],
        target_style: str,
        iteration_number: int = 1,
        scene_id: Optional[UUID] = None,
        reference_images: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Execute the style application phase for a specific style.
        
        If reference_images are provided, they are incorporated into the prompt
        to guide the style application based on user-selected visual references.
        """
        config = policy["style_config"]
        
        constraint_instructions = self._build_constraint_instructions(
            constraints, config.get("constraint_emphasis", "medium")
        )
        
        # Get style-specific guidance
        style_guidance_map = config.get("style_guidance", DEFAULT_STYLE_CONFIG["style_guidance"])
        style_guidance = style_guidance_map.get(
            target_style.lower(),
            f"Apply {target_style} design principles throughout the space."
        )
        
        # Build reference image instructions if available
        reference_instructions = ""
        if reference_images:
            reference_instructions = self._build_reference_image_instructions(reference_images)
        
        prompt = config["prompt_template"].format(
            space_type=requirements.get("space_type", "room"),
            target_style=target_style,
            style_guidance=style_guidance,
            accessibility="Required - ensure ADA compliance" if requirements.get("accessibility_required") else "Standard design",
            budget_tier=requirements.get("budget_tier", "mid_range"),
            constraint_instructions=constraint_instructions
        )
        
        # Append reference image instructions if present
        if reference_instructions:
            prompt = prompt + "\n" + reference_instructions
        
        iteration = Iteration(
            project_id=project_id,
            scene_id=scene_id,
            phase=GenerationPhase.STYLE,
            iteration_number=iteration_number,
            input_image_path=input_image,
            prompt_used=prompt,
            policy_version=policy.get("version", 1),
            status=IterationStatus.IN_PROGRESS,
            metadata_={"target_style": target_style}
        )
        session.add(iteration)
        await session.flush()
        
        result = await self.generate_image(
            prompt=prompt,
            input_image_path=input_image,
            creativity=config.get("creativity_level", 0.7)
        )
        
        iteration.generation_latency_ms = result.get("latency_ms")
        
        if result["success"]:
            output_path = result.get("output_path") or str(
                self.output_dir / f"{project_id}/{GenerationPhase.STYLE}_{target_style}_{iteration_number}_{int(time.time())}.png"
            )
            iteration.output_image_path = output_path
            iteration.status = IterationStatus.COMPLETED
            iteration.metadata_ = {
                "target_style": target_style,
                "response": result.get("response_text", "")[:500]
            }
        else:
            iteration.status = IterationStatus.FAILED
            iteration.error_message = result.get("error")
        
        await session.flush()
        
        return {
            "phase": GenerationPhase.STYLE,
            "style": target_style,
            "iteration_id": str(iteration.id),
            "input_path": input_image,
            "output_path": iteration.output_image_path,
            "success": result["success"],
            "error": result.get("error"),
            "latency_ms": result.get("latency_ms"),
        }
    
    @weave.op(name="generation_agent_full_pipeline")
    async def run_full_pipeline(
        self,
        session: AsyncSession,
        project_id: UUID,
        input_image: str
    ) -> Dict[str, Any]:
        """
        Run the complete four-phase generation pipeline.
        
        Returns a dict with results from each phase.
        """
        results = {
            "project_id": str(project_id),
            "input_image": input_image,
            "phases": [],
            "style_variations": [],
            "total_latency_ms": 0,
            "success": True,
        }
        
        # Load policy, constraints, and requirements
        policy = await self.load_policy(session, project_id)
        constraints, analysis = await self.load_constraints(session, project_id)
        requirements = await self.load_requirements(session, project_id)
        
        results["policy_version"] = policy.get("version", 1)
        results["construction_state"] = analysis.get("construction_state")
        
        current_image = input_image
        
        # Update project status
        proj_result = await session.execute(
            select(Project).where(Project.id == project_id)
        )
        project = proj_result.scalar_one_or_none()
        if project:
            project.status = ProjectStatus.GENERATING
            await session.flush()
        
        # Phase 1: Cleanup
        cleanup_result = await self.execute_cleanup_phase(
            session, project_id, current_image, policy, constraints
        )
        results["phases"].append(cleanup_result)
        results["total_latency_ms"] += cleanup_result.get("latency_ms", 0)
        
        if cleanup_result["success"] and cleanup_result.get("output_path"):
            current_image = cleanup_result["output_path"]
        elif not cleanup_result["success"]:
            results["success"] = False
            results["error"] = f"Cleanup phase failed: {cleanup_result.get('error')}"
            return results
        
        # Phase 2: Structural
        structural_result = await self.execute_structural_phase(
            session, project_id, current_image, policy, constraints
        )
        results["phases"].append(structural_result)
        results["total_latency_ms"] += structural_result.get("latency_ms", 0)
        
        if structural_result["success"] and structural_result.get("output_path"):
            current_image = structural_result["output_path"]
        elif not structural_result["success"]:
            results["success"] = False
            results["error"] = f"Structural phase failed: {structural_result.get('error')}"
            return results
        
        # Phase 3: Fixture
        fixture_result = await self.execute_fixture_phase(
            session, project_id, current_image, policy, constraints, requirements
        )
        results["phases"].append(fixture_result)
        results["total_latency_ms"] += fixture_result.get("latency_ms", 0)
        
        if fixture_result["success"] and fixture_result.get("output_path"):
            current_image = fixture_result["output_path"]
        elif not fixture_result["success"]:
            results["success"] = False
            results["error"] = f"Fixture phase failed: {fixture_result.get('error')}"
            return results
        
        # Load reference images for style guidance
        reference_images = await self.load_reference_images(session, project_id)
        
        # Phase 4: Style (run for each target style)
        style_targets = requirements.get("style_targets", ["modern"])
        for i, style in enumerate(style_targets[:3]):  # Limit to 3 styles
            style_result = await self.execute_style_phase(
                session, project_id, current_image, policy, constraints,
                requirements, style, iteration_number=i + 1,
                reference_images=reference_images  # Pass reference images
            )
            results["style_variations"].append(style_result)
            results["total_latency_ms"] += style_result.get("latency_ms", 0)
            
            if not style_result["success"]:
                # Continue with other styles even if one fails
                pass
        
        # Track if reference images were used
        results["reference_images_used"] = len(reference_images) if reference_images else 0
        
        # Update project status
        if project:
            project.status = ProjectStatus.COMPLETED if results["success"] else ProjectStatus.FAILED
            await session.flush()
        
        return results


# ============================================
# Singleton Instance
# ============================================
generation_agent = GenerationAgent()
