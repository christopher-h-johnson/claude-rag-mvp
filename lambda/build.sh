#!/bin/bash

# Build script for Lambda functions
# This script builds all Lambda functions and prepares them for deployment

set -e

echo "Building Lambda functions..."

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
    
    # Rename .js files to .mjs for ES modules
    echo "Renaming .js files to .mjs..."
    find dist -name "*.js" -type f -exec sh -c 'mv "$1" "${1%.js}.mjs"' _ {} \;
    
    # Remove existing node_modules and reinstall only production dependencies
    rm -rf node_modules
    npm install --production
    
    # Copy production node_modules to dist for Lambda deployment
    echo "Copying production node_modules to dist..."
    cp -r node_modules dist/
    
    echo "✓ $lambda_name built successfully"
    cd ../..
}

echo "=== Building Auth Lambda functions ==="
# Build all auth Lambda functions
build_lambda "auth/authorizer" "Lambda Authorizer"
build_lambda "auth/login" "Login Lambda"
build_lambda "auth/logout" "Logout Lambda"

echo ""
echo "=== Building WebSocket Lambda functions ==="
# Build WebSocket shared utilities first
echo "Building WebSocket shared utilities..."
cd websocket/shared
npm install
npm run build
# Rename .js to .mjs
find dist -name "*.js" -type f -exec sh -c 'mv "$1" "${1%.js}.mjs"' _ {} \;
cd ../..

# Build WebSocket handlers
build_lambda "websocket/connect" "WebSocket Connect Handler"
build_lambda "websocket/disconnect" "WebSocket Disconnect Handler"
build_lambda "websocket/message" "WebSocket Message Handler"

echo ""
echo "All Lambda functions built successfully!"
echo ""
echo "Ready for Terraform deployment. Terraform will automatically package:"
echo "  Auth Functions:"
echo "    - lambda/auth/authorizer/dist/"
echo "    - lambda/auth/login/dist/"
echo "    - lambda/auth/logout/dist/"
echo "  WebSocket Functions:"
echo "    - lambda/websocket/connect/dist/"
echo "    - lambda/websocket/disconnect/dist/"
echo "    - lambda/websocket/message/dist/"
