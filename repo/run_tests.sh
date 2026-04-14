#!/usr/bin/env bash
# run_tests.sh - Run NexusOrder Desk tests inside Docker.
# Usage: ./run_tests.sh [--no-build]
set -euo pipefail

COMPOSE_FILE="docker-compose.test.yml"
EXIT_CODE=0

cleanup() {
  echo ">>> Tearing down test containers..."
  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans || true
}

trap cleanup EXIT

echo "================================================================"
echo " NexusOrder Desk - Docker Test Suite"
echo "================================================================"

if [[ "${1:-}" != "--no-build" ]]; then
  echo ">>> Building Docker images..."
  docker compose -f "$COMPOSE_FILE" build --parallel
fi

echo ">>> Starting test environment..."
set +e
docker compose -f "$COMPOSE_FILE" up \
  --abort-on-container-exit \
  --exit-code-from test-runner
EXIT_CODE=$?
set -e

if [[ $EXIT_CODE -eq 0 ]]; then
  echo ""
  echo "================================================================"
  echo " ALL TESTS PASSED"
  echo "================================================================"
else
  echo ""
  echo "================================================================"
  echo " TESTS FAILED (exit code: $EXIT_CODE)"
  echo "================================================================"
fi

exit $EXIT_CODE