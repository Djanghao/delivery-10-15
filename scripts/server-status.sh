#!/usr/bin/env bash
set -euo pipefail

# Ensure we run from repo root
cd "$(dirname "$0")/.."

echo "=========================================="
echo "  Service Status"
echo "=========================================="
echo
pm2 list
echo
echo "Service URLs:"
echo "  Frontend: http://60.205.111.170:3000"
echo "  Backend:  http://60.205.111.170:8010"
echo
echo "View logs:"
echo "  pm2 logs gov-crawler-backend"
echo "  pm2 logs gov-crawler-frontend"
