#!/bin/bash

# Build the Lambda function
echo "Building Lambda function..."
npm run build

# Create deployment package
echo "Creating deployment package..."
cd dist
zip -r ../init-index.zip .
cd ..

# Add node_modules to the package
zip -r init-index.zip node_modules

echo "Deployment package created: init-index.zip"
echo ""
echo "To deploy this Lambda function:"
echo "1. Upload init-index.zip to AWS Lambda"
echo "2. Set the handler to: index.handler"
echo "3. Set environment variable: OPENSEARCH_ENDPOINT"
echo "4. Attach IAM role with OpenSearch permissions"
echo "5. Configure VPC settings to access OpenSearch cluster"
