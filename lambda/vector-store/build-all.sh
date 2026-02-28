#!/bin/bash

# Build all vector store Lambda functions for Terraform deployment

set -e

echo "=========================================="
echo "Building Vector Store Lambda Functions"
echo "=========================================="
echo ""

# Build init-index Lambda
echo "Building init-index Lambda..."
cd "$(dirname "$0")/init-index"
npm run build:terraform
echo "✓ init-index built successfully"
echo ""

# Build configure-access Lambda
echo "Building configure-access Lambda..."
cd ../configure-access
npm run build:terraform
echo "✓ configure-access built successfully"
echo ""

echo "=========================================="
echo "✓ All Lambda functions built successfully"
echo "=========================================="
echo ""
echo "Ready for Terraform deployment!"
echo "Run: cd terraform && terraform apply"
