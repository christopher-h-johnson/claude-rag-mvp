# Generate Embeddings Lambda Function

This Lambda function generates vector embeddings for document chunks using Amazon Bedrock Titan Embeddings model. It's invoked by the Document Processor after text extraction and chunking.

## Overview

The Generate Embeddings Lambda is part of the document processing pipeline:

1. **Document Processor** extracts text and creates chunks
2. **Generate Embeddings** (this function) creates vector embeddings for each chunk
3. **Vector Store** indexes the embeddings for semantic search (task 11.2)

## Features

- Generates 1536-dimension embeddings using Amazon Bedrock Titan Embeddings
- Processes chunks in batches of 25 for optimal throughput
- Includes progress tracking for large document sets
- Handles retry logic with exponential backoff for throttling errors
- Preserves chunk metadata (page numbers, document info) with embeddings

## Requirements

Validates:
- **Requirement 5.5**: Document processing triggers embedding generation
- **Requirement 6.1**: Embeddings generated using Amazon Bedrock Titan Embeddings
- **Requirement 6.3**: Embeddings stored in Vector Store with document metadata
- **Requirement 6.4**: Each embedding associated with source document ID and page number

## Input Event

```json
{
  "bucket": "chatbot-documents-bucket",
  "documentId": "uuid-document-id",
  "chunksKey": "processed/uuid-document-id/chunks.json"
}
```

## Output

```json
{
  "statusCode": 200,
  "body": {
    "documentId": "uuid-document-id",
    "embeddingsCount": 42,
    "status": "completed",
    "message": "Embeddings generated and indexed successfully"
  }
}
```

The function also:
- Indexes embeddings in OpenSearch for semantic search
- Updates DocumentMetadata table with `chunkCount` and `status=completed`

## Environment Variables

- `AWS_REGION`: AWS region for Bedrock API (default: us-east-1)
- `OPENSEARCH_ENDPOINT`: OpenSearch domain endpoint (without https://)
- `OPENSEARCH_INDEX`: Index name for documents (default: documents)
- `DOCUMENT_METADATA_TABLE`: DynamoDB table name for document metadata

## Dependencies

- `@aws-sdk/client-bedrock-runtime`: Bedrock API client
- `@aws-sdk/client-s3`: S3 client for downloading chunks
- `@aws-sdk/client-dynamodb`: DynamoDB client for updating document metadata
- `../../../shared/embeddings`: Shared embedding generator module
- `../../../shared/vector-store`: Shared OpenSearch vector store client

**Note**: This Lambda uses ES modules. See [ES_MODULES_SETUP.md](./ES_MODULES_SETUP.md) for configuration details.

## Build

### For Development (Type Checking)
```bash
npm install
npm run build
```

### For Lambda Deployment
```bash
npm run build:lambda
```

This uses the cross-platform Node.js build script that:
- Compiles TypeScript to ES2022
- Renames output to `index.mjs` for explicit ES module support
- Copies dependencies and shared modules
- Fixes import paths for Lambda deployment
- Ensures proper ES module configuration

See [ES_MODULES_SETUP.md](./ES_MODULES_SETUP.md) for details on the ES module configuration.

## Test

```bash
npm test
```

## Deployment

This Lambda function is deployed via Terraform as part of the document processing infrastructure.

## Integration

The Document Processor invokes this Lambda asynchronously after chunking:

```python
lambda_client.invoke(
    FunctionName=EMBEDDING_GENERATOR_LAMBDA,
    InvocationType='Event',  # Asynchronous
    Payload=json.dumps({
        'bucket': bucket,
        'documentId': document_id,
        'chunksKey': chunks_key
    })
)
```

## Next Steps

This function is now fully integrated with the Vector Store (Task 11.2 complete). The document processing pipeline is:

1. PDF Upload → S3
2. Document Processor → Extract text and chunk
3. Generate Embeddings → Create vectors (this function)
4. OpenSearch → Index embeddings for search
5. DynamoDB → Update document metadata

Next tasks:
- **Task 12**: Implement Upload Handler for document management
- **Task 13**: Implement Query Router for RAG classification
- **Task 14**: Implement RAG System for semantic search and retrieval
