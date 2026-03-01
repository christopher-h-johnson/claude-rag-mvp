# Document Processor Module - Integration Summary

## Overview

The document-processor Terraform module has been updated to include both the Document Processor Lambda (Python) and the Generate Embeddings Lambda (TypeScript), along with their integration.

## Changes Made

### 1. Added Generate Embeddings Lambda Resources

**New Resources in `main.tf`:**
- `data.archive_file.generate_embeddings` - Packages the TypeScript Lambda code
- `aws_iam_role.generate_embeddings` - IAM role for the Lambda
- `aws_iam_role_policy.generate_embeddings` - IAM policy with S3, Bedrock, KMS permissions
- `aws_lambda_function.generate_embeddings` - The Lambda function itself
- `aws_cloudwatch_log_group.generate_embeddings` - CloudWatch logs with 365-day retention

### 2. Updated Document Processor Lambda

**Modified `aws_lambda_function.document_processor`:**
- Added `EMBEDDING_GENERATOR_LAMBDA` environment variable
- Added dependency on `aws_lambda_function.generate_embeddings`

### 3. Added Integration IAM Policy

**New Resource:**
- `aws_iam_role_policy.document_processor_invoke_embeddings` - Allows Document Processor to invoke Generate Embeddings Lambda

### 4. Updated Module Variables

**Added to `variables.tf`:**
```hcl
variable "aws_region" {
  description = "AWS region for Bedrock API"
  type        = string
  default     = "us-east-1"
}
```

### 5. Updated Module Outputs

**Added to `outputs.tf`:**
```hcl
output "generate_embeddings_function_name"
output "generate_embeddings_function_arn"
output "generate_embeddings_role_arn"
```

## Architecture

```
S3 Upload Event
    ↓
Document Processor Lambda (Python)
    ├─ Extract text from PDF
    ├─ Chunk text (512 tokens, 50 overlap)
    ├─ Store chunks in S3 processed/
    └─ Invoke Generate Embeddings Lambda (async)
        ↓
Generate Embeddings Lambda (TypeScript)
    ├─ Download chunks from S3
    ├─ Generate embeddings (Bedrock Titan)
    └─ Return embeddings (for Vector Store in task 11.2)
```

## IAM Permissions

### Document Processor Role
```json
{
  "Effect": "Allow",
  "Action": ["lambda:InvokeFunction"],
  "Resource": "arn:aws:lambda:*:*:function:*-chatbot-generate-embeddings"
}
```

### Generate Embeddings Role
```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject"],
  "Resource": "arn:aws:s3:::*/processed/*"
},
{
  "Effect": "Allow",
  "Action": ["bedrock:InvokeModel"],
  "Resource": "arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v1"
},
{
  "Effect": "Allow",
  "Action": ["kms:Decrypt"],
  "Resource": "arn:aws:kms:*:*:key/*"
}
```

## Environment Variables

### Document Processor
- `DOCUMENT_METADATA_TABLE` - DynamoDB table name
- `FAILED_PROCESSING_SNS_TOPIC` - SNS topic ARN for failures
- `EMBEDDING_GENERATOR_LAMBDA` - Generate Embeddings Lambda function name
- `LOG_LEVEL` - Logging level (INFO)

### Generate Embeddings
- `AWS_REGION` - AWS region for Bedrock API
- `LOG_LEVEL` - Logging level (INFO)

## Build Requirements

Before deploying, both Lambda functions must be built:

### Document Processor Layer
```bash
cd lambda/document-processor/extract-text
./build_layer_docker.sh
```

### Generate Embeddings Lambda
```bash
# Build shared embeddings module
cd lambda/shared/embeddings
npm install && npm run build

# Build Generate Embeddings Lambda
cd ../../document-processor/generate-embeddings
npm install && npm run build
```

## Deployment

```bash
# From terraform directory
terraform plan
terraform apply
```

The module will:
1. Create Document Processor Lambda with Python layer
2. Create Generate Embeddings Lambda
3. Configure S3 event notification
4. Set up IAM roles and policies
5. Configure CloudWatch log groups
6. Wire Document Processor to invoke Generate Embeddings

## Testing

### 1. Upload a test PDF
```bash
aws s3 cp test.pdf s3://dev-chatbot-documents/uploads/test-doc-id/test.pdf
```

### 2. Check Document Processor logs
```bash
aws logs tail /aws/lambda/dev-chatbot-document-processor --follow
```

### 3. Check Generate Embeddings logs
```bash
aws logs tail /aws/lambda/dev-chatbot-generate-embeddings --follow
```

### 4. Verify chunks were created
```bash
aws s3 ls s3://dev-chatbot-documents/processed/test-doc-id/
```

Expected output:
- `chunks.json` - Text chunks with metadata
- `text.json` - Extracted text
- `pages.json` - Page-by-page text

## Monitoring

### CloudWatch Metrics
- Document Processor invocations
- Generate Embeddings invocations
- Bedrock API calls
- Processing duration
- Error rates

### CloudWatch Logs
- Document Processor: `/aws/lambda/dev-chatbot-document-processor`
- Generate Embeddings: `/aws/lambda/dev-chatbot-generate-embeddings`

### Log Retention
- Both log groups: 365 days

## Cost Considerations

### Lambda Costs
- Document Processor: 3008 MB, ~30s per document
- Generate Embeddings: 1024 MB, ~10s per document

### Bedrock Costs
- Titan Embeddings: $0.0001 per 1000 input tokens
- Average document (10 pages): ~5000 tokens = $0.0005

### S3 Costs
- Storage: Standard tier for processed files
- Requests: PUT for chunks, GET for embeddings

## Next Steps

**Task 11.2**: Wire Generate Embeddings to Vector Store
- Index embeddings in OpenSearch
- Update DocumentMetadata table with completion status
- Enable semantic search for documents

## Files Modified

### Terraform Module
- `terraform/modules/document-processor/main.tf` - Added Generate Embeddings resources
- `terraform/modules/document-processor/variables.tf` - Added aws_region variable
- `terraform/modules/document-processor/outputs.tf` - Added Generate Embeddings outputs
- `terraform/modules/document-processor/README.md` - Updated documentation

### Lambda Code
- `lambda/document-processor/extract-text/index.py` - Added embedding generator invocation
- `lambda/document-processor/generate-embeddings/` - New Lambda function

### Documentation
- `lambda/document-processor/generate-embeddings/DEPLOYMENT.md` - Updated for Terraform integration
- `terraform/modules/document-processor/INTEGRATION_SUMMARY.md` - This file

## Removed Files

- `lambda/document-processor/generate-embeddings/terraform.tf` - Moved to module
