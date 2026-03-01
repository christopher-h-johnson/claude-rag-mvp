/**
 * Types and interfaces for Vector Store operations
 */

/**
 * Document chunk with embedding and metadata
 */
export interface Embedding {
    chunkId: string;
    vector: number[]; // 1024 dimensions (Titan Embeddings V2)
    text: string;
    metadata: ChunkMetadata;
}

/**
 * Metadata associated with each document chunk
 */
export interface ChunkMetadata {
    documentId: string;
    documentName: string;
    pageNumber: number;
    chunkIndex: number;
    uploadedAt: number;
    uploadedBy?: string;
}

/**
 * Search filters for vector queries
 */
export interface SearchFilters {
    documentIds?: string[];
    dateRange?: { start: number; end: number };
    metadata?: Record<string, any>;
}

/**
 * Search result from vector store
 */
export interface SearchResult {
    chunkId: string;
    score: number;
    chunk: DocumentChunk;
}

/**
 * Document chunk returned in search results
 */
export interface DocumentChunk {
    chunkId: string;
    documentId: string;
    documentName: string;
    pageNumber: number;
    text: string;
    score: number; // Similarity score
    metadata: Record<string, any>;
}

/**
 * Vector Store interface defining all operations
 */
export interface VectorStore {
    // Index document embedding
    indexEmbedding(embedding: Embedding): Promise<void>;

    // Batch index embeddings
    batchIndexEmbeddings(embeddings: Embedding[]): Promise<void>;

    // Search for similar vectors
    searchSimilar(queryVector: number[], k: number, filters?: SearchFilters): Promise<SearchResult[]>;

    // Delete document embeddings
    deleteDocument(documentId: string): Promise<void>;
}