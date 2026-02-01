"""
Test batch pattern detection for an existing project.
Set BATCH_PROJECT_ID before running.
"""
import asyncio
import os

from app.database import AsyncSessionLocal
from app.orchestrator import Orchestrator


async def main() -> None:
    project_id = os.getenv("BATCH_PROJECT_ID")
    if not project_id:
        print("Set BATCH_PROJECT_ID to an existing batch project ID.")
        return

    async with AsyncSessionLocal() as session:
        orchestrator = Orchestrator(session, project_id)
        patterns = await orchestrator.get_batch_patterns()

    print("🔍 BATCH PATTERN DETECTION")
    print("=" * 60)
    print(f"Detected {len(patterns)} patterns:\n")
    for pattern in patterns:
        print(f"- {pattern['pattern_type']}: {pattern['description']}")
        print(f"  Frequency: {pattern['frequency']:.0%}")
        print(f"  Scenes: {', '.join(pattern['supporting_scenes'])}")
        print()


if __name__ == "__main__":
    asyncio.run(main())
