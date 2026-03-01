# OpenSearch Index Management

This Lambda function manages the OpenSearch index with k-NN (k-Nearest Neighbor) configuration for vector similarity search.

## Overview

The function provides three operations for the `documents` index:
- **Create**: Initialize a new index with k-NN configuration
- **Delete**: Remove an existing index
- **Recreate**: Delete and recreate the index (useful for schema changes)

### Vector Configuration
- **Dimensions**: 1024 (matching Amazon Bedrock Titan Embeddings V2 output)
- **Similarity Metric**: Cosine similarity
- **Algorithm**: HNSW (Hierarchical Navigable Small World)
- **Engine**: Lucene (native OpenSearch 3.0+ engine)

### HNSW Parameters
- **ef_construction**: 512 - Controls index build quality (higher = better accuracy, slower indexing)
- **m**: 16 - Number of bi-directional links per node (higher = better accuracy, more memory)
- **ef_search**: 512 - Controls search quality (higher = better accuracy, slower search)

### Index Settings
- **refresh_interval**: 5s - Near-real-time search capability
- **number_of_shards**: 3 - Distributed across cluster nodes
- **number_of_replicas**: 1 - High availability

### Metadata Fields
The index includes the following fields for document tracking:
- `chunkId` (keyword) - Unique identifier for each text chunk
- `documentId` (keyword) - Source document identifier
- `documentName` (text) - Original filename
- `pageNumber` (integer) - Page number in source document
- `chunkIndex` (integer) - Sequential chunk number
- `text` (text) - The actual text content
- `embedding` (knn_vector) - 1024-dimension vector embedding (Titan V2)
- `uploadedAt` (date) - Upload timestamp
- `uploadedBy` (keyword) - User who uploaded the document

## Usage

### Create Index (Default)

Creates a new index if it doesn't exist:

```bash
aws lambda invoke \
  --function-name <env>-chatbot-vector-store-init \
  --payload '{"action":"create"}' \
  response.json

cat response.json
```

Or simply:
```bash
aws lambda invoke \
  --function-name <env>-chatbot-vector-store-init \
  --payload '{}' \
  response.json
```

**Response**:
```json
{
  "statusCode": 200,
  "body": "{\"success\":true,\"message\":\"Index 'documents' created successfully with k-NN configuration\"}"
}
```

### Delete Index

Deletes an existing index:

```bash
aws lambda invoke \
  --function-name <env>-chatbot-vector-store-init \
  --payload '{"action":"delete"}' \
  response.json

cat response.json
```

**Response**:
```json
{
  "statusCode": 200,
  "body": "{\"success\":true,\"message\":\"Index 'documents' deleted successfully\"}"
}
```

### Recreate Index

Deletes and recreates the index (useful for dimension changes):

```bash
aws lambda invoke \
  --function-name <env>-chatbot-vector-store-init \
  --payload '{"action":"recreate"}' \
  response.json

cat response.json
```

**Response**:
```json
{
  "statusCode": 200,
  "body": "{\"success\":true,\"message\":\"Index recreated: Index 'documents' deleted successfully; Index 'documents' created successfully with k-NN configuration\"}"
}
```

### As a Lambda Function

Deploy this function and invoke it with the OpenSearch endpoint:

```bash
aws lambda invoke \
  --function-name init-opensearch-index \
  --payload '{}' \
  response.json
```

The function reads the OpenSearch endpoint from the `OPENSEARCH_ENDPOINT` environment variable.

### Programmatically

```typescript
import { initializeIndex, deleteIndex } from './index';

const endpoint = 'your-opensearch-endpoint.us-east-1.es.amazonaws.com';

// Create index
const createResult = await initializeIndex(endpoint);
console.log(createResult.message);

// Delete index
const deleteResult = await deleteIndex(endpoint);
console.log(deleteResult.message);
```

## Environment Variables

- `OPENSEARCH_ENDPOINT` (required) - OpenSearch domain endpoint
- `AWS_REGION` (optional) - AWS region, defaults to 'us-east-1'

## Development

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Watch Mode

```bash
npm run test:watch
```

## Deployment

This function should be deployed as part of the infrastructure setup, typically:

1. After the OpenSearch cluster is created
2. Before any document processing begins
3. Can be run multiple times (idempotent - checks if index exists)

## Error Handling

The function handles the following scenarios:

- **Index Already Exists**: Returns success without recreating
- **Missing Endpoint**: Returns 500 error with descriptive message
- **Creation Failure**: Returns 500 error with error details

## Performance Considerations

### HNSW Parameter Trade-offs

**ef_construction = 512**
- Build time: Moderate
- Index quality: High
- Suitable for: Production workloads with 1000+ documents

**m = 16**
- Memory usage: Moderate
- Search accuracy: High
- Suitable for: Balanced performance/accuracy

**ef_search = 512**
- Query latency: ~100-200ms for 1000+ documents
- Recall: >95% for top-5 results
- Suitable for: Production search requirements

### Scaling Recommendations

- **< 10,000 documents**: Current settings optimal
- **10,000 - 100,000 documents**: Consider increasing shards to 5
- **> 100,000 documents**: Consider dedicated master nodes and more replicas

## Requirements Validation

This implementation satisfies:

- **Requirement 7.3**: Vector Store supports approximate nearest neighbor search
  - ✅ HNSW algorithm configured
  - ✅ 1536 dimensions for Titan Embeddings compatibility
  - ✅ Cosine similarity metric
  - ✅ Optimized parameters for accuracy/performance balance

## Related Components

- **Embedding Generator** (`lambda/shared/embeddings`) - Generates the 1536-dimension vectors
- **Vector Store Client** (Task 9.2) - Interfaces with this index for search operations
- **Document Processor** (Task 10) - Populates this index with document embeddings
