#!/bin/bash

set -e

# Ensure we run from repo root regardless of where invoked
cd "$(dirname "$0")/.."

SERVER_IP="60.205.111.170"
SERVER_USER="root"
REMOTE_DIR="/root/gov-stats-crawler"
SSH_TARGET="$SERVER_USER@$SERVER_IP"

# Define helpers. If sshpass is available and user provides a password, use it.
RSYNC() { rsync -avz --progress "$@"; }
SSH() { ssh -o StrictHostKeyChecking=no "$SSH_TARGET" "$@"; }

if command -v sshpass >/dev/null 2>&1; then
    read -s -p "Enter SSH password for $SSH_TARGET (leave empty to use SSH key): " DEPLOY_PASSWORD || true
    echo
    if [ -n "${DEPLOY_PASSWORD:-}" ]; then
        RSYNC() { sshpass -p "$DEPLOY_PASSWORD" rsync -avz --progress "$@"; }
        SSH() { sshpass -p "$DEPLOY_PASSWORD" ssh -o StrictHostKeyChecking=no "$SSH_TARGET" "$@"; }
    fi
else
    echo "sshpass not found; proceeding with SSH key or interactive prompts."
fi

echo "Building frontend..."
cd frontend
npm run build
cd ..

echo "Deploying to $SERVER_USER@$SERVER_IP:$REMOTE_DIR"

echo "Ensuring remote directories exist..."
SSH "mkdir -p '$REMOTE_DIR/backend' '$REMOTE_DIR/frontend' '$REMOTE_DIR/scripts'"

echo "Syncing backend and frontend build to server..."
RSYNC \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'venv' \
  --exclude '.venv' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '.next/cache' \
  --exclude 'frontend/.env.local' \
  --exclude 'frontend/src' \
  --exclude 'frontend/tsconfig.json' \
  --exclude 'frontend/next.config.mjs' \
  --exclude 'frontend/package.json' \
  --exclude 'frontend/package-lock.json' \
  --exclude 'data/*.db' \
  --exclude 'logs/*.log' \
  backend/ "$SSH_TARGET:$REMOTE_DIR/backend/"

echo "Syncing frontend build output..."

# Helper to rsync a directory if it exists
sync_if_dir() {
  local src="$1"
  local dest="$2"
  if [ -d "$src" ]; then
    RSYNC "$src" "$SSH_TARGET:$dest"
  else
    echo "Skip: $src (not found)"
  fi
}

sync_if_dir frontend/.next/standalone/ "$REMOTE_DIR/frontend/"
sync_if_dir frontend/.next/static/ "$REMOTE_DIR/frontend/.next/static/"
sync_if_dir frontend/public/ "$REMOTE_DIR/frontend/public/"

echo "Syncing config files..."
RSYNC \
  ecosystem.config.js "$SSH_TARGET:$REMOTE_DIR/"
RSYNC \
  package.json "$SSH_TARGET:$REMOTE_DIR/"
echo "Syncing helper scripts folder..."
RSYNC \
  scripts/ "$SSH_TARGET:$REMOTE_DIR/scripts/"

echo "Creating root-level symlinks to scripts (for convenience)..."
SSH "cd '$REMOTE_DIR' && \
  ln -sf scripts/server-install.sh server-install.sh && \
  ln -sf scripts/server-start.sh server-start.sh && \
  ln -sf scripts/server-stop.sh server-stop.sh && \
  ln -sf scripts/server-restart.sh server-restart.sh && \
  ln -sf scripts/server-status.sh server-status.sh"

echo "Deployment complete!"
echo ""
echo "Cleaning up old wrapper scripts on server..."
SSH "cd '$REMOTE_DIR' && rm -f server-install server-start server-stop server-restart server-status || true"

echo "Setting execute permission on remote scripts..."
SSH "cd '$REMOTE_DIR' && chmod +x scripts/*.sh || true"

echo "Next steps on server:"
echo "1. ssh $SERVER_USER@$SERVER_IP"
echo "2. cd $REMOTE_DIR"
echo "3. ./scripts/server-install.sh"
echo "4. ./scripts/server-start.sh"
