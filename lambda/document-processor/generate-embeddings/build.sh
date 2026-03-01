#!/bin/bash

# Build script for Generate Embeddings Lambda
# This script now delegates to the cross-platform Node.js build script

set -e

echo "Building Generate Embeddings Lambda..."
echo "Using Node.js build script for cross-platform compatibility..."

node build.mjs
