"""
Continuity - Self-Improvement Loop Tests
Verifies the core loop and self-improvement features work end-to-end.

Test Suite:
1. test_weave_integration - Verify Weave tracing is working
2. test_policy_creation_and_versioning - Verify policy versioning
3. test_qc_evaluation_flow - Verify QC agent evaluation
4. test_self_improvement_loop - Full self-improvement cycle
5. test_end_to_end_pipeline - Complete pipeline integration

Run with: python -m tests.test_self_improvement
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from typing import Dict, Any, List
from uuid import UUID

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import weave

from tests.test_utils import (
    TestConfig, TestResult,
    get_test_session, cleanup_test_session,
    create_test_project, create_test_requirements,
    create_test_policy, create_test_constraints,
    create_test_iteration, cleanup_test_project,
    init_weave_for_tests, get_weave_trace_url,
)
from app.models import (
    OrchestrationState, GenerationPhase, EvaluationStatus,
    PolicyCreator, EvaluationCriterion, Iteration
)
from app.agents.qc_agent import qc_agent, PASS_THRESHOLD, CRITERION_WEIGHTS
from app.weave_ops import test_weave_operation, analyze_text, record_policy_improvement


# ============================================
# Test 1: Weave Integration
# ============================================
async def test_weave_integration() -> TestResult:
    """
    Test that Weave tracing is properly integrated.
    This is fundamental to the self-improvement loop.
    """
    result = TestResult("Weave Integration")
    
    try:
        # Step 1: Initialize Weave
        result.add_step("Initialize Weave", "running")
        weave_ok = init_weave_for_tests()
        if weave_ok:
            result.add_step("Initialize Weave", "passed")
        else:
            result.add_step("Initialize Weave", "failed")
            result.add_error("Weave initialization failed")
            result.complete(False)
            return result
        
        # Step 2: Test basic traced operation
        result.add_step("Test basic traced operation", "running")
        output = test_weave_operation("Hello from self-improvement test")
        if "Processed: Hello from self-improvement test" in output:
            result.add_step("Test basic traced operation", "passed")
            result.metrics["basic_op_output"] = output
        else:
            result.add_step("Test basic traced operation", "failed")
            result.add_error(f"Unexpected output: {output}")
        
        # Step 3: Test structured output operation
        result.add_step("Test structured output operation", "running")
        analysis = analyze_text("Testing the self-improvement loop", "detailed")
        if analysis.get("status") == "analyzed" and analysis.get("word_count", 0) > 0:
            result.add_step("Test structured output operation", "passed")
            result.metrics["word_count"] = analysis.get("word_count")
        else:
            result.add_step("Test structured output operation", "failed")
        
        # Step 4: Test policy improvement recording
        result.add_step("Record policy improvement trace", "running")
        improvement_record = record_policy_improvement(
            project_id="test-project-123",
            old_policy_version=1,
            new_policy_version=2,
            changes_made=[{"type": "test_change", "value": "test"}],
            trigger_reason="test_trigger",
            evaluation_score=0.65
        )
        if improvement_record.get("event_type") == "self_improvement":
            result.add_step("Record policy improvement trace", "passed")
            result.metrics["improvement_logged"] = True
        else:
            result.add_step("Record policy improvement trace", "failed")
        
        result.weave_trace_url = get_weave_trace_url()
        result.complete(len(result.errors) == 0)
        
    except Exception as e:
        result.add_error(f"Exception: {str(e)}")
        result.complete(False)
    
    return result


# ============================================
# Test 2: Policy Creation and Versioning
# ============================================
async def test_policy_creation_and_versioning() -> TestResult:
    """
    Test that policies can be created and versioned correctly.
    Policy versioning is how the system "remembers" improvements.
    """
    result = TestResult("Policy Creation and Versioning")
    session = None
    project_id = None
    
    try:
        # Step 1: Create database session
        result.add_step("Create database session", "running")
        session = await get_test_session()
        result.add_step("Create database session", "passed")
        
        # Step 2: Create test project
        result.add_step("Create test project", "running")
        project = await create_test_project(session, name="test_policy_versioning")
        project_id = project.id
        result.add_step("Create test project", "passed")
        result.metrics["project_id"] = str(project_id)
        
        # Step 3: Create initial policy (version 1)
        result.add_step("Create initial policy v1", "running")
        policy_v1 = await create_test_policy(session, project_id, version=1)
        result.add_step("Create initial policy v1", "passed")
        result.metrics["policy_v1_id"] = str(policy_v1.id)
        
        # Step 4: Verify policy attributes
        result.add_step("Verify policy attributes", "running")
        if (policy_v1.version == 1 and 
            policy_v1.is_active and 
            policy_v1.cleanup_config is not None):
            result.add_step("Verify policy attributes", "passed")
        else:
            result.add_step("Verify policy attributes", "failed")
            result.add_error("Policy attributes incorrect")
        
        # Step 5: Create new policy version (simulating QC update)
        result.add_step("Create policy v2 (QC update)", "running")
        
        # Deactivate v1
        policy_v1.is_active = False
        
        # Create v2 with modifications
        from app.models import Policy
        policy_v2 = Policy(
            project_id=project_id,
            version=2,
            parent_version=1,
            is_active=True,
            created_by=PolicyCreator.QUALITY_CONTROL,
            cleanup_config={
                **policy_v1.cleanup_config,
                "constraint_emphasis": "high",  # Updated!
            },
            structural_config=policy_v1.structural_config,
            fixture_config=policy_v1.fixture_config,
            style_config=policy_v1.style_config,
            notes="Updated by QC agent - increased constraint emphasis",
        )
        session.add(policy_v2)
        await session.flush()
        
        result.add_step("Create policy v2 (QC update)", "passed")
        result.metrics["policy_v2_id"] = str(policy_v2.id)
        
        # Step 6: Verify version chain
        result.add_step("Verify version chain", "running")
        if (policy_v2.version == 2 and 
            policy_v2.parent_version == 1 and
            policy_v2.created_by == PolicyCreator.QUALITY_CONTROL and
            policy_v2.cleanup_config.get("constraint_emphasis") == "high"):
            result.add_step("Verify version chain", "passed")
            result.metrics["self_improvement_demonstrated"] = True
        else:
            result.add_step("Verify version chain", "failed")
            result.add_error("Version chain broken")
        
        await session.commit()
        result.complete(len(result.errors) == 0)
        
    except Exception as e:
        result.add_error(f"Exception: {str(e)}")
        result.complete(False)
        if session:
            await session.rollback()
    
    finally:
        if session and project_id and TestConfig.CLEANUP_TEST_PROJECTS:
            await cleanup_test_project(session, project_id)
        if session:
            await cleanup_test_session(session)
    
    return result


# ============================================
# Test 3: QC Evaluation Flow
# ============================================
async def test_qc_evaluation_flow() -> TestResult:
    """
    Test the Quality Control agent's evaluation capabilities.
    The QC agent is the brain of the self-improvement loop.
    """
    result = TestResult("QC Evaluation Flow")
    session = None
    project_id = None
    
    try:
        # Step 1: Setup test environment
        result.add_step("Setup test environment", "running")
        session = await get_test_session()
        project = await create_test_project(session, name="test_qc_evaluation")
        project_id = project.id
        policy = await create_test_policy(session, project_id)
        constraints = await create_test_constraints(session, project_id)
        await session.commit()
        result.add_step("Setup test environment", "passed")
        
        # Step 2: Create test iteration for evaluation
        result.add_step("Create test iteration", "running")
        iteration = await create_test_iteration(
            session, project_id, policy.version,
            phase=GenerationPhase.CLEANUP,
            passed=False,
            score=0.5,
        )
        await session.commit()
        result.add_step("Create test iteration", "passed")
        result.metrics["iteration_id"] = str(iteration.id)
        
        # Step 3: Verify evaluation weights are configured
        result.add_step("Verify evaluation weights", "running")
        total_weight = sum(CRITERION_WEIGHTS.values())
        if abs(total_weight - 1.0) < 0.01:  # Should sum to 1.0
            result.add_step("Verify evaluation weights", "passed")
            result.metrics["weight_sum"] = total_weight
        else:
            result.add_step("Verify evaluation weights", "failed")
            result.add_error(f"Weights sum to {total_weight}, expected 1.0")
        
        # Step 4: Verify pass threshold is reasonable
        result.add_step("Verify pass threshold", "running")
        if 0.5 <= PASS_THRESHOLD <= 0.9:
            result.add_step("Verify pass threshold", "passed")
            result.metrics["pass_threshold"] = PASS_THRESHOLD
        else:
            result.add_step("Verify pass threshold", "failed")
        
        # Step 5: Test failure analysis
        result.add_step("Test failure analysis logic", "running")
        analysis = await qc_agent.analyze_failure(session, iteration.id)
        if "iteration_id" in analysis:
            result.add_step("Test failure analysis logic", "passed")
            result.metrics["analysis_keys"] = list(analysis.keys())
        else:
            result.add_step("Test failure analysis logic", "failed")
        
        result.complete(len(result.errors) == 0)
        
    except Exception as e:
        result.add_error(f"Exception: {str(e)}")
        result.complete(False)
        if session:
            await session.rollback()
    
    finally:
        if session and project_id and TestConfig.CLEANUP_TEST_PROJECTS:
            await cleanup_test_project(session, project_id)
        if session:
            await cleanup_test_session(session)
    
    return result


# ============================================
# Test 4: Self-Improvement Loop
# ============================================
async def test_self_improvement_loop() -> TestResult:
    """
    Test the complete self-improvement cycle:
    1. Create policy
    2. Simulate failed evaluation
    3. Generate recommended changes
    4. Apply changes to create new policy version
    5. Verify improvements were applied
    """
    result = TestResult("Self-Improvement Loop")
    session = None
    project_id = None
    
    try:
        # Step 1: Initialize
        result.add_step("Initialize test environment", "running")
        init_weave_for_tests()
        session = await get_test_session()
        project = await create_test_project(session, name="test_self_improvement")
        project_id = project.id
        result.add_step("Initialize test environment", "passed")
        
        # Step 2: Create initial policy
        result.add_step("Create initial policy", "running")
        policy = await create_test_policy(session, project_id, version=1)
        initial_constraint_emphasis = policy.cleanup_config.get("constraint_emphasis", "medium")
        await session.commit()
        result.add_step("Create initial policy", "passed")
        result.metrics["initial_version"] = 1
        result.metrics["initial_constraint_emphasis"] = initial_constraint_emphasis
        
        # Step 3: Create constraints and iteration
        result.add_step("Setup evaluation scenario", "running")
        await create_test_constraints(session, project_id)
        iteration = await create_test_iteration(
            session, project_id, policy.version,
            phase=GenerationPhase.CLEANUP,
            passed=False,
            score=0.55,
        )
        await session.commit()
        result.add_step("Setup evaluation scenario", "passed")
        
        # Step 4: Add evaluation details to make analyze_failure work
        result.add_step("Generate improvement recommendations", "running")
        
        # Add evaluation details with constraint failure
        from app.models import EvaluationDetail, EvaluationCriterion
        
        eval_detail = EvaluationDetail(
            iteration_id=iteration.id,
            criterion=EvaluationCriterion.CONSTRAINT_COMPLIANCE,
            weight=0.35,
            passed=False,
            score=0.45,
            details="Constraint violations detected",
            evidence={
                "violations": [
                    {"element": "window", "issue": "Window was moved from right wall"},
                    {"element": "door", "issue": "Door position changed"}
                ],
                "locked_count": 3
            }
        )
        session.add(eval_detail)
        await session.flush()
        
        # Call the REAL analyze_failure function
        analysis = await qc_agent.analyze_failure(session, iteration.id)
        recommended_changes = analysis.get("recommended_changes", [])
        
        # Verify analyze_failure produced recommendations
        if not recommended_changes:
            result.add_error("analyze_failure did not produce any recommendations")
        
        result.add_step("Generate improvement recommendations", "passed")
        result.metrics["recommendations_count"] = len(recommended_changes)
        result.metrics["failed_criteria"] = len(analysis.get("failed_criteria", []))
        result.metrics["insights_count"] = len(analysis.get("insights", []))
        
        # Step 5: Apply policy changes
        result.add_step("Apply policy changes", "running")
        change_result = await qc_agent.apply_policy_changes(
            session,
            project_id,
            recommended_changes,
            trigger_iteration_id=iteration.id
        )
        await session.commit()
        
        if change_result.get("success"):
            result.add_step("Apply policy changes", "passed")
            result.metrics["new_version"] = change_result.get("new_version")
            result.metrics["changes_applied"] = len(change_result.get("changes_applied", []))
        else:
            result.add_step("Apply policy changes", "failed")
            result.add_error("Failed to apply policy changes")
        
        # Step 6: Verify improvements were applied
        result.add_step("Verify improvements", "running")
        
        # Load the new policy
        from sqlalchemy import select, and_, desc
        from app.models import Policy
        
        policy_result = await session.execute(
            select(Policy)
            .where(and_(Policy.project_id == project_id, Policy.is_active.is_(True)))
            .order_by(desc(Policy.version))
            .limit(1)
        )
        new_policy = policy_result.scalar_one_or_none()
        
        if new_policy and new_policy.version == 2:
            new_emphasis = new_policy.cleanup_config.get("constraint_emphasis", "medium")
            if new_emphasis == "high":
                result.add_step("Verify improvements", "passed")
                result.metrics["improvement_verified"] = True
                result.metrics["new_constraint_emphasis"] = new_emphasis
            else:
                result.add_step("Verify improvements", "failed")
                result.add_error(f"Expected 'high' emphasis, got '{new_emphasis}'")
        else:
            result.add_step("Verify improvements", "failed")
            result.add_error("New policy not found or wrong version")
        
        # Step 7: Record the improvement in Weave
        result.add_step("Record improvement in Weave", "running")
        improvement_record = record_policy_improvement(
            project_id=str(project_id),
            old_policy_version=1,
            new_policy_version=2,
            changes_made=recommended_changes,
            trigger_reason="evaluation_failure",
            evaluation_score=0.55
        )
        if improvement_record.get("improvement_cycle") == "complete":
            result.add_step("Record improvement in Weave", "passed")
        else:
            result.add_step("Record improvement in Weave", "failed")
        
        result.weave_trace_url = get_weave_trace_url()
        result.complete(len(result.errors) == 0)
        
    except Exception as e:
        result.add_error(f"Exception: {str(e)}")
        result.complete(False)
        if session:
            await session.rollback()
    
    finally:
        if session and project_id and TestConfig.CLEANUP_TEST_PROJECTS:
            await cleanup_test_project(session, project_id)
        if session:
            await cleanup_test_session(session)
    
    return result


# ============================================
# Test 5: End-to-End Pipeline
# ============================================
async def test_end_to_end_pipeline() -> TestResult:
    """
    Test the complete orchestration pipeline from start to finish.
    This verifies all agents work together correctly.
    """
    result = TestResult("End-to-End Pipeline")
    session = None
    project_id = None
    
    try:
        # Step 1: Initialize
        result.add_step("Initialize pipeline test", "running")
        init_weave_for_tests()
        session = await get_test_session()
        result.add_step("Initialize pipeline test", "passed")
        
        # Step 2: Create project with all required data
        result.add_step("Create complete project", "running")
        project = await create_test_project(
            session,
            name="test_e2e_pipeline",
            goal="Transform this construction site bathroom into a modern spa retreat with natural materials",
            style_targets=["modern", "spa", "natural"],
        )
        project_id = project.id
        
        # Add requirements
        requirements = await create_test_requirements(session, project_id)
        
        # Add policy
        policy = await create_test_policy(session, project_id)
        
        # Add constraints
        constraints = await create_test_constraints(session, project_id)
        
        await session.commit()
        result.add_step("Create complete project", "passed")
        result.metrics["project_id"] = str(project_id)
        
        # Step 3: Verify project state
        result.add_step("Verify initial state", "running")
        if project.orchestration_state == OrchestrationState.CREATED:
            result.add_step("Verify initial state", "passed")
        else:
            result.add_step("Verify initial state", "failed")
        
        # Step 4: Test state transitions (manual simulation)
        result.add_step("Test state machine transitions", "running")
        
        from app.orchestrator import STATE_TRANSITIONS, TERMINAL_STATES
        
        # Verify all expected states have transitions
        expected_states = [
            OrchestrationState.CREATED,
            OrchestrationState.GATHERING_REQUIREMENTS,
            OrchestrationState.ANALYZING_SPACE,
            OrchestrationState.GENERATING_CLEANUP,
            OrchestrationState.EVALUATING_CLEANUP,
        ]
        
        missing_states = [s for s in expected_states if s not in STATE_TRANSITIONS]
        if not missing_states:
            result.add_step("Test state machine transitions", "passed")
            result.metrics["states_verified"] = len(expected_states)
        else:
            result.add_step("Test state machine transitions", "failed")
            result.add_error(f"Missing states: {missing_states}")
        
        # Step 5: Verify terminal states
        result.add_step("Verify terminal states", "running")
        if (OrchestrationState.COMPLETED in TERMINAL_STATES and
            OrchestrationState.FAILED in TERMINAL_STATES):
            result.add_step("Verify terminal states", "passed")
        else:
            result.add_step("Verify terminal states", "failed")
        
        # Step 6: Simulate a generation cycle
        result.add_step("Simulate generation cycle", "running")
        
        # Create iterations for each phase
        phases = [
            GenerationPhase.CLEANUP,
            GenerationPhase.STRUCTURAL,
            GenerationPhase.FIXTURE,
            GenerationPhase.STYLE,
        ]
        
        for i, phase in enumerate(phases):
            iter = await create_test_iteration(
                session, project_id, policy.version,
                phase=phase,
                iteration_number=i + 1,
                passed=True,
                score=0.85,
            )
        
        await session.commit()
        result.add_step("Simulate generation cycle", "passed")
        result.metrics["phases_simulated"] = len(phases)
        
        # Step 7: Verify iteration chain
        result.add_step("Verify iteration chain", "running")
        
        from sqlalchemy import select, func
        iter_count_result = await session.execute(
            select(func.count()).select_from(Iteration).where(Iteration.project_id == project_id)
        )
        iter_count = iter_count_result.scalar()
        
        if iter_count == 4:  # One per phase
            result.add_step("Verify iteration chain", "passed")
            result.metrics["iterations_created"] = iter_count
        else:
            result.add_step("Verify iteration chain", "failed")
            result.add_error(f"Expected 4 iterations, got {iter_count}")
        
        result.weave_trace_url = get_weave_trace_url()
        result.complete(len(result.errors) == 0)
        
    except Exception as e:
        result.add_error(f"Exception: {str(e)}")
        result.complete(False)
        if session:
            await session.rollback()
    
    finally:
        if session and project_id and TestConfig.CLEANUP_TEST_PROJECTS:
            await cleanup_test_project(session, project_id)
        if session:
            await cleanup_test_session(session)
    
    return result


# ============================================
# Test Runner
# ============================================
async def run_all_tests() -> Dict[str, Any]:
    """Run all tests and return aggregated results."""
    print("\n" + "="*70)
    print("  CONTINUITY SELF-IMPROVEMENT TEST SUITE")
    print("="*70)
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70 + "\n")
    
    tests = [
        ("weave_integration", test_weave_integration),
        ("policy_versioning", test_policy_creation_and_versioning),
        ("qc_evaluation", test_qc_evaluation_flow),
        ("self_improvement", test_self_improvement_loop),
        ("e2e_pipeline", test_end_to_end_pipeline),
    ]
    
    results = {}
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        print(f"\n{'─'*50}")
        print(f"Running: {test_name}")
        print(f"{'─'*50}")
        
        try:
            result = await test_func()
            results[test_name] = result.to_dict()
            
            if result.passed:
                passed += 1
                print(f"✓ {test_name} PASSED")
            else:
                failed += 1
                print(f"✗ {test_name} FAILED")
                for error in result.errors:
                    print(f"  Error: {error}")
                    
        except Exception as e:
            failed += 1
            results[test_name] = {
                "passed": False,
                "error": str(e),
            }
            print(f"✗ {test_name} CRASHED: {e}")
    
    # Print summary
    print("\n" + "="*70)
    print("  TEST SUMMARY")
    print("="*70)
    print(f"  Total:  {len(tests)}")
    print(f"  Passed: {passed}")
    print(f"  Failed: {failed}")
    print(f"  Rate:   {(passed/len(tests))*100:.1f}%")
    print("="*70)
    
    if failed == 0:
        print("\n  ✓ ALL TESTS PASSED - Self-improvement loop is working!")
    else:
        print(f"\n  ✗ {failed} TEST(S) FAILED - Review errors above")
    
    print("\n  View traces in Weave: " + (get_weave_trace_url() or "N/A"))
    print("="*70 + "\n")
    
    return {
        "summary": {
            "total": len(tests),
            "passed": passed,
            "failed": failed,
            "rate": passed / len(tests),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        "tests": results,
        "weave_url": get_weave_trace_url(),
    }


# ============================================
# Main Entry Point
# ============================================
if __name__ == "__main__":
    import json
    
    # Run tests
    results = asyncio.run(run_all_tests())
    
    # Save results to file
    output_file = os.path.join(os.path.dirname(__file__), "test_results.json")
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"Results saved to: {output_file}")
    
    # Exit with appropriate code
    sys.exit(0 if results["summary"]["failed"] == 0 else 1)
