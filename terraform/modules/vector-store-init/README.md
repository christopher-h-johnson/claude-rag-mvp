# Vector Store Init Module

Terraform module for deploying the OpenSearch index initialization Lambda function.

## Overview

This module creates a Lambda function that initializes the OpenSearch `documents` index with k-NN (k-Nearest Neighbor) configuration for vector similarity search. The function must be invoked once after the infrastructure is deployed to create the index before any document processing can begin.

## Features

- Creates Lambda function with OpenSearch index initialization code
- Configures IAM role with necessary permissions
- Sets up VPC networking for OpenSearch access
- Configures CloudWatch logging with 365-day retention
- Packages Lambda code from `lambda/vector-store/init-index/dist`

## Usage

```hcl
module "vector_store_init" {
  source = "./modules/vector-store-init"

  environment           = "dev"
  opensearch_endpoint   = "search-dev-chatbot-xyz.us-east-1.es.amazonaws.com"
  opensearch_domain_arn = "arn:aws:es:us-east-1:123456789:domain/dev-chatbot-opensearch"
  subnet_ids            = ["subnet-abc123", "subnet-def456"]
  security_group_ids    = ["sg-xyz789"]
}
```

## Inputs

| Name | Description | Type | Required |
|------|-------------|------|----------|
| environment | Environment name (dev, staging, prod) | string | yes |
| opensearch_endpoint | OpenSearch domain endpoint | string | yes |
| opensearch_domain_arn | OpenSearch domain ARN | string | yes |
| subnet_ids | List of subnet IDs for Lambda VPC configuration | list(string) | yes |
| security_group_ids | List of security group IDs for Lambda VPC configuration | list(string) | yes |

## Outputs

| Name | Description |
|------|-------------|
| function_arn | ARN of the Lambda function |
| function_name | Name of the Lambda function |
| lambda_role_arn | ARN of the Lambda execution role |
| lambda_role_name | Name of the Lambda execution role |

## Post-Deployment Steps

### 1. Build the Lambda Code

```bash
cd lambda/vector-store/init-index
npm install
npm run build
```

### 2. Deploy with Terraform

```bash
cd terraform
terraform apply
```

### 3. Configure OpenSearch Access (IMPORTANT!)

The Lambda function will get a **403 Forbidden error** until you map the Lambda IAM role to an OpenSearch role. This is required when OpenSearch has fine-grained access control enabled.

**Quick fix:**
```bash
cd terraform/modules/vector-store-init/scripts
bash map_lambda_role.sh "YOUR_OPENSEARCH_ENDPOINT" "admin" "YOUR_MASTER_PASSWORD"
```

See [FIX_403_ERROR.md](./FIX_403_ERROR.md) for detailed instructions.

### 4. Invoke the Lambda Function

```bash
aws lambda invoke \
  --function-name dev-vector-store-init-index \
  --payload '{}' \
  response.json

cat response.json
```

Expected response:
```json
{
  "statusCode": 200,
  "body": "{\"success\":true,\"message\":\"Index 'documents' created successfully with k-NN configuration\"}"
}
```

## Index Configuration

The Lambda function creates an OpenSearch index with the following configuration:

### Vector Settings
- **Dimensions**: 1536 (matches Amazon Bedrock Titan Embeddings)
- **Algorithm**: HNSW (Hierarchical Navigable Small World)
- **Engine**: Lucene (native OpenSearch 3.0+ engine)
- **Similarity Metric**: Cosine similarity
- **ef_construction**: 512
- **m**: 16
- **ef_search**: 512

### Index Settings
- **refresh_interval**: 5s (near-real-time search)
- **number_of_shards**: 3
- **number_of_replicas**: 1

### Metadata Fields
- `chunkId` (keyword) - Unique chunk identifier
- `documentId` (keyword) - Source document ID
- `documentName` (text) - Original filename
- `pageNumber` (integer) - Page number in source document
- `chunkIndex` (integer) - Sequential chunk number
- `text` (text) - Actual text content
- `embedding` (knn_vector) - 1536-dimension vector
- `uploadedAt` (date) - Upload timestamp
- `uploadedBy` (keyword) - Uploader user ID

## IAM Permissions

The Lambda function requires the following permissions:

- **CloudWatch Logs**: Create log groups, streams, and put log events
- **OpenSearch**: ESHttpPut, ESHttpGet, ESHttpHead
- **VPC**: Create/describe/delete network interfaces (for VPC access)

## Troubleshooting

### 403 Forbidden Error

See [FIX_403_ERROR.md](./FIX_403_ERROR.md) for step-by-step instructions.

### Connection Timeout

- Verify Lambda is in the correct VPC and subnets
- Check security groups allow Lambda → OpenSearch traffic (port 443)
- Verify NAT Gateway is configured for outbound traffic

### Index Already Exists

The function is idempotent - it will return success if the index already exists without recreating it.

### More Issues

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for comprehensive troubleshooting guide.

## Architecture

```
┌─────────────────┐
│  Terraform      │
│  Apply          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  Lambda         │─────▶│  OpenSearch      │
│  Function       │      │  Domain          │
│  (VPC)          │◀─────│  (VPC)           │
└─────────────────┘      └──────────────────┘
         │
         ▼
┌─────────────────┐
│  CloudWatch     │
│  Logs           │
└─────────────────┘
```

## Dependencies

This module depends on:
- OpenSearch domain (must be created first)
- VPC and subnets (must be created first)
- Security groups (must be created first)
- Lambda code built and available in `lambda/vector-store/init-index/dist`

## Related Modules

- `modules/opensearch` - Creates the OpenSearch domain
- `modules/networking` - Creates VPC and subnets
- `modules/security` - Creates security groups

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.0 |
| aws | >= 5.0 |
| opensearch | >= 3.0 (for lucene engine) |

**Note:** This module uses the `lucene` engine for k-NN vector search, which requires OpenSearch 3.0+. If you're using OpenSearch 2.x, see [OPENSEARCH_3_MIGRATION.md](../../lambda/vector-store/init-index/OPENSEARCH_3_MIGRATION.md) for migration guidance.

## Notes

- The Lambda function only needs to be invoked once per environment
- The function is idempotent - safe to run multiple times
- Index creation typically takes 2-5 seconds
- The function has a 60-second timeout
- CloudWatch logs are retained for 365 days

## License

See main project LICENSE file.
