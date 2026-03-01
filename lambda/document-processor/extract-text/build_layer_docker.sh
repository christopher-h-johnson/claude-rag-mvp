#!/bin/bash
# Build Lambda layer using Docker (for Lambda compatibility)
# This ensures the layer works on AWS Lambda (Amazon Linux 2)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAYER_DIR="$SCRIPT_DIR/layer"
ZIP_PATH="$SCRIPT_DIR/document-processor-layer.zip"

echo "Building Lambda layer using Docker..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running. Please start Docker."
    exit 1
fi

# Clean previous build
if [ -d "$LAYER_DIR" ]; then
    echo "Cleaning previous build..."
    rm -rf "$LAYER_DIR"
fi

if [ -f "$ZIP_PATH" ]; then
    rm "$ZIP_PATH"
fi

# Create layer directory
mkdir -p "$LAYER_DIR/python"

echo "Script directory: $SCRIPT_DIR"

# Verify requirements.txt exists
if [ ! -f "$SCRIPT_DIR/requirements.txt" ]; then
    echo "ERROR: requirements.txt not found at $SCRIPT_DIR/requirements.txt"
    exit 1
fi

echo "Requirements file found: $SCRIPT_DIR/requirements.txt"

echo "Installing dependencies using AWS Lambda Python 3.11 image..."
echo "This may take a few minutes (installing Rust compiler for tiktoken)..."

# Build layer using Docker with AWS Lambda Python image
# MSYS_NO_PATHCONV=1 prevents Git Bash from translating Unix paths on Windows
# --rm: Remove container after execution
# --entrypoint "": Override the Lambda entrypoint to run shell commands
# -v: Mount current directory to /var/task in container
# -w: Set working directory inside container
# tiktoken requires Rust compiler - install gcc first, then Rust, then build packages
MSYS_NO_PATHCONV=1 docker run --rm --entrypoint "" -v "$SCRIPT_DIR:/var/task" -w /var/task public.ecr.aws/lambda/python:3.11 \
    sh -c "yum install -y gcc && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && source \$HOME/.cargo/env && pip install -r requirements.txt -t layer/python --upgrade"

# Create zip file
echo "Creating layer package..."
cd "$LAYER_DIR"
zip -r "$ZIP_PATH" .

# Display results
echo ""
echo "Layer built successfully!"
echo "Layer directory: $LAYER_DIR"
echo "Zip file: $ZIP_PATH"
echo "Size: $(du -h "$ZIP_PATH" | cut -f1)"

echo ""
echo "Build complete!"
echo ""
echo "The layer directory is kept for Terraform to use."
echo "Run 'terraform apply' to deploy."
