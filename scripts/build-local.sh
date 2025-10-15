#!/bin/bash

set -euo pipefail

# Ensure we run from repo root regardless of where invoked
cd "$(dirname "$0")/.."

echo "Building frontend for production..."

pushd frontend >/dev/null

echo "Cleaning previous build artifacts (.next)..."
rm -rf .next

if [ -f .env.local ]; then
  mv .env.local .env.local.backup
  echo "Backed up .env.local to .env.local.backup"
fi

cp -f ../.env.production .env.production

echo "Running production build (next build)..."
npm run build:prod

if [ -f .env.local.backup ]; then
  mv .env.local.backup .env.local
  echo "Restored .env.local"
fi

popd >/dev/null

echo "Build complete! Frontend build artifacts are in frontend/.next"
