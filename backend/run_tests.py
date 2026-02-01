#!/usr/bin/env python3
"""
Continuity - Test Runner
Run the self-improvement test suite with live output.

Usage:
    python run_tests.py                   # Run all tests
    python run_tests.py --test weave      # Run specific test
    python run_tests.py --quick           # Run quick subset
    python run_tests.py --json            # Output JSON results
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime

# Ensure we can import from the app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def print_banner():
    """Print the test suite banner."""
    print()
    print("╔" + "═"*68 + "╗")
    print("║" + " CONTINUITY - SELF-IMPROVEMENT TEST SUITE ".center(68) + "║")
    print("║" + "═"*68 + "║")
    print("║" + f" Testing the AI agent self-improvement loop ".center(68) + "║")
    print("║" + f" {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ".center(68) + "║")
    print("╚" + "═"*68 + "╝")
    print()


def print_test_info():
    """Print information about what the tests verify."""
    print("Tests verify the following core features:")
    print()
    print("  1. Weave Integration")
    print("     └─ Traces are properly recorded for observability")
    print()
    print("  2. Policy Versioning")
    print("     └─ Policies can be created and versioned for learning")
    print()
    print("  3. QC Evaluation Flow")
    print("     └─ Quality Control agent can evaluate outputs")
    print()
    print("  4. Self-Improvement Loop")
    print("     └─ Failed evaluations trigger policy updates")
    print("     └─ Updates are applied to improve future generations")
    print()
    print("  5. End-to-End Pipeline")
    print("     └─ All agents work together in the orchestration")
    print()
    print("─"*70)
    print()


async def run_single_test(test_name: str):
    """Run a single test by name."""
    from tests.test_self_improvement import (
        test_weave_integration,
        test_policy_creation_and_versioning,
        test_qc_evaluation_flow,
        test_self_improvement_loop,
        test_end_to_end_pipeline,
    )
    
    tests = {
        "weave": test_weave_integration,
        "policy": test_policy_creation_and_versioning,
        "qc": test_qc_evaluation_flow,
        "improvement": test_self_improvement_loop,
        "e2e": test_end_to_end_pipeline,
    }
    
    if test_name not in tests:
        print(f"Unknown test: {test_name}")
        print(f"Available tests: {', '.join(tests.keys())}")
        return None
    
    print(f"Running test: {test_name}")
    print("─"*50)
    
    result = await tests[test_name]()
    result.print_summary()
    return result


async def run_quick_tests():
    """Run a quick subset of tests."""
    from tests.test_self_improvement import (
        test_weave_integration,
        test_policy_creation_and_versioning,
    )
    
    print("Running quick test suite...")
    print("─"*50)
    
    results = []
    
    for test in [test_weave_integration, test_policy_creation_and_versioning]:
        result = await test()
        result.print_summary()
        results.append(result)
    
    return results


async def run_all_tests():
    """Run all tests."""
    from tests.test_self_improvement import run_all_tests as run_tests
    return await run_tests()


def main():
    parser = argparse.ArgumentParser(description="Continuity Test Runner")
    parser.add_argument("--test", "-t", help="Run specific test (weave, policy, qc, improvement, e2e)")
    parser.add_argument("--quick", "-q", action="store_true", help="Run quick test subset")
    parser.add_argument("--json", "-j", action="store_true", help="Output JSON results")
    parser.add_argument("--info", "-i", action="store_true", help="Show test information")
    
    args = parser.parse_args()
    
    print_banner()
    
    if args.info:
        print_test_info()
        return 0
    
    if args.test:
        result = asyncio.run(run_single_test(args.test))
        if result and args.json:
            print(json.dumps(result.to_dict(), indent=2, default=str))
        return 0 if result and result.passed else 1
    
    if args.quick:
        results = asyncio.run(run_quick_tests())
        return 0 if all(r.passed for r in results) else 1
    
    # Run all tests
    results = asyncio.run(run_all_tests())
    
    if args.json:
        print(json.dumps(results, indent=2, default=str))
    
    # Save results
    output_file = os.path.join(os.path.dirname(__file__), "tests", "test_results.json")
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nResults saved to: {output_file}")
    
    return 0 if results["summary"]["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
