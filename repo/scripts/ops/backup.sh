#!/usr/bin/env bash
# backup.sh — Trigger a manual backup via the service API
#
# Usage: NEXUS_TOKEN=<session-cookie> ./scripts/ops/backup.sh
# Or: SESSION_COOKIE=<value> ./scripts/ops/backup.sh

set -euo pipefail

SERVICE_URL="${SERVICE_URL:-https://127.0.0.1:4433}"
COOKIE="${SESSION_COOKIE:-}"

if [ -z "${COOKIE}" ]; then
  echo "ERROR: SESSION_COOKIE env var required (copy from browser devtools after login)"
  exit 1
fi

echo "Triggering backup..."
RESPONSE=$(curl -sf -X POST "${SERVICE_URL}/api/backups" \
  -H "Cookie: nexusorder_session=${COOKIE}" \
  -H "Content-Type: application/json")

echo "Backup response:"
echo "${RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${RESPONSE}"
