#!/usr/bin/env bash
# seed-db.sh — Seed the development database
# Run after Docker services are up.
#
# Usage: ./scripts/ops/seed-db.sh [mongodb-uri]

set -euo pipefail

MONGODB_URI="${1:-mongodb://localhost:27017}"
MONGODB_DB="${MONGODB_DB:-nexusorder}"

echo "=== NexusOrder Desk — Seed Database ==="
echo "MongoDB: ${MONGODB_URI}"
echo "Database: ${MONGODB_DB}"
echo ""

MONGODB_URI="${MONGODB_URI}" MONGODB_DB="${MONGODB_DB}" \
  pnpm ts-node database/seed/seed.ts
