#!/usr/bin/env bash
set -euo pipefail

# Ensure we run from repo root
cd "$(dirname "$0")/.."

echo "Restarting Gov Stats Crawler..."
echo
pm2 restart ecosystem.config.js
echo
echo "Services restarted"
