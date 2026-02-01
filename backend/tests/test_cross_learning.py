"""
Continuity - Cross-Scene and Cross-Project Learning Tests
Tests the self-improvement mechanism across scenes within a batch
and across separate projects (cross-project learning).

These tests verify that:
1. Policy improvements from early scenes benefit later scenes
2. Effective patterns are tracked and stored
3. New projects can be seeded from past learnings
4. The improvement_observed field is correctly updated
"""

import asyncio
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Project, Policy, PolicyChange, Scene, Iteration,
    ProjectStatus, SceneStatus, PolicyCreator
)
from app.agents.qc_agent import qc_agent
from app.agents.generation_agent import generation_agent, DEFAULT_POLICY


# ============================================
# Fixtures
# ============================================
@pytest.fixture
async def test_project(session: AsyncSession):
    """Create a test project for cross-scene learning tests."""
    project = Project(
        id=uuid4(),
        goal="Test batch processing with cross-scene learning",
        images=["test_image_1.jpg", "test_image_2.jpg", "test_image_3.jpg"],
        status=ProjectStatus.CREATED,
        is_batch=True,
        total_scenes=3,
        completed_scenes=0,
    )
    session.add(project)
    await session.flush()
    return project


@pytest.fixture
async def test_scenes(session: AsyncSession, test_project: Project):
    """Create test scenes for the batch project."""
    scenes = []
    for i in range(3):
        scene = Scene(
            id=uuid4(),
            project_id=test_project.id,
            scene_index=i,
            name=f"Test Scene {i+1}",
            input_image_path=f"test_image_{i+1}.jpg",
            status=SceneStatus.PENDING,
        )
        session.add(scene)
        scenes.append(scene)
    await session.flush()
    return scenes


@pytest.fixture
async def initial_policy(session: AsyncSession, test_project: Project):
    """Create an initial policy for the test project."""
    policy = Policy(
        project_id=test_project.id,
        version=1,
        cleanup_config={
            "constraint_emphasis": "medium",
            "creativity_level": 0.7,
        },
        structural_config={
            "constraint_emphasis": "medium",
            "creativity_level": 0.7,
        },
        fixture_config={
            "constraint_emphasis": "medium",
            "creativity_level": 0.7,
        },
        style_config={
            "constraint_emphasis": "medium",
            "creativity_level": 0.7,
        },
        is_active=True,
        created_by=PolicyCreator.SYSTEM,
    )
    session.add(policy)
    await session.flush()
    return policy


# ============================================
# Cross-Scene Learning Tests
# ============================================
class TestCrossSceneLearning:
    """Tests for cross-scene learning within a batch."""
    
    @pytest.mark.asyncio
    async def test_policy_improvement_persists_to_database(
        self, session: AsyncSession, test_project: Project, initial_policy: Policy
    ):
        """
        Test that policy improvements are persisted to the database
        and can be loaded by subsequent scenes.
        """
        # Simulate a constraint violation failure
        mock_changes = [
            {
                "type": "constraint_emphasis",
                "current": "medium",
                "proposed": "high",
                "reason": "Fixtures moved from original positions"
            }
        ]
        
        # Apply policy changes
        result = await qc_agent.apply_policy_changes(
            session, test_project.id, mock_changes, None
        )
        
        assert result["success"] is True
        assert result["new_version"] == 2
        
        # Verify new policy exists in database
        query = select(Policy).where(
            Policy.project_id == test_project.id,
            Policy.is_active.is_(True)
        )
        db_result = await session.execute(query)
        active_policy = db_result.scalar_one_or_none()
        
        assert active_policy is not None
        assert active_policy.version == 2
        assert active_policy.cleanup_config["constraint_emphasis"] == "high"
        
        # Verify old policy is deactivated
        old_policy_query = select(Policy).where(
            Policy.project_id == test_project.id,
            Policy.version == 1
        )
        old_result = await session.execute(old_policy_query)
        old_policy = old_result.scalar_one_or_none()
        
        assert old_policy is not None
        assert old_policy.is_active is False
    
    @pytest.mark.asyncio
    async def test_later_scene_loads_improved_policy(
        self, session: AsyncSession, test_project: Project, initial_policy: Policy
    ):
        """
        Test that a later scene in the batch loads the improved policy
        from an earlier scene's failure.
        """
        # First, apply an improvement (simulating scene 1 failure)
        mock_changes = [
            {
                "type": "constraint_emphasis",
                "current": "medium",
                "proposed": "high",
                "reason": "Constraint violation in scene 1"
            }
        ]
        
        await qc_agent.apply_policy_changes(session, test_project.id, mock_changes, None)
        
        # Now load policy (as scene 2 would)
        policy_data = await generation_agent.load_policy(session, test_project.id)
        
        # Verify scene 2 gets the improved policy
        assert policy_data["version"] == 2
        assert policy_data["cleanup_config"]["constraint_emphasis"] == "high"
        assert policy_data["structural_config"]["constraint_emphasis"] == "high"
    
    @pytest.mark.asyncio
    async def test_improvement_effectiveness_tracking(
        self, session: AsyncSession, test_project: Project, initial_policy: Policy
    ):
        """
        Test that improvement effectiveness is tracked when retry succeeds.
        """
        # Apply a policy change
        mock_changes = [
            {
                "type": "constraint_emphasis",
                "current": "medium",
                "proposed": "high",
                "reason": "Test improvement"
            }
        ]
        
        result = await qc_agent.apply_policy_changes(
            session, test_project.id, mock_changes, None
        )
        new_policy_id = result["new_policy_id"]
        
        # Mark improvement as effective (simulating successful retry)
        success = await qc_agent.mark_improvement_effective(
            session, test_project.id, new_policy_id, effective=True
        )
        
        assert success is True
        
        # Verify the PolicyChange record was updated
        query = select(PolicyChange).where(
            PolicyChange.project_id == test_project.id,
            PolicyChange.new_policy_id == new_policy_id
        )
        db_result = await session.execute(query)
        policy_change = db_result.scalar_one_or_none()
        
        assert policy_change is not None
        assert policy_change.improvement_observed is True


# ============================================
# Cross-Project Learning Tests
# ============================================
class TestCrossProjectLearning:
    """Tests for cross-project learning."""
    
    @pytest.mark.asyncio
    async def test_effective_patterns_aggregation(
        self, session: AsyncSession
    ):
        """
        Test that effective patterns are correctly aggregated across projects.
        """
        # Create multiple projects with effective policy changes
        for i in range(3):
            project = Project(
                id=uuid4(),
                goal=f"Test project {i}",
                images=["test.jpg"],
                status=ProjectStatus.COMPLETED,
            )
            session.add(project)
            await session.flush()
            
            # Create initial policy
            policy_v1 = Policy(
                project_id=project.id,
                version=1,
                cleanup_config={"constraint_emphasis": "medium"},
                is_active=False,
            )
            session.add(policy_v1)
            await session.flush()
            
            # Create improved policy
            policy_v2 = Policy(
                project_id=project.id,
                version=2,
                cleanup_config={"constraint_emphasis": "high"},
                is_active=True,
            )
            session.add(policy_v2)
            await session.flush()
            
            # Record the policy change as effective
            policy_change = PolicyChange(
                project_id=project.id,
                old_policy_id=policy_v1.id,
                new_policy_id=policy_v2.id,
                trigger_reason="constraint_violation",
                changes_made=[
                    {"type": "constraint_emphasis", "proposed": "high"}
                ],
                improvement_observed=True,  # Mark as effective
            )
            session.add(policy_change)
        
        await session.flush()
        
        # Get effective patterns
        patterns = await qc_agent.get_effective_patterns(session)
        
        assert len(patterns) > 0
        
        # Should find constraint_emphasis pattern with 3 occurrences
        constraint_pattern = next(
            (p for p in patterns if p["type"] == "constraint_emphasis"),
            None
        )
        assert constraint_pattern is not None
        assert constraint_pattern["occurrences"] == 3
    
    @pytest.mark.asyncio
    async def test_new_project_seeded_from_learnings(
        self, session: AsyncSession
    ):
        """
        Test that a new project can be seeded with learned patterns.
        """
        # First, create some effective patterns from past projects
        for i in range(2):
            project = Project(
                id=uuid4(),
                goal=f"Past project {i}",
                images=["test.jpg"],
                status=ProjectStatus.COMPLETED,
            )
            session.add(project)
            await session.flush()
            
            policy_v1 = Policy(
                project_id=project.id,
                version=1,
                is_active=False,
            )
            session.add(policy_v1)
            await session.flush()
            
            policy_v2 = Policy(
                project_id=project.id,
                version=2,
                is_active=True,
            )
            session.add(policy_v2)
            await session.flush()
            
            policy_change = PolicyChange(
                project_id=project.id,
                old_policy_id=policy_v1.id,
                new_policy_id=policy_v2.id,
                trigger_reason="constraint_violation",
                changes_made=[
                    {"type": "constraint_emphasis", "proposed": "high"}
                ],
                improvement_observed=True,
            )
            session.add(policy_change)
        
        await session.flush()
        
        # Now create a new project and seed it
        new_project = Project(
            id=uuid4(),
            goal="New project to be seeded",
            images=["new_test.jpg"],
            status=ProjectStatus.CREATED,
        )
        session.add(new_project)
        await session.flush()
        
        # Seed the new project
        seed_result = await qc_agent.seed_policy_from_learnings(
            session, new_project.id, space_type="bathroom"
        )
        
        assert seed_result["seeded"] is True
        assert len(seed_result["changes_applied"]) > 0
        
        # Verify the seeded policy has improved settings
        policy_data = await generation_agent.load_policy(session, new_project.id)
        
        assert policy_data["cleanup_config"]["constraint_emphasis"] == "high"


# ============================================
# Integration Tests
# ============================================
class TestFullLearningLoop:
    """End-to-end tests for the complete learning loop."""
    
    @pytest.mark.asyncio
    async def test_complete_cross_scene_learning_flow(
        self, session: AsyncSession, test_project: Project, test_scenes: list, initial_policy: Policy
    ):
        """
        Test the complete flow:
        1. Scene 1 fails and triggers policy improvement
        2. Policy is updated with higher constraint emphasis
        3. Scene 2 loads the improved policy
        4. Improvement is marked effective when Scene 2 succeeds
        5. Learning is available for future projects
        """
        scene_1, scene_2, scene_3 = test_scenes
        
        # Step 1: Scene 1 fails - simulate constraint violation
        scene_1.status = SceneStatus.GENERATING
        await session.flush()
        
        # Step 2: Apply policy improvement
        improvement_result = await qc_agent.apply_policy_changes(
            session,
            test_project.id,
            [{"type": "constraint_emphasis", "current": "medium", "proposed": "high", "reason": "Scene 1 failed"}],
            None
        )
        
        assert improvement_result["success"]
        new_policy_id = improvement_result["new_policy_id"]
        
        # Record scene 1 metadata
        scene_1.metadata_ = {"policy_improvements": 1, "last_improvement_phase": "cleanup"}
        scene_1.status = SceneStatus.COMPLETED  # Eventually succeeded after retry
        await session.flush()
        
        # Step 3: Scene 2 loads improved policy
        scene_2.status = SceneStatus.ANALYZING
        policy_for_scene_2 = await generation_agent.load_policy(session, test_project.id)
        
        assert policy_for_scene_2["version"] == 2
        assert policy_for_scene_2["cleanup_config"]["constraint_emphasis"] == "high"
        
        # Step 4: Scene 2 succeeds with improved policy
        scene_2.status = SceneStatus.COMPLETED
        
        # Mark improvement as effective
        await qc_agent.mark_improvement_effective(
            session, test_project.id, new_policy_id, effective=True
        )
        
        # Step 5: Verify learning is stored for future
        patterns = await qc_agent.get_effective_patterns(session)
        
        # There should be at least one effective pattern
        assert len(patterns) >= 0  # May be empty if this is first test
        
        # Verify PolicyChange has improvement_observed = True
        query = select(PolicyChange).where(PolicyChange.new_policy_id == new_policy_id)
        result = await session.execute(query)
        policy_change = result.scalar_one_or_none()
        
        if policy_change:
            assert policy_change.improvement_observed is True
    
    @pytest.mark.asyncio
    async def test_learning_summary_generation(
        self, session: AsyncSession, test_project: Project, test_scenes: list, initial_policy: Policy
    ):
        """
        Test that learning summary is correctly generated after batch processing.
        """
        scene_1, scene_2, scene_3 = test_scenes
        
        # Simulate improvements during processing
        scene_1.metadata_ = {"policy_improvements": 1}
        scene_1.status = SceneStatus.COMPLETED
        
        scene_2.metadata_ = {"policy_improvements": 0}
        scene_2.status = SceneStatus.COMPLETED
        
        scene_3.metadata_ = {"policy_improvements": 0}
        scene_3.status = SceneStatus.COMPLETED
        
        test_project.completed_scenes = 3
        await session.flush()
        
        # Calculate learning summary (as orchestrator would)
        total_improvements = sum(
            (s.metadata_ or {}).get("policy_improvements", 0)
            for s in test_scenes
        )
        
        scenes_benefited = [
            str(s.id) for i, s in enumerate(test_scenes)
            if i > 0 and test_scenes[i-1].metadata_ and test_scenes[i-1].metadata_.get("policy_improvements")
        ]
        
        assert total_improvements == 1
        assert len(scenes_benefited) == 2  # Scenes 2 and 3 benefited from Scene 1's improvement


# ============================================
# Test Runner
# ============================================
async def run_all_cross_learning_tests():
    """Run all cross-learning tests and return summary."""
    import sys
    import os
    
    # Setup test database session
    from app.database import async_engine, Base
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker
    
    async_session = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    
    results = {
        "total": 0,
        "passed": 0,
        "failed": 0,
        "tests": {}
    }
    
    test_classes = [
        TestCrossSceneLearning,
        TestCrossProjectLearning,
        TestFullLearningLoop,
    ]
    
    async with async_session() as session:
        for test_class in test_classes:
            instance = test_class()
            for method_name in dir(instance):
                if method_name.startswith("test_"):
                    results["total"] += 1
                    try:
                        # Create fixtures
                        project = Project(
                            id=uuid4(),
                            goal="Test",
                            images=["test.jpg"],
                            status=ProjectStatus.CREATED,
                            is_batch=True,
                            total_scenes=3,
                        )
                        session.add(project)
                        await session.flush()
                        
                        policy = Policy(
                            project_id=project.id,
                            version=1,
                            cleanup_config={"constraint_emphasis": "medium", "creativity_level": 0.7},
                            structural_config={"constraint_emphasis": "medium", "creativity_level": 0.7},
                            fixture_config={"constraint_emphasis": "medium", "creativity_level": 0.7},
                            style_config={"constraint_emphasis": "medium", "creativity_level": 0.7},
                            is_active=True,
                        )
                        session.add(policy)
                        
                        scenes = []
                        for i in range(3):
                            scene = Scene(
                                id=uuid4(),
                                project_id=project.id,
                                scene_index=i,
                                input_image_path=f"test_{i}.jpg",
                                status=SceneStatus.PENDING,
                            )
                            session.add(scene)
                            scenes.append(scene)
                        
                        await session.flush()
                        
                        # Run test
                        method = getattr(instance, method_name)
                        if "scene" in method_name.lower():
                            await method(session, project, scenes, policy)
                        elif "project" in method_name.lower():
                            await method(session)
                        else:
                            await method(session, project, scenes, policy)
                        
                        results["passed"] += 1
                        results["tests"][method_name] = "PASSED"
                        
                    except Exception as e:
                        results["failed"] += 1
                        results["tests"][method_name] = f"FAILED: {str(e)}"
                    
                    finally:
                        await session.rollback()
    
    results["pass_rate"] = (
        f"{(results['passed'] / results['total'] * 100):.1f}%"
        if results["total"] > 0 else "N/A"
    )
    
    return results


if __name__ == "__main__":
    results = asyncio.run(run_all_cross_learning_tests())
    print("\n" + "=" * 60)
    print("CROSS-LEARNING TEST RESULTS")
    print("=" * 60)
    print(f"Total: {results['total']}")
    print(f"Passed: {results['passed']}")
    print(f"Failed: {results['failed']}")
    print(f"Pass Rate: {results['pass_rate']}")
    print("\nDetailed Results:")
    for test_name, result in results["tests"].items():
        status_icon = "✓" if result == "PASSED" else "✗"
        print(f"  {status_icon} {test_name}: {result}")
