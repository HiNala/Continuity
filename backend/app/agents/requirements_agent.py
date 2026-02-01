"""
Continuity - Requirements & Clarification Agent
Mission 02: Convert ambiguous user goals into structured specifications.

This agent is the gatekeeper of the entire system. It ensures that
user goals are well-defined before any expensive processing begins.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID

import weave
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import Project, Requirements, ProjectStatus


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
    """
    
    def __init__(self):
        self.max_questions = MAX_QUESTIONS
    
    @weave.op(name="requirements_agent_analyze_goal")
    def analyze_goal(self, goal_text: str) -> Dict[str, Any]:
        """
        Analyze the user's goal text to identify specified and missing information.
        
        Args:
            goal_text: The raw text goal from the user
            
        Returns:
            Dictionary with 'identified' and 'missing' information
        """
        goal_lower = goal_text.lower()
        
        identified = {}
        missing = []
        
        # Check for space type
        space_type = self._detect_space_type(goal_lower)
        if space_type:
            identified["space_type"] = space_type
        else:
            missing.append("space_type")
        
        # Check for styles
        styles = self._detect_styles(goal_lower)
        if styles:
            identified["styles"] = styles
        else:
            missing.append("styles")
        
        # Check for accessibility mentions
        if any(word in goal_lower for word in ["accessible", "accessibility", "ada", "wheelchair", "handicap"]):
            identified["accessibility"] = True
        else:
            missing.append("accessibility")
        
        # Check for budget mentions
        budget = self._detect_budget(goal_lower)
        if budget:
            identified["budget"] = budget
        else:
            missing.append("budget")
        
        # Check for intended use
        use = self._detect_intended_use(goal_lower)
        if use:
            identified["intended_use"] = use
        else:
            missing.append("intended_use")
        
        return {
            "original_goal": goal_text,
            "identified": identified,
            "missing": missing,
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
        
        Args:
            analysis: The output from analyze_goal()
            
        Returns:
            List of question objects, each with question_id, question_text, and possible_answers
        """
        missing = analysis.get("missing", [])
        questions = []
        
        # Map missing fields to questions
        field_to_question = {
            "space_type": SPACE_TYPE_QUESTION,
            "styles": STYLE_QUESTION,
            "accessibility": ACCESSIBILITY_QUESTION,
            "budget": BUDGET_QUESTION,
            "intended_use": INTENDED_USE_QUESTION,
        }
        
        # Add questions for missing fields, respecting the max limit
        for field in missing:
            if field in field_to_question and len(questions) < self.max_questions:
                questions.append(field_to_question[field])
        
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


# ============================================
# Singleton Instance
# ============================================
requirements_agent = RequirementsAgent()
