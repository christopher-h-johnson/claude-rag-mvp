#!/bin/bash
# Map Lambda IAM role to OpenSearch all_access role

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required arguments are provided
if [ $# -lt 3 ]; then
    echo -e "${RED}Usage: $0 <opensearch_endpoint> <master_user> <master_password> [lambda_role_arn]${NC}"
    echo ""
    echo "Example:"
    echo "  $0 search-dev-chatbot-xyz.us-east-1.es.amazonaws.com admin MyPassword123!"
    echo ""
    echo "Or with explicit role ARN:"
    echo "  $0 search-dev-chatbot-xyz.us-east-1.es.amazonaws.com admin MyPassword123! arn:aws:iam::123456789:role/dev-vector-store-init-role"
    exit 1
fi

OPENSEARCH_ENDPOINT=$1
MASTER_USER=$2
MASTER_PASSWORD=$3
LAMBDA_ROLE_ARN=${4:-""}

# If Lambda role ARN not provided, try to get it from Terraform
if [ -z "$LAMBDA_ROLE_ARN" ]; then
    echo -e "${YELLOW}Getting Lambda role ARN from Terraform...${NC}"
    cd "$(dirname "$0")/../../../"
    LAMBDA_ROLE_ARN=$(terraform output -raw vector_store_init_lambda_role_arn 2>/dev/null || echo "")
    
    if [ -z "$LAMBDA_ROLE_ARN" ]; then
        echo -e "${RED}Error: Could not get Lambda role ARN from Terraform${NC}"
        echo "Please provide it as the 4th argument"
        exit 1
    fi
fi

echo -e "${GREEN}Configuring OpenSearch role mapping...${NC}"
echo "  Endpoint: $OPENSEARCH_ENDPOINT"
echo "  Lambda Role: $LAMBDA_ROLE_ARN"
echo ""

# Get current role mapping
echo -e "${YELLOW}Fetching current role mapping...${NC}"
CURRENT_MAPPING=$(curl -s -X GET \
    "https://${OPENSEARCH_ENDPOINT}/_plugins/_security/api/rolesmapping/all_access" \
    -u "${MASTER_USER}:${MASTER_PASSWORD}" \
    -H "Content-Type: application/json")

echo "Current mapping: $CURRENT_MAPPING"
echo ""

# Extract backend_roles array and add our Lambda role if not present
BACKEND_ROLES=$(echo "$CURRENT_MAPPING" | jq -r '.all_access.backend_roles // []' | jq -c ". + [\"$LAMBDA_ROLE_ARN\"] | unique")

# Update role mapping
echo -e "${YELLOW}Updating role mapping...${NC}"
RESPONSE=$(curl -s -X PUT \
    "https://${OPENSEARCH_ENDPOINT}/_plugins/_security/api/rolesmapping/all_access" \
    -u "${MASTER_USER}:${MASTER_PASSWORD}" \
    -H "Content-Type: application/json" \
    -d "{
        \"backend_roles\": $BACKEND_ROLES,
        \"hosts\": [],
        \"users\": []
    }")

# Check if successful
if echo "$RESPONSE" | jq -e '.status == "OK" or .status == "CREATED"' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Successfully mapped Lambda role to OpenSearch all_access role${NC}"
    echo ""
    echo "You can now invoke the Lambda function:"
    echo "  aws lambda invoke --function-name dev-vector-store-init-index --payload '{}' response.json"
else
    echo -e "${RED}✗ Error updating role mapping${NC}"
    echo "Response: $RESPONSE"
    exit 1
fi
