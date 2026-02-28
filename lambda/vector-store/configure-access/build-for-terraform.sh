#!/bin/bash

# Build script for Terraform deployment
# This script builds the Lambda function and prepares it for Terraform archive_file

set -e

echo "Building configure-access Lambda for Terraform deployment..."

# Navigate to the Lambda directory
cd "$(dirname "$0")"

# Install dependencies
echo "Installing dependencies..."
npm install

# Build TypeScript
echo "Building TypeScript..."
npm run build

# Verify dist directory exists
if [ ! -d "dist" ]; then
    echo "Error: dist directory not found after build"
    exit 1
fi

# Copy node_modules to dist for Lambda deployment
echo "Copying node_modules to dist..."
cp -r node_modules dist/

# Verify required files exist
if [ ! -f "dist/index.js" ]; then
    echo "Error: dist/index.js not found"
    exit 1
fi

echo "Build complete! Ready for Terraform deployment."
echo "Terraform will create the zip file from: lambda/vector-store/configure-access/dist/"
