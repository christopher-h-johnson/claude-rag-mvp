# Document Processing Pipeline Integration Tests

This directory contains integration tests for the complete document processing pipeline, validating the end-to-end flow from document upload through to searchable embeddings in OpenSearch.

## Test Coverage

The integration test suite validates:

1. **End-to-End Processing** (Requirement 5.1, 5.4, 6.1, 6.3)
   - Document upload to S3
   - Text extraction from PDF
   - Text chunking with token counting
   - Embedding generation via Bedrock
   - Indexing in OpenSearch

2. **Document Searchability** (Requirement 6.3)
   - Verifies documents are searchable after processing
   - Validates chunk content is retrievable

3. **Chunking with Overlap** (Requirement 5.4)
   - Validates 512 token chunks with 50 token overlap
   - Verifies overlap exists between consecutive chunks

4. **Concurrent Processing** (Requirement 5.1, 6.1)
   - Tests multiple documents processing simultaneously
   - Validates proper isolation between documents

5. **Error Handling** (Requirement 5.3)
   - Tests handling of invalid PDF files
   - Verifies failed documents are moved to dead-letter queue
   - Validates error metadata is recorded

## Prerequisites

### AWS Infrastructure

The tests require the following AWS resources to be deployed:

- **S3 Bucket**: For document storage (uploads/, processed/, failed/)
- **Lambda Functions**:
  - Extract Text Lambda (document-processor/extract-text)
  - Generate Embeddings Lambda (document-processor/generate-embeddings)
- **DynamoDB Table**: DocumentMetadata table for tracking processing status
- **OpenSearch Cluster**: For vector storage and search
- **IAM Permissions**: Test execution role needs permissions for S3, Lambda, DynamoDB, OpenSearch

### Quick Setup

**The easiest way to set up your test environment:**

```bash
# For Linux/Mac
bash setup_test_env.sh

# For Windows PowerShell
.\setup_test_env.ps1
```

This script will:
1. Extract configuration from Terraform outputs
2. Create a `.env` file with correct values
3. Verify AWS credentials
4. Check S3 bucket access
5. Validate DynamoDB table access

### Manual Setup

If you prefer to set up manually:

#### 1. Get Infrastructure Details

```bash
cd ../../../../terraform
terraform output s3_documents_bucket_name
terraform output dynamodb_document_metadata_table_name
terraform output opensearch_endpoint
```

#### 2. Set Environment Variables

Create a `.env` file or export variables:

```bash
export TEST_BUCKET_NAME="dev-chatbot-documents-177981160483"
export EXTRACT_TEXT_LAMBDA="dev-chatbot-extract-text"
export EMBEDDING_GENERATOR_LAMBDA="dev-chatbot-generate-embeddings"
export DOCUMENT_METADATA_TABLE="dev-chatbot-document-metadata"
export OPENSEARCH_ENDPOINT="vpc-dev-chatbot-opensearch-xxx.us-east-2.es.amazonaws.com"
export AWS_REGION="us-east-2"
```

#### 3. Configure IAM Permissions

Your AWS user/role needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR-BUCKET-NAME",
        "arn:aws:s3:::YOUR-BUCKET-NAME/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["lambda:InvokeFunction"],
      "Resource": ["arn:aws:lambda:*:*:function:dev-chatbot-*"]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
        "dynamodb:DescribeTable"
      ],
      "Resource": ["arn:aws:dynamodb:*:*:table/dev-chatbot-*"]
    }
  ]
}
```

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed instructions on adding these permissions.

### Python Dependencies

Install test dependencies:

```bash
pip install -r requirements.txt
```

## Running Tests

### Run All Tests

```bash
python -m unittest test_pipeline.py
```

### Run Specific Test

```bash
python -m unittest test_pipeline.TestDocumentProcessingPipeline.test_01_end_to_end_document_processing
```

### Run with Verbose Output

```bash
python -m unittest test_pipeline.py -v
```

### Run with pytest (alternative)

```bash
pip install pytest
pytest test_pipeline.py -v -s
```

## Test Execution Flow

Each test follows this pattern:

1. **Setup**: Create test PDF document with specific content
2. **Upload**: Upload document to S3 uploads/ folder
3. **Trigger**: Invoke Extract Text Lambda with S3 event
4. **Wait**: Poll DynamoDB for processing completion (up to 90 seconds)
5. **Verify**: Check S3 artifacts, DynamoDB metadata, and chunk structure
6. **Cleanup**: Delete test documents from S3, DynamoDB, and OpenSearch

## Expected Test Duration

- Individual test: 30-90 seconds (depends on Lambda cold starts)
- Full test suite: 3-5 minutes
- Concurrent processing test: 2-3 minutes

## Troubleshooting

### Tests Timeout

If tests timeout waiting for processing:

1. Check Lambda function logs in CloudWatch
2. Verify Lambda functions have correct environment variables
3. Ensure Lambda has permissions to invoke other Lambdas
4. Check OpenSearch cluster is accessible from Lambda VPC

### Tests Fail with Permission Errors

Ensure test execution role has these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::dev-chatbot-documents/*",
        "arn:aws:s3:::dev-chatbot-documents"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": [
        "arn:aws:lambda:*:*:function:dev-chatbot-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/dev-chatbot-document-metadata"
      ]
    }
  ]
}
```

### Cleanup Issues

If test cleanup fails, manually delete test documents:

```bash
# List test documents
aws s3 ls s3://dev-chatbot-documents/uploads/ --recursive

# Delete specific document
aws s3 rm s3://dev-chatbot-documents/uploads/{document-id}/ --recursive
aws s3 rm s3://dev-chatbot-documents/processed/{document-id}/ --recursive
aws s3 rm s3://dev-chatbot-documents/failed/{document-id}/ --recursive

# Delete from DynamoDB
aws dynamodb delete-item \
  --table-name dev-chatbot-document-metadata \
  --key '{"PK":{"S":"DOC#{document-id}"},"SK":{"S":"METADATA"}}'
```

## Test Data

Tests create synthetic PDF documents using ReportLab with various content:

- Simple text documents (single page)
- Multi-paragraph documents (multiple chunks)
- Long documents (testing overlap)
- Invalid PDFs (testing error handling)

All test documents are automatically cleaned up after test execution.

## CI/CD Integration

To run tests in CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Run Integration Tests
  env:
    TEST_BUCKET_NAME: ${{ secrets.TEST_BUCKET_NAME }}
    EXTRACT_TEXT_LAMBDA: ${{ secrets.EXTRACT_TEXT_LAMBDA }}
    EMBEDDING_GENERATOR_LAMBDA: ${{ secrets.EMBEDDING_GENERATOR_LAMBDA }}
    DOCUMENT_METADATA_TABLE: ${{ secrets.DOCUMENT_METADATA_TABLE }}
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    AWS_REGION: us-east-1
  run: |
    cd lambda/document-processor/tests/integration
    pip install -r requirements.txt
    python -m unittest test_pipeline.py -v
```

## Limitations

1. **OpenSearch Search**: Tests verify chunks are created but don't perform actual vector search (requires OpenSearch client setup)
2. **Embedding Verification**: Tests don't verify embedding dimensions or quality (requires Bedrock access)
3. **Performance**: Tests don't measure latency against requirements (can be added with timing assertions)

## Future Enhancements

- Add vector search verification using OpenSearch client
- Add embedding quality checks
- Add performance benchmarks
- Add load testing for concurrent processing
- Add tests for document deletion and reprocessing
