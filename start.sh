#!/bin/bash

set -e

echo "Starting Gov Stats Crawler Platform..."

if ! command -v pm2 &> /dev/null; then
    echo "PM2 is not installed. Installing PM2..."
    npm install -g pm2
fi

if [ ! -d "backend/venv" ]; then
    echo "Setting up Python virtual environment..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
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

if [ ! -d "frontend/.next" ]; then
    echo "ERROR: Frontend build not found!"
    echo "Please run ./build-local.sh on your local machine first"
    exit 1
fi

echo "Starting services with PM2..."
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js

echo ""
echo "Services started successfully!"
echo ""
echo "Useful commands:"
echo "  pm2 status       - View process status"
echo "  pm2 logs         - View all logs"
echo "  pm2 logs backend - View backend logs"
echo "  pm2 logs frontend - View frontend logs"
echo "  pm2 restart all  - Restart all services"
echo "  pm2 stop all     - Stop all services"
echo ""
echo "Access the application at:"
echo "  Frontend: http://60.205.111.170:3000"
echo "  Backend API: http://60.205.111.170:8010"
