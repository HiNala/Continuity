"""
Test batch question intelligence without running the server.
"""
import asyncio

from app.agents.requirements_agent import requirements_agent


async def main() -> None:
    analysis = {
        "identified": {},
        "missing": ["styles", "budget"],
    }
    image_analysis = {
        "analyzed": True,
        "results": [
            {
                "space_type": {"detected": "kitchen"},
                "construction_state": {"state": "existing_finish"},
            },
            {
                "space_type": {"detected": "kitchen"},
                "construction_state": {"state": "partially_complete"},
            },
            {
                "space_type": {"detected": "dining"},
                "construction_state": {"state": "existing_finish"},
            },
        ],
        "accessibility_visible": False,
    }

    questions = requirements_agent.generate_batch_questions(analysis, image_analysis=image_analysis)

    print("🧠 BATCH INTELLIGENCE TEST")
    print("=" * 60)
    print(f"Generated {len(questions)} questions:\n")
    for idx, q in enumerate(questions, 1):
        print(f"{idx}. {q['question_text']}")
        print(f"   Type: {q.get('question_type')}")
        print(f"   Scope: {q.get('scene_scope')}")
        print()

    if not questions:
        raise SystemExit("No batch questions generated. Check input analysis.")


if __name__ == "__main__":
    asyncio.run(main())
