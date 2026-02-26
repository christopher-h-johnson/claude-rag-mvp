#!/bin/bash

set -e

echo "Building WebSocket Lambda functions..."

# Function to build a Lambda function
build_lambda() {
    local lambda_dir=$1
    local lambda_name=$2
    
    echo "Building $lambda_name..."
    cd "$lambda_dir"
    
    # Clean dist directory
    rm -rf dist
    mkdir -p dist
    
    # Install ALL dependencies (including dev dependencies for TypeScript compilation)
    npm install
    
    # Build TypeScript (this will output to dist/)
    npm run build
    
    # Remove existing node_modules and reinstall only production dependencies
    rm -rf node_modules
    npm install --production
    
    # Copy production node_modules to dist for Lambda deployment
    echo "Copying production node_modules to dist..."
    cp -r node_modules dist/
    
    echo "✓ $lambda_name built successfully"
    cd ..
}

# Build shared utilities first
echo "Building shared utilities..."
cd shared
npm install
npm run build
cd ..

# Build WebSocket handlers
build_lambda "connect" "WebSocket Connect Handler"
build_lambda "disconnect" "WebSocket Disconnect Handler"
build_lambda "message" "WebSocket Message Handler"

echo ""
echo "All WebSocket Lambda functions built successfully!"
echo ""
echo "Ready for Terraform deployment. Terraform will automatically package:"
echo "  - lambda/websocket/connect/dist/"
echo "  - lambda/websocket/disconnect/dist/"
echo "  - lambda/websocket/message/dist/"
