#!/bin/bash

cd "$(dirname "$0")/.."

echo "=========================================="
echo "  Service Status"
echo "=========================================="
echo ""

echo "Backend Service:"
if [ -f "logs/backend.pid" ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "  Status: ✓ Running"
        echo "  PID:    $BACKEND_PID"
        echo "  Port:   8010"
    else
        echo "  Status: ✗ Not running (stale PID file)"
    fi
else
    echo "  Status: ✗ Not running"
fi

echo ""
echo "Frontend Service:"
if [ -f "logs/frontend.pid" ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo "  Status: ✓ Running"
        echo "  PID:    $FRONTEND_PID"
        echo "  Port:   3000"
    else
        echo "  Status: ✗ Not running (stale PID file)"
    fi
else
    echo "  Status: ✗ Not running"
fi

echo ""
echo "Port Listening:"
echo "  Port 8010: $(ss -tuln | grep ':8010' > /dev/null && echo '✓ Active' || echo '✗ Inactive')"
echo "  Port 3000: $(ss -tuln | grep ':3000' > /dev/null && echo '✓ Active' || echo '✗ Inactive')"

echo ""
echo "Recent Logs:"
echo "  Backend:  logs/backend.log"
echo "  Frontend: logs/frontend.log"
