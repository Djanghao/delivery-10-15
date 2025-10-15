#!/usr/bin/env bash
set -euo pipefail

# Ensure we run from repo root
cd "$(dirname "$0")/.."

echo "Stopping Gov Stats Crawler..."
echo
pm2 stop ecosystem.config.js || true
echo
echo "All services stopped"
