#!/bin/bash

# Build script for Lambda functions
# This script builds all Lambda functions and creates deployment packages

set -e

echo "Building Lambda functions..."

# Function to build a Lambda function
build_lambda() {
    local lambda_dir=$1
    local lambda_name=$2
    
    echo "Building $lambda_name..."
    cd "$lambda_dir"
    
    # Install dependencies
    npm install
    
    # Build TypeScript
    npm run build
    
    # Create deployment package
    cd dist
    zip -r index.zip .
        
    echo "✓ $lambda_name built successfully"
    cd ../../..
    pwd
}

# Build all auth Lambda functions
build_lambda "auth/authorizer" "Lambda Authorizer"
build_lambda "auth/login" "Login Lambda"
build_lambda "auth/logout" "Logout Lambda"

echo ""
echo "All Lambda functions built successfully!"
echo ""
echo "Deployment packages created:"
echo "  - lambda/auth/authorizer/dist/index.zip"
echo "  - lambda/auth/login/dist/index.zip"
echo "  - lambda/auth/logout/dist/index.zip"
