#!/bin/bash

# Build script for Generate Embeddings Lambda

set -e

echo "Building Generate Embeddings Lambda..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Build TypeScript
echo "Compiling TypeScript..."
npm run build

# Copy node_modules to dist for Lambda deployment
echo "Copying node_modules to dist..."
cp -r node_modules dist/

# Copy shared embeddings module
echo "Copying shared embeddings module..."
mkdir -p dist/shared
cp -r ../../shared/embeddings/dist/* dist/shared/

# Fix import path in index.js to reference local shared folder
echo "Fixing import paths in index.js..."
sed -i.bak "s|from '../../../shared/embeddings/dist/index.js'|from './shared/index.js'|g" dist/index.js
rm -f dist/index.js.bak

echo "Build complete!"
echo "Output: dist/index.js"
echo "Dependencies: dist/node_modules/"
echo "Shared module: dist/shared/"
