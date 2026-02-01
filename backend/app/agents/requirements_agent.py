"""
Continuity - Requirements & Clarification Agent
Mission 02: Convert ambiguous user goals into structured specifications.

This agent is the gatekeeper of the entire system. It ensures that
user goals are well-defined before any expensive processing begins.

Enhanced with smart image analysis to automatically detect:
- Space type (bathroom, kitchen, etc.) from visual cues
- Existing style elements in the space
- Accessibility features or requirements
- Construction state and renovation potential
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

from app.models import Project, Requirements, ProjectStatus
from app.config import settings


# ============================================
# Question Definitions
# ============================================
# Predefined questions and their possible answers
# This ensures consistency and makes the UI predictable

SPACE_TYPE_QUESTION = {
    "question_id": "space_type",
    "question_text": "What type of space is this?",
    "possible_answers": [
        {"answer_id": "bathroom", "answer_text": "Bathroom"},
        {"answer_id": "kitchen", "answer_text": "Kitchen"},
        {"answer_id": "bedroom", "answer_text": "Bedroom"},
        {"answer_id": "living_room", "answer_text": "Living Room"},
        {"answer_id": "office", "answer_text": "Office"},
        {"answer_id": "conference_room", "answer_text": "Conference Room"},
        {"answer_id": "retail", "answer_text": "Retail Space"},
        {"answer_id": "restaurant", "answer_text": "Restaurant"},
        {"answer_id": "lobby", "answer_text": "Lobby / Reception"},
        {"answer_id": "studio", "answer_text": "Studio / Loft"},
        {"answer_id": "gym", "answer_text": "Gym / Fitness"},
        {"answer_id": "classroom", "answer_text": "Classroom / Training"},
        {"answer_id": "clinic", "answer_text": "Clinic / Healthcare"},
        {"answer_id": "outdoor", "answer_text": "Outdoor / Patio"},
        {"answer_id": "other", "answer_text": "Other"},
    ]
}

STYLE_QUESTION = {
    "question_id": "styles",
    "question_text": "What design styles would you like to see? (Select up to 3)",
    "multi_select": True,
    "possible_answers": [
        {"answer_id": "modern", "answer_text": "Modern / Contemporary"},
        {"answer_id": "minimalist", "answer_text": "Minimalist"},
        {"answer_id": "industrial", "answer_text": "Industrial"},
        {"answer_id": "japandi", "answer_text": "Japandi"},
        {"answer_id": "scandinavian", "answer_text": "Scandinavian"},
        {"answer_id": "mid_century", "answer_text": "Mid-Century Modern"},
        {"answer_id": "traditional", "answer_text": "Traditional"},
        {"answer_id": "luxury", "answer_text": "Luxury / High-End"},
        {"answer_id": "rustic", "answer_text": "Rustic / Farmhouse"},
        {"answer_id": "coastal", "answer_text": "Coastal / Beach"},
    ]
}

ACCESSIBILITY_QUESTION = {
    "question_id": "accessibility",
    "question_text": "Does this space need to be ADA/accessibility compliant?",
    "possible_answers": [
        {"answer_id": "yes", "answer_text": "Yes, accessibility is required"},
        {"answer_id": "no", "answer_text": "No, standard design is fine"},
        {"answer_id": "preferred", "answer_text": "Preferred but not required"},
    ]
}

BUDGET_QUESTION = {
    "question_id": "budget",
    "question_text": "What budget tier should the designs target?",
    "possible_answers": [
        {"answer_id": "luxury", "answer_text": "Luxury / High-End"},
        {"answer_id": "mid_range", "answer_text": "Mid-Range"},
        {"answer_id": "budget", "answer_text": "Budget-Conscious"},
        {"answer_id": "any", "answer_text": "Show me options across tiers"},
    ]
}

INTENDED_USE_QUESTION = {
    "question_id": "intended_use",
    "question_text": "What will these visualizations be used for?",
    "possible_answers": [
        {"answer_id": "client_presentation", "answer_text": "Client Presentation"},
        {"answer_id": "internal_planning", "answer_text": "Internal Planning"},
        {"answer_id": "marketing", "answer_text": "Marketing / Sales"},
        {"answer_id": "personal", "answer_text": "Personal Use"},
    ]
}

# All questions in priority order
ALL_QUESTIONS = [
    SPACE_TYPE_QUESTION,
    STYLE_QUESTION,
    ACCESSIBILITY_QUESTION,
    BUDGET_QUESTION,
    INTENDED_USE_QUESTION,
]

# Maximum questions to ask
MAX_QUESTIONS = 5

# Confidence threshold for auto-detected information
# If detection confidence is below this, we still ask the user
CONFIDENCE_THRESHOLD = 0.75


# ============================================
# Image Analysis Prompt
# ============================================
# This prompt is designed to extract requirements-relevant information from images
IMAGE_ANALYSIS_PROMPT = """You are an expert at analyzing interior space photographs to determine 
room type and design context. Analyze this image and identify the following:

1. **Space Type**: What kind of room is this? Look for distinctive features:
   - Bathroom: toilet, sink, shower/tub, tiles
   - Kitchen: stove, refrigerator, countertops, cabinets
   - Bedroom: bed, closet, nightstands
   - Living Room: couch, TV area, open space
   - Office: desk, computer, office chair
   - Conference Room: large table, multiple chairs, presentation equipment
   - Retail: shelves, product displays, checkout
   - Restaurant/Cafe: dining tables, bar, service counter
   - Lobby/Reception: front desk, waiting area
   - Studio/Loft: open plan, multi-use space
   - Gym/Fitness: equipment, mats, mirrors
   - Classroom/Training: desks, whiteboards, projector
   - Clinic/Healthcare: exam tables, medical equipment
   - Outdoor/Patio: open air, patio furniture, landscaping
   - Other: any other type

2. **Existing Style Indicators**: What design elements are visible?
   - Modern/Contemporary: clean lines, minimal ornamentation
   - Traditional: ornate details, classic furniture
   - Industrial: exposed brick, metal, pipes
   - Minimalist: very sparse, neutral colors
   - Other styles visible

3. **Construction State**: 
   - Unfinished: exposed studs, no finishes
   - Under renovation: partial work done
   - Existing finish: complete space

4. **Accessibility Indicators**:
   - Grab bars visible
   - Wide doorways
   - Wheelchair accessible features
   - No accessibility features visible

Return your analysis as JSON in this exact format:
```json
{
  "space_type": {
    "detected": "bathroom|kitchen|bedroom|living_room|office|conference_room|retail|restaurant|lobby|studio|gym|classroom|clinic|outdoor|other",
    "confidence": 0.0-1.0,
    "reasoning": "Brief explanation of why you identified this space type"
  },
  "existing_styles": [
    {
      "style": "modern|minimalist|industrial|traditional|etc",
      "confidence": 0.0-1.0,
      "indicators": ["list of visible indicators"]
    }
  ],
  "construction_state": "unfinished|under_renovation|existing_finish",
  "accessibility_features": {
    "visible": true|false,
    "features": ["list of visible features"],
    "confidence": 0.0-1.0
  },
  "additional_notes": "Any other relevant observations about the space"
}
```

Be thorough but only report what you can clearly see. If uncertain, reflect this in lower confidence scores."""


# ============================================
# Keyword Detection Patterns
# ============================================
# Used to detect already-specified information in user goals

SPACE_TYPE_PATTERNS = {
    "bathroom": ["bathroom", "bath", "restroom", "washroom", "lavatory", "powder room"],
    "kitchen": ["kitchen", "kitchenette", "cooking"],
    "bedroom": ["bedroom", "master bedroom", "guest room", "sleeping"],
    "living_room": ["living room", "lounge", "family room", "great room", "sitting room"],
    "office": ["office", "workspace", "home office", "study"],
    "conference_room": ["conference room", "meeting room", "boardroom"],
    "retail": ["retail", "store", "shop", "showroom"],
    "restaurant": ["restaurant", "cafe", "dining", "eatery"],
    "lobby": ["lobby", "reception", "front desk", "entry hall"],
    "studio": ["studio", "loft", "open plan"],
    "gym": ["gym", "fitness", "workout", "exercise"],
    "classroom": ["classroom", "training room", "learning space", "lecture"],
    "clinic": ["clinic", "healthcare", "medical", "exam room"],
    "outdoor": ["outdoor", "patio", "terrace", "balcony", "courtyard"],
}

STYLE_PATTERNS = {
    "modern": ["modern", "contemporary", "sleek", "current"],
    "minimalist": ["minimalist", "minimal", "simple", "clean lines"],
    "industrial": ["industrial", "loft", "exposed brick", "warehouse"],
    "japandi": ["japandi", "japanese", "zen"],
    "scandinavian": ["scandinavian", "nordic", "scandi", "hygge"],
    "mid_century": ["mid-century", "mid century", "retro", "60s", "70s"],
    "traditional": ["traditional", "classic", "timeless", "elegant"],
    "luxury": ["luxury", "luxurious", "high-end", "premium", "upscale"],
    "rustic": ["rustic", "farmhouse", "country", "cottage"],
    "coastal": ["coastal", "beach", "nautical", "seaside"],
}


# ============================================
# Requirements Agent Class
# ============================================
class RequirementsAgent:
    """
    The Requirements Agent analyzes user goals and generates
    clarifying questions to produce structured specifications.
    
    Enhanced with smart image analysis to automatically detect
    space type and other context from uploaded images before
    asking the user questions.
    """
    
    def __init__(self):
        self.max_questions = MAX_QUESTIONS
        self.gemini_api_key = settings.gemini_api_key
        self.gemini_model = settings.gemini_vision_model or settings.gemini_model
    
    # ============================================
    # Image Analysis Methods
    # ============================================
    
    def _prepare_image(self, image_path: str) -> Optional[Dict[str, Any]]:
        """
        Prepare an image for Gemini vision API.
        
        Args:
            image_path: Path to local file or URL
            
        Returns:
            Dict with image data ready for API, or None if failed
        """
        try:
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
                return {"type": "url", "url": image_path}
            else:
                # Read local file and encode as base64
                file_path = Path(image_path)
                if not file_path.exists():
                    return None
                
                with open(file_path, "rb") as f:
                    image_data = base64.standard_b64encode(f.read()).decode("utf-8")
                
                # Determine mime type
                suffix = file_path.suffix.lower()
                mime_map = {
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".png": "image/png",
                    ".gif": "image/gif",
                    ".webp": "image/webp",
                }
                mime_type = mime_map.get(suffix, "image/jpeg")
                
                return {
                    "type": "base64",
                    "data": image_data,
                    "mime_type": mime_type,
                }
        except Exception as e:
            print(f"Error preparing image {image_path}: {e}")
            return None
    
    @weave.op(name="requirements_agent_analyze_image")
    async def analyze_image(self, image_path: str) -> Optional[Dict[str, Any]]:
        """
        Analyze a single image to detect space type and context.
        
        Args:
            image_path: Path or URL to the image
            
        Returns:
            Analysis results or None if analysis failed
        """
        if not self.gemini_api_key:
            print("Warning: No Gemini API key configured for image analysis")
            return None
        
        image_data = self._prepare_image(image_path)
        if not image_data:
            return None
        
        try:
            # Build the request for Gemini
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent"
            
            # Build the parts based on image type
            if image_data["type"] == "url":
                image_part = {
                    "file_data": {
                        "file_uri": image_data["url"],
                        "mime_type": "image/jpeg"
                    }
                }
            else:
                image_part = {
                    "inline_data": {
                        "mime_type": image_data["mime_type"],
                        "data": image_data["data"]
                    }
                }
            
            request_body = {
                "contents": [{
                    "parts": [
                        image_part,
                        {"text": IMAGE_ANALYSIS_PROMPT}
                    ]
                }],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 2048,
                }
            }
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    url,
                    json=request_body,
                    params={"key": self.gemini_api_key},
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code != 200:
                    print(f"Gemini API error: {response.status_code} - {response.text}")
                    return None
                
                result = response.json()
            
            # Extract the text response
            if "candidates" not in result or not result["candidates"]:
                return None
            
            text_response = result["candidates"][0]["content"]["parts"][0]["text"]
            
            # Parse JSON from the response
            json_start = text_response.find("{")
            json_end = text_response.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                json_str = text_response[json_start:json_end]
                analysis = json.loads(json_str)
                return analysis
            
            return None
            
        except Exception as e:
            print(f"Error analyzing image: {e}")
            return None
    
    @weave.op(name="requirements_agent_analyze_images")
    async def analyze_images(self, images: List[str]) -> Dict[str, Any]:
        """
        Analyze multiple images and combine results.
        
        Args:
            images: List of image paths or URLs
            
        Returns:
            Combined analysis results
        """
        if not images:
            return {"analyzed": False, "results": []}
        
        results = []
        for image_path in images[:3]:  # Analyze up to 3 images
            analysis = await self.analyze_image(image_path)
            if analysis:
                results.append(analysis)
        
        if not results:
            return {"analyzed": False, "results": []}
        
        # Combine results, using highest confidence for each field
        combined = {
            "analyzed": True,
            "results": results,
            "space_type": None,
            "space_type_confidence": 0.0,
            "existing_styles": [],
            "accessibility_visible": False,
            "construction_state": None,
        }
        
        # Find best space type detection
        for r in results:
            if "space_type" in r and r["space_type"].get("confidence", 0) > combined["space_type_confidence"]:
                combined["space_type"] = r["space_type"]["detected"]
                combined["space_type_confidence"] = r["space_type"]["confidence"]
                combined["space_type_reasoning"] = r["space_type"].get("reasoning", "")
        
        # Collect all detected styles
        all_styles = []
        for r in results:
            if "existing_styles" in r:
                for style in r["existing_styles"]:
                    if style.get("confidence", 0) >= 0.5:
                        all_styles.append(style["style"])
        combined["existing_styles"] = list(set(all_styles))
        
        # Check for accessibility features
        for r in results:
            if "accessibility_features" in r and r["accessibility_features"].get("visible"):
                combined["accessibility_visible"] = True
                combined["accessibility_features"] = r["accessibility_features"].get("features", [])
                break
        
        # Get construction state
        for r in results:
            if "construction_state" in r:
                combined["construction_state"] = r["construction_state"]
                break
        
        return combined
    
    # ============================================
    # Goal Analysis Methods
    # ============================================
    
    @weave.op(name="requirements_agent_analyze_goal")
    def analyze_goal(self, goal_text: str, image_analysis: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Analyze the user's goal text AND image analysis results to identify 
        specified and missing information.
        
        This method combines:
        1. Text analysis from the user's goal description
        2. Visual analysis from uploaded images (if available)
        
        Information detected with high confidence from images will NOT
        generate clarifying questions - we only ask about truly ambiguous items.
        
        Args:
            goal_text: The raw text goal from the user
            image_analysis: Results from analyze_images() if images were provided
            
        Returns:
            Dictionary with 'identified', 'missing', and 'auto_detected' information
        """
        goal_lower = goal_text.lower()
        
        identified = {}
        auto_detected = {}  # Track what was detected from images
        missing = []
        
        # ============================================
        # 1. Check for space type
        # ============================================
        space_type = self._detect_space_type(goal_lower)
        
        # Also check image analysis for space type
        image_space_type = None
        image_space_confidence = 0.0
        if image_analysis and image_analysis.get("analyzed"):
            image_space_type = image_analysis.get("space_type")
            image_space_confidence = image_analysis.get("space_type_confidence", 0.0)
        
        if space_type:
            # User explicitly mentioned space type in text
            identified["space_type"] = space_type
            identified["space_type_source"] = "text"
        elif image_space_type and image_space_confidence >= CONFIDENCE_THRESHOLD:
            # High-confidence detection from image - auto-fill
            identified["space_type"] = image_space_type
            identified["space_type_source"] = "image"
            auto_detected["space_type"] = {
                "value": image_space_type,
                "confidence": image_space_confidence,
                "reasoning": image_analysis.get("space_type_reasoning", "Detected from uploaded image")
            }
        elif image_space_type and image_space_confidence >= 0.5:
            # Medium confidence - include but still ask for confirmation
            auto_detected["space_type_suggestion"] = {
                "value": image_space_type,
                "confidence": image_space_confidence,
            }
            missing.append("space_type")
        else:
            missing.append("space_type")
        
        # ============================================
        # 2. Check for styles
        # ============================================
        styles = self._detect_styles(goal_lower)
        
        # Also check image analysis for existing styles
        image_styles = []
        if image_analysis and image_analysis.get("analyzed"):
            image_styles = image_analysis.get("existing_styles", [])
        
        if styles:
            identified["styles"] = styles
        elif image_styles:
            # Suggest styles based on what's visible but still ask
            auto_detected["style_suggestions"] = image_styles
            missing.append("styles")
        else:
            missing.append("styles")
        
        # ============================================
        # 3. Check for accessibility mentions
        # ============================================
        if any(word in goal_lower for word in ["accessible", "accessibility", "ada", "wheelchair", "handicap"]):
            identified["accessibility"] = True
        elif image_analysis and image_analysis.get("accessibility_visible"):
            # Accessibility features visible in image
            auto_detected["accessibility_visible"] = {
                "features": image_analysis.get("accessibility_features", [])
            }
            # Still ask to confirm requirement, but note what we saw
            missing.append("accessibility")
        else:
            missing.append("accessibility")
        
        # ============================================
        # 4. Check for budget mentions (can only come from text)
        # ============================================
        budget = self._detect_budget(goal_lower)
        if budget:
            identified["budget"] = budget
        else:
            missing.append("budget")
        
        # ============================================
        # 5. Check for intended use (can only come from text)
        # ============================================
        use = self._detect_intended_use(goal_lower)
        if use:
            identified["intended_use"] = use
        else:
            missing.append("intended_use")
        
        return {
            "original_goal": goal_text,
            "identified": identified,
            "auto_detected": auto_detected,
            "missing": missing,
            "image_analysis_used": image_analysis is not None and image_analysis.get("analyzed", False),
            "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
        }
    
    def _detect_space_type(self, text: str) -> Optional[str]:
        """Detect space type from text."""
        for space_type, keywords in SPACE_TYPE_PATTERNS.items():
            if any(keyword in text for keyword in keywords):
                return space_type
        return None
    
    def _detect_styles(self, text: str) -> List[str]:
        """Detect style preferences from text."""
        detected = []
        for style, keywords in STYLE_PATTERNS.items():
            if any(keyword in text for keyword in keywords):
                detected.append(style)
        return detected
    
    def _detect_budget(self, text: str) -> Optional[str]:
        """Detect budget tier from text."""
        if any(word in text for word in ["luxury", "high-end", "premium", "expensive"]):
            return "luxury"
        elif any(word in text for word in ["budget", "affordable", "cheap", "economical"]):
            return "budget"
        elif any(word in text for word in ["mid-range", "moderate", "reasonable"]):
            return "mid_range"
        return None
    
    def _detect_intended_use(self, text: str) -> Optional[str]:
        """Detect intended use from text."""
        if any(word in text for word in ["client", "presentation", "show client"]):
            return "client_presentation"
        elif any(word in text for word in ["marketing", "sales", "listing", "advertisement"]):
            return "marketing"
        elif any(word in text for word in ["planning", "internal", "team"]):
            return "internal_planning"
        elif any(word in text for word in ["personal", "my own", "myself"]):
            return "personal"
        return None
    
    @weave.op(name="requirements_agent_generate_questions")
    def generate_questions(self, analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Generate clarifying questions based on what information is missing.
        
        This method is smarter about what questions to ask:
        - Skips questions for high-confidence auto-detected information
        - Provides context about suggestions when we detected something
        - Only asks truly necessary questions
        
        Args:
            analysis: The output from analyze_goal()
            
        Returns:
            List of question objects, each with question_id, question_text, and possible_answers
        """
        missing = analysis.get("missing", [])
        auto_detected = analysis.get("auto_detected", {})
        questions = []
        
        # Map missing fields to questions
        field_to_question = {
            "space_type": SPACE_TYPE_QUESTION,
            "styles": STYLE_QUESTION,
            "accessibility": ACCESSIBILITY_QUESTION,
            "budget": BUDGET_QUESTION,
            "intended_use": INTENDED_USE_QUESTION,
        }
        
        # Add questions for missing fields, with smart modifications
        for field in missing:
            if field not in field_to_question or len(questions) >= self.max_questions:
                continue
            
            question = field_to_question[field].copy()
            
            # Enhance questions with auto-detected context
            if field == "space_type" and "space_type_suggestion" in auto_detected:
                suggestion = auto_detected["space_type_suggestion"]
                suggested_type = suggestion["value"]
                confidence = suggestion["confidence"]
                # Add a note about what we detected
                question = {
                    **question,
                    "question_text": f"We detected this might be a {suggested_type.replace('_', ' ')} ({int(confidence * 100)}% confident). Is that correct, or is it a different type of space?",
                    "suggested_answer": suggested_type,
                }
            
            elif field == "styles" and "style_suggestions" in auto_detected:
                suggestions = auto_detected["style_suggestions"]
                if suggestions:
                    style_names = [s.replace('_', ' ').title() for s in suggestions[:2]]
                    question = {
                        **question,
                        "question_text": f"We noticed some {', '.join(style_names)} elements in your space. What design styles would you like to see? (Select up to 3)",
                        "suggested_answers": suggestions,
                    }
            
            elif field == "accessibility" and "accessibility_visible" in auto_detected:
                features = auto_detected["accessibility_visible"].get("features", [])
                if features:
                    question = {
                        **question,
                        "question_text": f"We noticed some accessibility features ({', '.join(features[:2])}). Does this space need to be ADA/accessibility compliant?",
                    }
            
            questions.append(question)
        
        return questions

    @weave.op(name="requirements_agent_generate_batch_questions")
    def generate_batch_questions(
        self,
        analysis: Dict[str, Any],
        image_analysis: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate cross-scene questions for batch uploads.

        This avoids repeating per-image questions and focuses on shared
        preferences or key differences across scenes.
        """
        if not image_analysis or not image_analysis.get("analyzed"):
            return []

        results = image_analysis.get("results", [])
        if len(results) < 2:
            return []

        questions: List[Dict[str, Any]] = []

        def add_question(question_id: str, text: str, answers: List[Dict[str, str]], multi_select: bool = False):
            questions.append({
                "question_id": question_id,
                "question_text": text,
                "possible_answers": answers,
                "multi_select": multi_select,
                "question_type": "batch",
                "scene_scope": "all",
            })

        # Collect detected space types and construction states
        space_types = [
            r.get("space_type", {}).get("detected")
            for r in results
            if r.get("space_type", {}).get("detected")
        ]
        construction_states = [
            r.get("construction_state", {}).get("state")
            for r in results
            if r.get("construction_state", {}).get("state")
        ]

        unique_spaces = sorted(set(space_types))
        if len(unique_spaces) > 1:
            add_question(
                "batch_unify_style",
                f"These images span multiple space types ({', '.join(s.replace('_', ' ') for s in unique_spaces)}). Should the style be consistent across all scenes or tailored per space?",
                [
                    {"answer_id": "consistent", "answer_text": "Use a consistent style across all scenes"},
                    {"answer_id": "tailored", "answer_text": "Tailor the style per space type"},
                ]
            )

        if len(set(construction_states)) > 1:
            add_question(
                "batch_construction_priority",
                "The batch includes scenes with different construction states. Which should we prioritize for the strongest transformations?",
                [
                    {"answer_id": "unfinished", "answer_text": "Unfinished spaces"},
                    {"answer_id": "partially_complete", "answer_text": "Partially complete spaces"},
                    {"answer_id": "existing_finish", "answer_text": "Existing finished spaces"},
                    {"answer_id": "all_equal", "answer_text": "Treat all scenes equally"},
                ]
            )

        # Style preference for the batch if not already identified
        if not analysis.get("identified", {}).get("styles"):
            add_question(
                "batch_style_targets",
                "What styles should apply across the batch? (Select up to 3)",
                STYLE_QUESTION["possible_answers"],
                multi_select=True,
            )

        # Budget/priority question to avoid repetition
        if not analysis.get("identified", {}).get("budget"):
            add_question(
                "batch_budget_tier",
                "For this set of images, what budget tier should guide all scenes?",
                BUDGET_QUESTION["possible_answers"],
            )

        # Accessibility question if any scene suggests features
        if image_analysis.get("accessibility_visible"):
            add_question(
                "batch_accessibility",
                "We noticed accessibility features in at least one image. Should the entire batch be ADA/accessibility compliant?",
                ACCESSIBILITY_QUESTION["possible_answers"],
            )

        return questions
    
    @weave.op(name="requirements_agent_process_responses")
    def process_responses(
        self,
        analysis: Dict[str, Any],
        responses: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process user's answers to create the final structured specification.
        
        Args:
            analysis: The output from analyze_goal()
            responses: Dictionary mapping question_id to selected answer_id(s)
            
        Returns:
            Complete structured requirements specification
        """
        identified = analysis.get("identified", {})
        
        # Build the specification, using identified values or responses
        spec = {
            "original_goal": analysis.get("original_goal", ""),
            "space_type": identified.get("space_type") or responses.get("space_type"),
            "style_targets": identified.get("styles") or responses.get("styles", []),
            "accessibility_required": self._process_accessibility(
                identified.get("accessibility"),
                responses.get("accessibility")
            ),
            "budget_tier": identified.get("budget") or responses.get("budget"),
            "intended_use": identified.get("intended_use") or responses.get("intended_use"),
            "clarification_responses": responses,
            "questions_asked": len(responses),
            "analysis_complete": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        
        # Ensure style_targets is a list
        if isinstance(spec["style_targets"], str):
            styles = [s.strip() for s in spec["style_targets"].split(",") if s.strip()]
            spec["style_targets"] = styles or [spec["style_targets"]]
        
        return spec
    
    def _process_accessibility(
        self,
        identified: Optional[bool],
        response: Optional[str]
    ) -> bool:
        """Process accessibility requirement."""
        if identified is not None:
            return identified
        if response == "yes":
            return True
        if response == "preferred":
            return True  # Treat preferred as true for generation
        return False
    
    @weave.op(name="requirements_agent_save_requirements")
    async def save_requirements(
        self,
        session: AsyncSession,
        project_id: UUID,
        specification: Dict[str, Any]
    ) -> Requirements:
        """
        Save the structured requirements to the database.
        
        Args:
            session: Database session
            project_id: The project ID
            specification: The output from process_responses()
            
        Returns:
            The created Requirements record
        """
        requirements = Requirements(
            project_id=project_id,
            original_goal=specification["original_goal"],
            space_type=specification.get("space_type"),
            style_targets=specification.get("style_targets", []),
            accessibility_required=specification.get("accessibility_required", False),
            budget_tier=specification.get("budget_tier"),
            intended_use=specification.get("intended_use"),
            clarification_responses=specification.get("clarification_responses", {}),
            questions_asked=specification.get("questions_asked", 0),
            analysis_complete=True,
        )
        
        session.add(requirements)
        await session.flush()
        
        # Update project status
        result = await session.execute(
            select(Project).where(Project.id == project_id)
        )
        project = result.scalar_one_or_none()
        if project:
            project.status = ProjectStatus.REQUIREMENTS_GATHERING
        
        return requirements


    @weave.op(name="requirements_agent_fetch_inspiration")
    async def fetch_inspiration(
        self,
        goal: str,
        space_type: Optional[str] = None,
        styles: Optional[List[str]] = None,
        limit: int = 8
    ) -> Dict[str, Any]:
        """
        Fetch design inspiration images to help user define their vision.
        
        Uses Browserbase to search for relevant design images based on
        the user's goal and detected preferences. This helps users
        visualize and refine their requirements.
        
        Args:
            goal: The user's design goal
            space_type: Detected or specified space type
            styles: Detected or specified style preferences
            limit: Number of images to return
            
        Returns:
            Dict with inspiration images organized by category
        """
        from app.browserbase_service import browserbase_service
        
        result = {
            "inspiration_available": True,
            "style_inspiration": [],
            "space_inspiration": [],
            "general_inspiration": [],
        }
        
        try:
            # Fetch style-specific inspiration if styles are detected/specified
            if styles:
                for style in styles[:2]:  # Limit to 2 styles
                    style_images = await browserbase_service.fetch_inspiration_images(
                        query=f"{style} interior design",
                        style=style,
                        space_type=space_type,
                        limit=4,
                    )
                    if style_images.get("success"):
                        result["style_inspiration"].append({
                            "style": style,
                            "images": style_images.get("images", [])[:4],
                        })
            
            # Fetch space-specific inspiration
            if space_type:
                space_images = await browserbase_service.fetch_inspiration_images(
                    query=f"{space_type} design",
                    space_type=space_type,
                    limit=4,
                )
                if space_images.get("success"):
                    result["space_inspiration"] = space_images.get("images", [])[:4]
            
            # Fetch general inspiration based on goal
            if goal:
                general_images = await browserbase_service.fetch_inspiration_images(
                    query=goal[:100],  # Limit query length
                    style=styles[0] if styles else None,
                    space_type=space_type,
                    limit=limit,
                )
                if general_images.get("success"):
                    result["general_inspiration"] = general_images.get("images", [])
            
        except Exception as e:
            print(f"Error fetching inspiration: {e}")
            result["inspiration_available"] = False
            result["error"] = str(e)
        
        return result
    
    @weave.op(name="requirements_agent_analyze_with_inspiration")
    async def analyze_goal_with_inspiration(
        self,
        goal: str,
        images: List[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze goal AND fetch relevant inspiration images.
        
        This is the enhanced version of analyze_goal that also fetches
        inspiration images to help users better define their vision.
        
        Args:
            goal: The user's design goal
            images: Optional uploaded images
            
        Returns:
            Analysis results plus inspiration images
        """
        # First, do the standard goal analysis
        analysis = await self.analyze_goal(goal, images)
        
        # Extract detected values for inspiration search
        identified = analysis.get("identified", {})
        auto_detected = analysis.get("auto_detected", {})
        
        space_type = identified.get("space_type")
        if not space_type and "space_type_suggestion" in auto_detected:
            space_type = auto_detected["space_type_suggestion"]["value"]
        
        styles = identified.get("styles", [])
        if not styles and "style_suggestions" in auto_detected:
            styles = auto_detected["style_suggestions"]
        
        # Fetch inspiration images
        inspiration = await self.fetch_inspiration(
            goal=goal,
            space_type=space_type,
            styles=styles,
            limit=8,
        )
        
        # Add inspiration to the analysis result
        analysis["inspiration"] = inspiration
        
        return analysis


# ============================================
# Singleton Instance
# ============================================
requirements_agent = RequirementsAgent()
