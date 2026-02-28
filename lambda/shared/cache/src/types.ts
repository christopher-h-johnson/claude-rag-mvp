/**
 * Document chunk returned from vector search
 */
export interface DocumentChunk {
    chunkId: string;
    documentId: string;
    documentName: string;
    pageNumber: number;
    text: string;
    score: number;
    metadata: Record<string, any>;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
    host: string;
    port: number;
    password?: string;
    tls?: boolean;
    connectTimeout?: number;
    maxRetriesPerRequest?: number;
}
