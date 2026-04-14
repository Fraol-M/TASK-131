#!/usr/bin/env bash
# sign-and-package.sh — Build and code-sign the Windows MSI installer
# Run this on the Windows 11 host (Git Bash or WSL2 with signtool available).
#
# Required env vars:
#   CSC_LINK          Path to the PFX certificate file
#   CSC_KEY_PASSWORD  PFX certificate password
#
# Optional:
#   SIGN_TIMESTAMP_SERVER  Timestamp server URL (default: http://timestamp.digicert.com)

set -euo pipefail

TIMESTAMP_SERVER="${SIGN_TIMESTAMP_SERVER:-http://timestamp.digicert.com}"

echo "=== NexusOrder Desk — Sign and Package ==="
echo "Certificate: ${CSC_LINK:?CSC_LINK must be set}"
echo "Timestamp: ${TIMESTAMP_SERVER}"

# Step 1: Build shared packages
echo ""
echo "1/5 Building shared packages..."
pnpm --filter @nexusorder/shared-types build
pnpm --filter @nexusorder/shared-validation build
pnpm --filter @nexusorder/shared-rbac build
pnpm --filter @nexusorder/shared-logging build

# Step 2: Build service (bundled into MSI via electron-builder asarUnpack)
echo ""
echo "2/5 Building service (bundled into MSI)..."
pnpm --filter @nexusorder/service build

# Step 3: Build desktop
echo ""
echo "3/5 Building desktop (Vite renderer + tsc main)..."
pnpm --filter @nexusorder/desktop build

# Step 4: Package with electron-builder (produces MSI)
echo ""
echo "4/5 Packaging MSI..."
pnpm --filter @nexusorder/desktop package

# Step 5: Verify signature
echo ""
echo "5/5 Verifying signature..."
MSI_PATH=$(find apps/desktop/dist-installer -name "*.msi" | head -1)
if [ -z "${MSI_PATH}" ]; then
  echo "ERROR: No MSI found in apps/desktop/dist-installer/"
  exit 1
fi

echo "MSI: ${MSI_PATH}"
powershell -Command "
  \$sig = Get-AuthenticodeSignature '${MSI_PATH}'
  if (\$sig.Status -ne 'Valid') {
    Write-Error \"Signature invalid: \$(\$sig.Status)\"
    exit 1
  }
  Write-Host \"Signature: Valid (\" + \$sig.SignerCertificate.Subject + \")\"
"

echo ""
echo "=== Package complete: ${MSI_PATH} ==="
