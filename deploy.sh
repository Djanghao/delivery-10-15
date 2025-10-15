#!/bin/bash

set -e

SERVER_IP="60.205.111.170"
SERVER_USER="root"
REMOTE_DIR="/root/gov-stats-crawler"

echo "Deploying to $SERVER_USER@$SERVER_IP:$REMOTE_DIR"

echo "Syncing files to server..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'venv' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '.next/cache' \
  --exclude 'frontend/.env.local' \
  --exclude 'data/*.db' \
  --exclude 'logs/*.log' \
  ./ $SERVER_USER@$SERVER_IP:$REMOTE_DIR/

echo "Deployment complete!"
echo ""
echo "Next steps on server:"
echo "1. ssh $SERVER_USER@$SERVER_IP"
echo "2. cd $REMOTE_DIR"
echo "3. ./start.sh"
