#!/bin/bash

echo "Stopping Gov Stats Crawler..."
echo ""

if [ -f "logs/backend.pid" ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        kill $BACKEND_PID
        echo "✓ Backend stopped (PID: $BACKEND_PID)"
        rm logs/backend.pid
    else
        echo "! Backend process not running"
        rm logs/backend.pid
    fi
else
    echo "! Backend PID file not found"
    pkill -f "uvicorn app.main" && echo "✓ Killed uvicorn processes" || echo "! No uvicorn process found"
fi

echo ""

if [ -f "logs/frontend.pid" ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        kill $FRONTEND_PID
        echo "✓ Frontend stopped (PID: $FRONTEND_PID)"
        rm logs/frontend.pid
    else
        echo "! Frontend process not running"
        rm logs/frontend.pid
    fi
else
    echo "! Frontend PID file not found"
    pkill -f "npm run start:prod" && echo "✓ Killed npm processes" || echo "! No npm process found"
fi

echo ""
echo "All services stopped"
