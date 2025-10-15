#!/bin/bash

set -e

echo "Building frontend for production..."

cd frontend

if [ -f .env.local ]; then
  mv .env.local .env.local.backup
  echo "Backed up .env.local to .env.local.backup"
fi

cp ../.env.production .env.production

echo "Running production build..."
npm run build:prod

if [ -f .env.local.backup ]; then
  mv .env.local.backup .env.local
  echo "Restored .env.local"
fi

cd ..

echo "Build complete! Frontend build artifacts are in frontend/.next"
