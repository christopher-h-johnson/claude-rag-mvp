# Vector Store - OpenSearch Client Wrapper

A TypeScript client wrapper for Amazon OpenSearch Service that provides high-level operations for vector storage and k-NN search.

## Features

- **Single & Batch Indexing**: Index document embeddings individually or in bulk
- **k-NN Vector Search**: Semantic search using OpenSearch's HNSW algorithm
- **Advanced Filtering**: Filter search results by document IDs, date ranges, and custom metadata
- **Document Management**: Delete all chunks associated with a document
- **AWS Integration**: Built-in AWS Sigv4 authentication for secure access

## Installation

```bash
npm install
npm run build
```

## Usage

### Initialize the Client

```typescript
import { OpenSearchVectorStore } from './vector-store';

// Create client with default index name ('documents')
const vectorStore = new OpenSearchVectorStore(
    'your-opensearch-endpoint.us-east-1.es.amazonaws.com'
);

// Or with custom index name
const customStore = new OpenSearchVectorStore(
    'your-opensearch-endpoint.us-east-1.es.amazonaws.com',
    'custom-index',
    'us-east-1'
);
```

### Index a Single Embedding

```typescript
import { Embedding } from './vector-store';

const embedding: Embedding = {
    chunkId: 'chunk-123',
    vector: new Array(1536).fill(0.1), // 1536-dimension vector
    text: 'This is a document chunk',
    metadata: {
        documentId: 'doc-456',
        documentName: 'example.pdf',
        pageNumber: 1,
        chunkIndex: 0,
        uploadedAt: Date.now(),
        uploadedBy: 'user-123'
    }
};

await vectorStore.indexEmbedding(embedding);
```

### Batch Index Multiple Embeddings

```typescript
const embeddings: Embedding[] = [
    // ... array of embeddings
];

// More efficient than calling indexEmbedding multiple times
await vectorStore.batchIndexEmbeddings(embeddings);
```

### Search for Similar Vectors

```typescript
// Basic search
const queryVector = new Array(1536).fill(0.5);
const results = await vectorStore.searchSimilar(queryVector, 5);

console.log(results);
// [
//   {
//     chunkId: 'chunk-123',
//     score: 0.95,
//     chunk: {
//       chunkId: 'chunk-123',
//       documentId: 'doc-456',
//       documentName: 'example.pdf',
//       pageNumber: 1,
//       text: 'This is a document chunk',
//       score: 0.95,
//       metadata: { ... }
//     }
//   }
// ]
```

### Search with Filters

```typescript
import { SearchFilters } from './vector-store';

// Filter by document IDs
const filters: SearchFilters = {
    documentIds: ['doc-1', 'doc-2']
};

// Filter by date range
const dateFilters: SearchFilters = {
    dateRange: {
        start: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
        end: Date.now()
    }
};

// Filter by custom metadata
const metadataFilters: SearchFilters = {
    metadata: {
        category: 'technical',
        status: 'active'
    }
};

// Combine multiple filters
const combinedFilters: SearchFilters = {
    documentIds: ['doc-1'],
    dateRange: { start: 1000000000, end: 2000000000 },
    metadata: { category: 'technical' }
};

const results = await vectorStore.searchSimilar(queryVector, 5, combinedFilters);
```

### Delete Document

```typescript
// Delete all chunks for a document
await vectorStore.deleteDocument('doc-456');
```

## API Reference

### `OpenSearchVectorStore`

#### Constructor

```typescript
constructor(
    endpoint: string,
    indexName?: string,
    region?: string
)
```

- `endpoint`: OpenSearch domain endpoint (without `https://`)
- `indexName`: Index name (default: `'documents'`)
- `region`: AWS region (default: from `AWS_REGION` env var or `'us-east-1'`)

#### Methods

##### `indexEmbedding(embedding: Embedding): Promise<void>`

Index a single document embedding.

##### `batchIndexEmbeddings(embeddings: Embedding[]): Promise<void>`

Batch index multiple embeddings using OpenSearch bulk API.

##### `searchSimilar(queryVector: number[], k: number, filters?: SearchFilters): Promise<SearchResult[]>`

Search for similar vectors using k-NN query.

- `queryVector`: Query embedding (must be 1536 dimensions)
- `k`: Number of results to return
- `filters`: Optional search filters

##### `deleteDocument(documentId: string): Promise<void>`

Delete all chunks associated with a document.

## Types

### `Embedding`

```typescript
interface Embedding {
    chunkId: string;
    vector: number[]; // 1536 dimensions
    text: string;
    metadata: ChunkMetadata;
}
```

### `ChunkMetadata`

```typescript
interface ChunkMetadata {
    documentId: string;
    documentName: string;
    pageNumber: number;
    chunkIndex: number;
    uploadedAt: number;
    uploadedBy?: string;
}
```

### `SearchFilters`

```typescript
interface SearchFilters {
    documentIds?: string[];
    dateRange?: { start: number; end: number };
    metadata?: Record<string, any>;
}
```

### `SearchResult`

```typescript
interface SearchResult {
    chunkId: string;
    score: number;
    chunk: DocumentChunk;
}
```

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Requirements

This implementation satisfies:
- **Requirement 6.3**: Store embeddings in Vector Store with document metadata
- **Requirement 7.2**: Perform k-nearest neighbor search and return top results within 200ms

## Architecture

The client uses:
- **OpenSearch k-NN plugin** with HNSW algorithm for approximate nearest neighbor search
- **Cosine similarity** metric for vector comparison
- **AWS Sigv4 authentication** for secure access to OpenSearch
- **Bulk API** for efficient batch indexing

## Error Handling

All methods throw descriptive errors when operations fail:

```typescript
try {
    await vectorStore.indexEmbedding(embedding);
} catch (error) {
    console.error('Failed to index embedding:', error);
}
```

## Performance Considerations

- Use `batchIndexEmbeddings()` for bulk operations (more efficient than multiple `indexEmbedding()` calls)
- Query vectors must be exactly 1536 dimensions (validated before search)
- Search results are limited by the `k` parameter
- Filters are applied at the OpenSearch level for optimal performance

## License

MIT
