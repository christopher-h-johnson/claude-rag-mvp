#!/bin/bash

set -e

echo "Building WebSocket Lambda functions..."

# Build shared utilities first
echo "Building shared utilities..."
cd shared
npm install
npm run build
cd ..

# Build connect handler
echo "Building connect handler..."
cd connect
npm install
npm run build
cd ..

# Build disconnect handler
echo "Building disconnect handler..."
cd disconnect
npm install
npm run build
cd ..

# Build message handler
echo "Building message handler..."
cd message
npm install
npm run build
cd ..

echo "All WebSocket Lambda functions built successfully!"
