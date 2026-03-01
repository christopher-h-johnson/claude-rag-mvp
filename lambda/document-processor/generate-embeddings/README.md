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
    "embeddings": [
      {
        "chunkId": "uuid-document-id#chunk#0",
        "documentId": "uuid-document-id",
        "embedding": [0.123, 0.456, ...],
        "text": "chunk text...",
        "chunkIndex": 0,
        "pageNumber": 1,
        "metadata": {
          "filename": "document.pdf",
          "uploadedBy": "user-id",
          "uploadedAt": 1234567890,
          "pageCount": 10
        }
      }
    ]
  }
}
```

## Environment Variables

- `AWS_REGION`: AWS region for Bedrock API (default: us-east-1)

## Dependencies

- `@aws-sdk/client-bedrock-runtime`: Bedrock API client
- `@aws-sdk/client-s3`: S3 client for downloading chunks
- `../../../shared/embeddings`: Shared embedding generator module

## Build

```bash
npm install
npm run build
```

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

Task 11.2 will wire this function to the Vector Store to index the generated embeddings in OpenSearch.
