#!/bin/sh
# Aluminify - Cloudron Start Script
# This script initializes the app within Cloudron's environment.
#
# Cloudron provides:
#   /app/data  — persistent storage (read-write, survives updates/restarts)
#   /app/code  — application code (READ-ONLY, replaced on updates)
#   /tmp       — temporary storage (read-write)

set -eu

echo "==> Aluminify: Initializing on Cloudron..."

# ---------------------------------------------------------------------------
# Start Next.js standalone server
# /app/code is read-only on Cloudron, so we skip cache symlinks.
# Next.js will use /tmp for any runtime cache needs.
# ---------------------------------------------------------------------------
echo "==> Starting Next.js standalone server on port ${PORT:-3000}..."
cd /app/code
exec node server.js
