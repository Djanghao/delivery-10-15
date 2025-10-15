#!/bin/bash

set -e

cd "$(dirname "$0")/.."

echo "Starting Gov Stats Crawler..."
echo ""

mkdir -p data/logs logs

if [ ! -d "backend/venv" ]; then
    echo "Setting up Python virtual environment..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
    echo "✓ Python environment ready"
else
    echo "✓ Python virtual environment exists"
fi

if [ ! -d "frontend/node_modules" ]; then
    echo ""
    echo "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    echo "✓ Frontend dependencies installed"
else
    echo "✓ Frontend dependencies installed"
fi

if [ ! -d "frontend/.next" ]; then
    echo ""
    echo "ERROR: Frontend build not found!"
    echo "Please run './build-local.sh && ./deploy.sh' on your local machine"
    exit 1
fi

echo ""
echo "Starting backend service..."
cd backend
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8010 > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../logs/backend.pid
cd ..
echo "✓ Backend started (PID: $BACKEND_PID)"

echo ""
echo "Starting frontend service..."
cd frontend
nohup npm run start:prod > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../logs/frontend.pid
cd ..
echo "✓ Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "=========================================="
echo "  Services Started!"
echo "=========================================="
echo ""
echo "Frontend: http://60.205.111.170:3000"
echo "Backend:  http://60.205.111.170:8010"
echo ""
echo "View logs:"
echo "  tail -f logs/backend.log"
echo "  tail -f logs/frontend.log"
echo ""
echo "Stop services:"
echo "  ./stop.sh"
