#!/bin/bash
# Automated script to configure OpenSearch access for Lambda functions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}OpenSearch Access Configuration${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Change to terraform directory
cd "$(dirname "$0")/.."

# Check if Lambda functions are built
echo -e "${YELLOW}Checking if Lambda functions are built...${NC}"

if [ ! -d "../lambda/vector-store/init-index/dist/node_modules" ]; then
    echo -e "${RED}Error: init-index Lambda not built properly${NC}"
    echo "Please run: cd lambda/vector-store && bash build-all.sh"
    exit 1
fi

if [ ! -d "../lambda/vector-store/configure-access/dist/node_modules" ]; then
    echo -e "${RED}Error: configure-access Lambda not built properly${NC}"
    echo "Please run: cd lambda/vector-store && bash build-all.sh"
    exit 1
fi

echo -e "${GREEN}✓ Lambda functions are built${NC}"
echo ""

# Check if terraform outputs are available
if ! terraform output > /dev/null 2>&1; then
    echo -e "${RED}Error: Terraform outputs not available${NC}"
    echo "Please run 'terraform apply' first"
    exit 1
fi

# Get Lambda role ARN
echo -e "${YELLOW}Step 1: Getting Lambda role ARN...${NC}"
LAMBDA_ROLE_ARN=$(terraform output -raw vector_store_init_lambda_role_arn 2>/dev/null)

if [ -z "$LAMBDA_ROLE_ARN" ]; then
    echo -e "${RED}Error: Could not get Lambda role ARN${NC}"
    echo "Make sure the vector_store_init module is deployed"
    exit 1
fi

echo -e "${GREEN}✓ Lambda Role ARN: ${LAMBDA_ROLE_ARN}${NC}"
echo ""

# Get configuration Lambda function name
echo -e "${YELLOW}Step 2: Getting configuration Lambda function name...${NC}"
CONFIG_FUNCTION_NAME=$(terraform output -raw opensearch_configure_access_function_name 2>/dev/null)

if [ -z "$CONFIG_FUNCTION_NAME" ]; then
    echo -e "${RED}Error: Could not get configuration Lambda function name${NC}"
    echo "Make sure the opensearch_access_config module is deployed"
    exit 1
fi

echo -e "${GREEN}✓ Configuration Function: ${CONFIG_FUNCTION_NAME}${NC}"
echo ""

# Invoke the configuration Lambda
echo -e "${YELLOW}Step 3: Configuring OpenSearch role mapping...${NC}"
echo "Invoking Lambda function to map IAM role to OpenSearch..."

PAYLOAD="{\"lambdaRoleArn\":\"${LAMBDA_ROLE_ARN}\"}"

aws lambda invoke \
  --function-name "$CONFIG_FUNCTION_NAME" \
  --payload "$PAYLOAD" \
  --cli-binary-format raw-in-base64-out \
  response.json > /dev/null 2>&1

# Check response
if [ -f response.json ]; then
    STATUS_CODE=$(cat response.json | jq -r '.statusCode' 2>/dev/null || echo "")
    
    if [ "$STATUS_CODE" = "200" ]; then
        MESSAGE=$(cat response.json | jq -r '.body' | jq -r '.message' 2>/dev/null || echo "Success")
        echo -e "${GREEN}✓ ${MESSAGE}${NC}"
    else
        ERROR=$(cat response.json | jq -r '.body' | jq -r '.error' 2>/dev/null || echo "Unknown error")
        echo -e "${RED}✗ Error: ${ERROR}${NC}"
        cat response.json
        rm -f response.json
        exit 1
    fi
    
    rm -f response.json
else
    echo -e "${RED}✗ Error: No response from Lambda${NC}"
    exit 1
fi

echo ""

# Test the vector-store-init Lambda
echo -e "${YELLOW}Step 4: Testing vector-store-init Lambda...${NC}"
INIT_FUNCTION_NAME=$(terraform output -raw vector_store_init_function_name 2>/dev/null)

if [ -z "$INIT_FUNCTION_NAME" ]; then
    echo -e "${RED}Error: Could not get init function name${NC}"
    exit 1
fi

echo "Invoking $INIT_FUNCTION_NAME..."

aws lambda invoke \
  --function-name "$INIT_FUNCTION_NAME" \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  response.json > /dev/null 2>&1

if [ -f response.json ]; then
    STATUS_CODE=$(cat response.json | jq -r '.statusCode' 2>/dev/null || echo "")
    
    if [ "$STATUS_CODE" = "200" ]; then
        MESSAGE=$(cat response.json | jq -r '.body' | jq -r '.message' 2>/dev/null || echo "Success")
        echo -e "${GREEN}✓ ${MESSAGE}${NC}"
    else
        ERROR=$(cat response.json | jq -r '.body' | jq -r '.error' 2>/dev/null || echo "Unknown error")
        echo -e "${RED}✗ Error: ${ERROR}${NC}"
        echo "The role mapping was configured, but the init function still failed."
        echo "Check CloudWatch Logs for more details:"
        echo "  aws logs tail /aws/lambda/${INIT_FUNCTION_NAME} --follow"
        cat response.json
        rm -f response.json
        exit 1
    fi
    
    rm -f response.json
else
    echo -e "${RED}✗ Error: No response from Lambda${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Configuration Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "The OpenSearch index has been initialized and is ready for use."
echo ""
echo "Next steps:"
echo "  1. Deploy document processing Lambda functions"
echo "  2. Upload documents to S3"
echo "  3. Query the chatbot"
