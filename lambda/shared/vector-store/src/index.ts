/**
 * Vector Store module for OpenSearch-based vector storage and search
 * 
 * This module provides:
 * - OpenSearchVectorStore: Client wrapper for vector operations
 * - Type definitions for embeddings, search filters, and results
 * 
 * Requirements: 6.3, 7.2
 */

export { OpenSearchVectorStore } from './opensearch-client';
export {
    VectorStore,
    Embedding,
    ChunkMetadata,
    SearchFilters,
    SearchResult,
    DocumentChunk
} from './types';
