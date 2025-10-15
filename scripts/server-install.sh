#!/usr/bin/env bash
set -euo pipefail

# Ensure we run from repo root
cd "$(dirname "$0")/.."

echo "Installing Python dependencies..."

if ! command -v python3 &> /dev/null; then
  echo "Python3 not found. Please install Python 3.8+ on the server."
  exit 1
fi

cd backend
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
cd ..

mkdir -p data logs

echo "Installation complete!"
