#!/bin/bash

# Terraform State Import Script
# This script imports existing AWS resources back into Terraform state
# Based on outputs from previous deployment

set -e

echo "=========================================="
echo "Terraform State Import Script"
echo "=========================================="
echo ""
echo "This script will import existing AWS resources into Terraform state."
echo "Make sure you have:"
echo "  1. AWS credentials configured"
echo "  2. Terraform initialized (terraform init)"
echo "  3. The correct AWS region set (us-east-2)"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."
echo ""

# Variables from outputs.txt
ACCOUNT_ID="177981160483"
REGION="us-east-2"
ENV="dev"

# VPC and Networking
echo "=== Importing VPC and Networking Resources ==="
terraform import 'module.networking.aws_vpc.main' vpc-0931aca004f158fd9
terraform import 'module.networking.aws_subnet.private[0]' subnet-008918b3cb55d47ba
terraform import 'module.networking.aws_subnet.private[1]' subnet-06c0ad86f88009604
terraform import 'module.networking.aws_subnet.private[2]' subnet-07d59f4c2a739367e
terraform import 'module.networking.aws_subnet.public[0]' subnet-0105b8dbfa5e92713
terraform import 'module.networking.aws_subnet.public[1]' subnet-085cfdbb80e96ea90
terraform import 'module.networking.aws_subnet.public[2]' subnet-0e5fb4d93319b6a82

# KMS
echo ""
echo "=== Importing KMS Key ==="
terraform import 'module.security.aws_kms_key.main' 5464812d-92bc-4993-9605-984d3b23623e

# S3
echo ""
echo "=== Importing S3 Bucket ==="
terraform import 'module.storage.aws_s3_bucket.documents' dev-chatbot-documents-177981160483

# DynamoDB Tables
echo ""
echo "=== Importing DynamoDB Tables ==="
terraform import 'module.database.aws_dynamodb_table.sessions' dev-chatbot-sessions
terraform import 'module.database.aws_dynamodb_table.chat_history' dev-chatbot-chat-history
terraform import 'module.database.aws_dynamodb_table.rate_limits' dev-chatbot-rate-limits
terraform import 'module.database.aws_dynamodb_table.document_metadata' dev-chatbot-document-metadata

# OpenSearch
echo ""
echo "=== Importing OpenSearch Domain ==="
terraform import 'module.opensearch.aws_opensearch_domain.main' dev-chatbot-opensearch

# IAM Role
echo ""
echo "=== Importing IAM Role ==="
terraform import 'module.security.aws_iam_role.lambda_execution' dev-lambda-execution-20260225173614468800000002

# CloudWatch Log Groups
echo ""
echo "=== Importing CloudWatch Log Groups ==="
terraform import 'module.monitoring.aws_cloudwatch_log_group.api_gateway' '//aws/apigateway/dev-chatbot'
terraform import 'module.monitoring.aws_cloudwatch_log_group.application_logs' '//aws/chatbot/dev/application'
terraform import 'module.monitoring.aws_cloudwatch_log_group.audit_logs' '//aws/chatbot/dev/audit'

echo ""
echo "=========================================="
echo "Import Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Run 'terraform plan' to verify the state"
echo "  2. Review any differences between state and configuration"
echo "  3. Run 'terraform apply' if needed to reconcile differences"
echo ""
