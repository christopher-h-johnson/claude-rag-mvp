#!/bin/bash

# Build script for Terraform deployment
# This script builds the Lambda function and prepares it for Terraform archive_file

set -e

echo "Building vector store init index Lambda for Terraform deployment..."

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

# Rename .js files to .mjs for ES module compatibility
echo "Renaming .js files to .mjs for ES modules..."
find dist -name "*.js" -type f -exec sh -c 'mv "$1" "${1%.js}.mjs"' _ {} \;

# Copy node_modules to dist for Lambda deployment
echo "Copying node_modules to dist..."
cp -r node_modules dist/

# Verify required files exist
if [ ! -f "dist/index.mjs" ]; then
    echo "Error: dist/index.mjs not found"
    exit 1
fi

echo "Build complete! Ready for Terraform deployment."
echo "Terraform will create the zip file from: lambda/vector-store/init-index/dist/"
