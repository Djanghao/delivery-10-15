#!/usr/bin/env bash
set -euo pipefail

# Ensure we run from repo root
cd "$(dirname "$0")/.."

echo "Starting Gov Stats Crawler..."
echo

mkdir -p data logs

if [ ! -d "backend/venv" ]; then
  echo "Setting up Python virtual environment..."
  cd backend
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  deactivate || true
  cd ..
  echo "✓ Python environment ready"
else
  echo "✓ Python virtual environment exists"
fi

if [ ! -f "frontend/server.js" ]; then
  echo
  echo "ERROR: Frontend build not found!"
  echo "Please run './scripts/deploy.sh' on your local machine first."
  exit 1
fi

if ! command -v pm2 &> /dev/null; then
  echo "PM2 not found. Installing PM2..."
  npm install -g pm2
fi

echo
echo "Starting services with PM2..."
pm2 start ecosystem.config.js
pm2 save

echo
echo "✓ Services started"
echo
echo "=========================================="
echo "  Services Started!"
echo "=========================================="
echo
echo "Frontend: http://60.205.111.170:3000"
echo "Backend:  http://60.205.111.170:8010"
echo
echo "View logs:"
echo "  pm2 logs gov-crawler-backend"
echo "  pm2 logs gov-crawler-frontend"
echo
echo "Stop services:"
echo "  ./scripts/server-stop.sh"
