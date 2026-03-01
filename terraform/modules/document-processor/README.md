# Document Processor Lambda Module

This Terraform module creates the Document Processor Lambda function and configures S3 event notifications to automatically trigger document processing when PDFs are uploaded.

## Overview

The Document Processor Lambda function:
- Extracts text from PDF documents using pdfplumber
- Chunks text into 512-token segments with 50-token overlap
- Uses tiktoken for accurate token counting (cl100k_base encoding)
- Stores extracted text and chunks in S3 processed/ folder
- Updates DynamoDB DocumentMetadata table with processing status
- Handles failures by moving documents to S3 failed/ folder

## S3 Event Trigger Configuration

The module configures an S3 event notification that:
- **Triggers on**: `s3:ObjectCreated:*` events (PUT, POST, COPY, CompleteMultipartUpload)
- **Filter prefix**: `uploads/` (only files in the uploads/ folder)
- **Filter suffix**: `.pdf` (only PDF files)
- **Target**: Document Processor Lambda function
- **Latency**: S3 event notifications typically fire within 1-5 seconds of upload

### Event Flow

```
1. User uploads PDF to S3: s3://bucket/uploads/{documentId}/{filename}.pdf
2. S3 triggers event notification within 5 seconds
3. Lambda function is invoked with S3 event payload
4. Lambda extracts text, chunks it, and stores results
5. DynamoDB DocumentMetadata table is updated with status
```

## Requirements

This module validates the following requirements:
- **Requirement 4.3**: Document upload triggers processing within 5 seconds
- **Requirement 5.5**: Text extraction completes and triggers embedding generation

## Resources Created

- `aws_lambda_function.document_processor` - Lambda function for PDF processing
- `aws_iam_role.document_processor` - IAM role for Lambda execution
- `aws_iam_role_policy.document_processor` - IAM policy with least privilege permissions
- `aws_lambda_permission.allow_s3_invoke` - Permission for S3 to invoke Lambda
- `aws_s3_bucket_notification.document_upload` - S3 event notification configuration

## IAM Permissions

The Lambda function has the following permissions:
- **S3 Read**: `s3:GetObject` on `uploads/*`
- **S3 Write**: `s3:PutObject` on `processed/*` and `failed/*`
- **DynamoDB**: `dynamodb:UpdateItem`, `dynamodb:GetItem` on DocumentMetadata table
- **SNS**: `sns:Publish` to failed processing topic (optional)
- **KMS**: `kms:Decrypt`, `kms:GenerateDataKey` for S3 encryption
- **CloudWatch Logs**: Standard logging permissions

## Lambda Configuration

- **Runtime**: Python 3.11
- **Memory**: 3008 MB (high memory for PDF processing)
- **Timeout**: 300 seconds (5 minutes for large PDFs)
- **Handler**: `index.handler`

## Inputs

| Name | Description | Type | Required |
|------|-------------|------|----------|
| environment | Environment name | string | yes |
| documents_bucket_name | S3 documents bucket name | string | yes |
| documents_bucket_arn | S3 documents bucket ARN | string | yes |
| document_metadata_table_name | DynamoDB DocumentMetadata table name | string | yes |
| document_metadata_table_arn | DynamoDB DocumentMetadata table ARN | string | yes |
| kms_key_arn | KMS key ARN for encryption | string | yes |
| failed_processing_sns_topic_arn | SNS topic ARN for failure notifications | string | no |

## Outputs

| Name | Description |
|------|-------------|
| function_name | Document Processor Lambda function name |
| function_arn | Document Processor Lambda function ARN |
| function_invoke_arn | Document Processor Lambda function invoke ARN |
| role_arn | Document Processor Lambda IAM role ARN |

## Usage

```hcl
module "document_processor" {
  source = "./modules/document-processor"

  environment                      = var.environment
  documents_bucket_name            = module.storage.documents_bucket_name
  documents_bucket_arn             = module.storage.documents_bucket_arn
  document_metadata_table_name     = module.database.document_metadata_table_name
  document_metadata_table_arn      = module.database.document_metadata_table_arn
  kms_key_arn                      = module.security.kms_key_arn
  failed_processing_sns_topic_arn  = "" # Optional
}
```

## S3 Event Notification Details

### Event Structure

The Lambda function receives S3 events in the following format:

```json
{
  "Records": [
    {
      "eventVersion": "2.1",
      "eventSource": "aws:s3",
      "eventName": "ObjectCreated:Put",
      "s3": {
        "bucket": {
          "name": "dev-chatbot-documents-123456789012"
        },
        "object": {
          "key": "uploads/doc-uuid/document.pdf",
          "size": 1024000
        }
      }
    }
  ]
}
```

### Trigger Latency

S3 event notifications are designed to deliver events within seconds:
- **Typical latency**: 1-5 seconds
- **99th percentile**: < 10 seconds
- **Meets requirement**: Yes (requirement 4.3 specifies within 5 seconds)

### Error Handling

If the Lambda function fails:
1. S3 will retry the event notification automatically
2. Failed documents are moved to `failed/` folder
3. Error details are stored in `failed/{documentId}/error.json`
4. DynamoDB DocumentMetadata table is updated with `status=failed`
5. SNS notification is sent to administrators (if configured)

## Dependencies

This module depends on:
- **storage module**: Provides S3 bucket name and ARN
- **database module**: Provides DocumentMetadata table name and ARN
- **security module**: Provides KMS key ARN for encryption

## Notes

- The S3 bucket notification resource replaces any existing notification configuration on the bucket
- Only one S3 bucket notification resource can exist per bucket
- The Lambda permission must be created before the S3 notification to avoid circular dependencies
- The module uses `depends_on` to ensure proper resource creation order

## Testing

To test the S3 event trigger:

1. Upload a PDF to the uploads/ folder:
```bash
aws s3 cp test.pdf s3://dev-chatbot-documents-123456789012/uploads/test-doc-id/test.pdf
```

2. Check Lambda logs:
```bash
aws logs tail /aws/lambda/dev-chatbot-document-processor --follow
```

3. Verify processed files:
```bash
aws s3 ls s3://dev-chatbot-documents-123456789012/processed/test-doc-id/
```

4. Check DynamoDB status:
```bash
aws dynamodb get-item \
  --table-name dev-chatbot-document-metadata \
  --key '{"PK":{"S":"DOC#test-doc-id"},"SK":{"S":"METADATA"}}'
```
