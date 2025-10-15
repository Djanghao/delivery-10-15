#!/bin/bash

echo "Restarting Gov Stats Crawler..."
echo ""

./stop.sh

echo ""
echo "Waiting 2 seconds..."
sleep 2
echo ""

./start.sh
