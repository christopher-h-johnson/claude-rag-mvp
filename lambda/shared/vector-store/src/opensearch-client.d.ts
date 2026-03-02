import { VectorStore, Embedding, SearchFilters, SearchResult } from './types.js';
/**
 * OpenSearch client wrapper for vector storage and search operations
 *
 * This client provides a high-level interface for:
 * - Indexing document embeddings with metadata
 * - Batch indexing for efficient bulk operations
 * - k-NN vector search with filtering capabilities
 * - Document deletion and cleanup
 *
 * Requirements: 6.3, 7.2
 */
export declare class OpenSearchVectorStore implements VectorStore {
    private client;
    private indexName;
    /**
     * Creates an OpenSearch Vector Store client
     *
     * @param endpoint - OpenSearch domain endpoint (without https://)
     * @param indexName - Name of the index to use (default: 'documents')
     * @param region - AWS region (default: from AWS_REGION env var or 'us-east-1')
     */
    constructor(endpoint: string, indexName?: string, region?: string);
    /**
     * Index a single document embedding
     *
     * @param embedding - Document chunk with vector and metadata
     * @returns Promise that resolves when indexing is complete
     *
     * Requirements: 6.3
     */
    indexEmbedding(embedding: Embedding): Promise<void>;
    /**
     * Batch index multiple embeddings using bulk API
     *
     * This method is more efficient than calling indexEmbedding multiple times
     * as it uses OpenSearch's bulk API to index documents in a single request.
     *
     * @param embeddings - Array of document chunks with vectors and metadata
     * @returns Promise that resolves when all embeddings are indexed
     *
     * Requirements: 6.3
     */
    batchIndexEmbeddings(embeddings: Embedding[]): Promise<void>;
    /**
     * Search for similar vectors using k-NN query
     *
     * Uses OpenSearch's k-NN plugin with HNSW algorithm for approximate
     * nearest neighbor search. Supports optional filtering by document IDs,
     * date range, and custom metadata.
     *
     * @param queryVector - Query embedding vector (1024 dimensions)
     * @param k - Number of results to return
     * @param filters - Optional filters for search refinement
     * @returns Array of search results with scores and document chunks
     *
     * Requirements: 7.2
     */
    searchSimilar(queryVector: number[], k: number, filters?: SearchFilters): Promise<SearchResult[]>;
    /**
     * Delete all chunks for a document
     *
     * Removes all embeddings associated with a specific document ID.
     * This is useful when a document is deleted or needs to be reprocessed.
     *
     * @param documentId - ID of the document to delete
     * @returns Promise that resolves when deletion is complete
     *
     * Requirements: 6.3
     */
    deleteDocument(documentId: string): Promise<void>;
}
//# sourceMappingURL=opensearch-client.d.ts.map