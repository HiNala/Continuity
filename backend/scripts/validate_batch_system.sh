#!/usr/bin/env bash

set -euo pipefail

echo "🧪 BATCH PROCESSING VALIDATION SUITE"
echo "===================================="
echo ""

echo "Test 1: Batch Intelligence..."
python scripts/test_batch_intelligence.py
echo "✅ PASS"
echo ""

echo "Test 2: Pattern Detection (requires BATCH_PROJECT_ID)..."
python scripts/test_batch_patterns.py
echo "✅ PASS (if project ID is set)"
echo ""

echo "===================================="
echo "✅ BASIC BATCH TESTS COMPLETE"
