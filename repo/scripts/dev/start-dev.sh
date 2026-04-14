#!/usr/bin/env bash
# start-dev.sh — Start the full development environment
# Launches MongoDB + Express service via Docker, then starts Electron on the host.
#
# Usage: ./scripts/dev/start-dev.sh

set -euo pipefail

echo "=== NexusOrder Desk — Development Environment ==="

# Step 1: Start Docker services (MongoDB + Express service)
echo "1/2 Starting Docker services (MongoDB + Express)..."
docker compose up -d mongo service

# Wait for service to be healthy
echo "    Waiting for service to be ready..."
MAX_WAIT=30
i=0
while [ $i -lt $MAX_WAIT ]; do
  if curl -sfk https://127.0.0.1:4433/api/system/health > /dev/null 2>&1; then
    echo "    Service is ready."
    break
  fi
  sleep 1
  i=$((i + 1))
done

if [ $i -eq $MAX_WAIT ]; then
  echo "WARNING: Service did not become ready within ${MAX_WAIT}s — starting Electron anyway"
fi

# Step 2: Start Electron desktop
echo "2/2 Starting Electron desktop..."
pnpm --filter @nexusorder/desktop dev
