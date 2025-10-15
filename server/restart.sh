#!/bin/bash

SCRIPT_DIR="$(dirname "$0")"

echo "Restarting Gov Stats Crawler..."
echo ""

"$SCRIPT_DIR/stop.sh"

echo ""
echo "Waiting 2 seconds..."
sleep 2
echo ""

"$SCRIPT_DIR/start.sh"
