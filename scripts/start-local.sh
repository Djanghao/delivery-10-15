#!/bin/bash

set -euo pipefail

# Ensure we run from repo root regardless of where invoked
cd "$(dirname "$0")/.."

echo "Starting Gov Stats Crawler Platform (Local Dev Mode)..."

if [ ! -d "backend/.venv" ]; then
    echo "Setting up Python virtual environment..."
    cd backend
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    deactivate || true
    cd ..
else
    echo "Python virtual environment already exists"
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
else
    echo "Frontend dependencies already installed"
fi

echo ""
echo "Starting backend on port 8010..."
cd backend
./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload &
BACKEND_PID=$!
cd ..

echo "Starting frontend on port 6060..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "Services started!"
echo ""
echo "  Frontend: http://localhost:6060"
echo "  Backend API: http://localhost:8010"
echo ""
echo "Press Ctrl+C to stop both services"
echo ""

trap "echo 'Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait

