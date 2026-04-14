#!/usr/bin/env bash
# run_tests.sh — Run the full NexusOrder Desk test suite inside Docker.
# Usage: ./run_tests.sh [--no-build]
set -euo pipefail

COMPOSE_FILE="docker-compose.test.yml"

echo "================================================================"
echo " NexusOrder Desk — Docker Test Suite"
echo "================================================================"

if [[ "${1:-}" != "--no-build" ]]; then
  echo ">>> Building Docker images..."
  docker compose -f "$COMPOSE_FILE" build --parallel
fi

echo ">>> Starting test environment..."
docker compose -f "$COMPOSE_FILE" up \
  --abort-on-container-exit \
  --exit-code-from test-runner

EXIT_CODE=$?

echo ">>> Tearing down test containers..."
docker compose -f "$COMPOSE_FILE" down -v --remove-orphans

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
