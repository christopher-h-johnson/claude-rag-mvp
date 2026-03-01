#!/bin/bash

# Setup Test Environment for Integration Tests
# This script extracts configuration from Terraform outputs and sets environment variables

set -e

echo "=== Setting up Integration Test Environment ==="
echo ""

# Check if terraform directory exists
if [ ! -d "../../../../terraform" ]; then
    echo "Error: Terraform directory not found"
    echo "Please run this script from lambda/document-processor/tests/integration/"
    exit 1
fi

# Get Terraform outputs
echo "Extracting configuration from Terraform..."
cd ../../../../terraform

# Check if terraform state exists
if [ ! -f "terraform.tfstate" ]; then
    echo "Error: Terraform state not found. Please deploy infrastructure first."
    exit 1
fi

# Extract values from terraform output
BUCKET_NAME=$(terraform output -raw s3_documents_bucket_name 2>/dev/null || echo "")
OPENSEARCH_ENDPOINT=$(terraform output -raw opensearch_endpoint 2>/dev/null || echo "")
METADATA_TABLE=$(terraform output -raw dynamodb_document_metadata_table_name 2>/dev/null || echo "")

cd - > /dev/null

# Validate required values
if [ -z "$BUCKET_NAME" ]; then
    echo "Error: Could not extract S3 bucket name from Terraform"
    exit 1
fi

# Create .env file
ENV_FILE=".env"
echo "Creating $ENV_FILE..."

cat > "$ENV_FILE" << EOF
# AWS Configuration
AWS_REGION=us-east-2
AWS_PROFILE=default

# S3 Configuration
TEST_BUCKET_NAME=$BUCKET_NAME

# Lambda Functions
EXTRACT_TEXT_LAMBDA=dev-chatbot-document-processor
EMBEDDING_GENERATOR_LAMBDA=dev-chatbot-generate-embeddings

# DynamoDB Tables
DOCUMENT_METADATA_TABLE=$METADATA_TABLE

# OpenSearch Configuration
OPENSEARCH_ENDPOINT=$OPENSEARCH_ENDPOINT
OPENSEARCH_INDEX=documents

# Test Configuration
TEST_TIMEOUT=90
EOF

echo "✓ Environment file created: $ENV_FILE"
echo ""
echo "Configuration:"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  Metadata Table: $METADATA_TABLE"
echo "  OpenSearch: $OPENSEARCH_ENDPOINT"
echo ""

# Check AWS credentials
echo "Checking AWS credentials..."
if aws sts get-caller-identity > /dev/null 2>&1; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    USER_ARN=$(aws sts get-caller-identity --query Arn --output text)
    echo "✓ AWS credentials valid"
    echo "  Account: $ACCOUNT_ID"
    echo "  Identity: $USER_ARN"
else
    echo "✗ AWS credentials not configured or invalid"
    echo "  Please configure AWS credentials using 'aws configure' or set AWS_PROFILE"
    exit 1
fi

echo ""

# Check S3 bucket access
echo "Checking S3 bucket access..."
if aws s3 ls "s3://$BUCKET_NAME" > /dev/null 2>&1; then
    echo "✓ S3 bucket access verified"
else
    echo "✗ Cannot access S3 bucket: $BUCKET_NAME"
    echo ""
    echo "Your IAM user/role needs the following permissions:"
    echo "  - s3:ListBucket on arn:aws:s3:::$BUCKET_NAME"
    echo "  - s3:GetObject on arn:aws:s3:::$BUCKET_NAME/*"
    echo "  - s3:PutObject on arn:aws:s3:::$BUCKET_NAME/*"
    echo "  - s3:DeleteObject on arn:aws:s3:::$BUCKET_NAME/*"
    echo ""
    echo "You can add these permissions using the AWS IAM console or CLI."
    exit 1
fi

echo ""

# Check DynamoDB table access
echo "Checking DynamoDB table access..."
if aws dynamodb describe-table --table-name "$METADATA_TABLE" > /dev/null 2>&1; then
    echo "✓ DynamoDB table access verified"
else
    echo "✗ Cannot access DynamoDB table: $METADATA_TABLE"
    echo ""
    echo "Your IAM user/role needs the following permissions:"
    echo "  - dynamodb:DescribeTable on arn:aws:dynamodb:*:*:table/$METADATA_TABLE"
    echo "  - dynamodb:GetItem on arn:aws:dynamodb:*:*:table/$METADATA_TABLE"
    echo "  - dynamodb:PutItem on arn:aws:dynamodb:*:*:table/$METADATA_TABLE"
    echo "  - dynamodb:DeleteItem on arn:aws:dynamodb:*:*:table/$METADATA_TABLE"
    exit 1
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To run tests, use one of the following:"
echo "  1. Source the .env file: source .env && python -m unittest test_pipeline.py"
echo "  2. Use the run script: ./run_tests.sh"
echo "  3. Load .env in your IDE and run tests"
echo ""
