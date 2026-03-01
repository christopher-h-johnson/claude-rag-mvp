#!/bin/bash

# Integration Test Runner for Document Processing Pipeline
# 
# This script sets up the environment and runs integration tests
# for the document processing pipeline.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Document Processing Pipeline Integration Tests"
echo "=========================================="
echo ""

# Check if .env file exists and load it
if [ -f ".env" ]; then
    echo -e "${GREEN}Loading environment from .env file...${NC}"
    export $(grep -v '^#' .env | xargs)
    echo "✓ Environment loaded"
    echo ""
elif [ -f "setup_test_env.sh" ]; then
    echo -e "${YELLOW}.env file not found. Running setup script...${NC}"
    echo ""
    bash setup_test_env.sh
    echo ""
    echo -e "${GREEN}Loading environment from .env file...${NC}"
    export $(grep -v '^#' .env | xargs)
    echo "✓ Environment loaded"
    echo ""
fi

# Check if required environment variables are set
REQUIRED_VARS=(
    "TEST_BUCKET_NAME"
    "EXTRACT_TEXT_LAMBDA"
    "EMBEDDING_GENERATOR_LAMBDA"
    "DOCUMENT_METADATA_TABLE"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${RED}Error: Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Please run setup_test_env.sh to configure the environment:"
    echo "  bash setup_test_env.sh"
    echo ""
    echo "Or set these variables manually:"
    echo "  export TEST_BUCKET_NAME=\"your-bucket-name\""
    echo "  export EXTRACT_TEXT_LAMBDA=\"dev-chatbot-extract-text\""
    echo "  export EMBEDDING_GENERATOR_LAMBDA=\"dev-chatbot-generate-embeddings\""
    echo "  export DOCUMENT_METADATA_TABLE=\"dev-chatbot-document-metadata\""
    echo ""
    exit 1
fi

# Display configuration
echo -e "${GREEN}Configuration:${NC}"
echo "  Bucket: $TEST_BUCKET_NAME"
echo "  Extract Lambda: $EXTRACT_TEXT_LAMBDA"
echo "  Embedding Lambda: $EMBEDDING_LAMBDA"
echo "  Metadata Table: $DOCUMENT_METADATA_TABLE"
echo "  AWS Region: ${AWS_REGION:-us-east-1}"
echo ""

# Check if dependencies are installed
echo -e "${YELLOW}Checking dependencies...${NC}"
if ! python3 -c "import boto3" 2>/dev/null; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
else
    echo "Dependencies already installed"
fi
echo ""

# Run tests
echo -e "${GREEN}Running integration tests...${NC}"
echo ""

if [ "$1" == "-v" ] || [ "$1" == "--verbose" ]; then
    python3 -m unittest test_pipeline.py -v
else
    python3 -m unittest test_pipeline.py
fi

TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
else
    echo -e "${RED}✗ Some tests failed${NC}"
fi

exit $TEST_EXIT_CODE

