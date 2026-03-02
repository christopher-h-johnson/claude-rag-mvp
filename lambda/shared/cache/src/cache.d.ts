import type { CacheConfig, DocumentChunk } from './types.js';
/**
 * Cache utility for storing Bedrock responses and search results
 * Implements graceful error handling - returns cache miss on Redis errors
 */
export declare class CacheLayer {
    private redis;
    private connectionFailed;
    constructor(config: CacheConfig);
    /**
     * Hash a query string using SHA-256
     */
    private hashQuery;
    /**
     * Hash an embedding vector using SHA-256
     */
    private hashEmbedding;
    /**
     * Get cached Bedrock response for a query
     * Returns null on cache miss or Redis error
     */
    getCachedResponse(query: string): Promise<string | null>;
    /**
     * Set cached Bedrock response with TTL
     * TTL: 3600 seconds (1 hour) for Bedrock responses
     */
    setCachedResponse(query: string, response: string): Promise<void>;
    /**
     * Get cached search results for a query embedding
     * Returns null on cache miss or Redis error
     */
    getCachedSearchResults(queryEmbedding: number[]): Promise<DocumentChunk[] | null>;
    /**
     * Set cached search results with TTL
     * TTL: 900 seconds (15 minutes) for search results
     */
    setCachedSearchResults(queryEmbedding: number[], results: DocumentChunk[]): Promise<void>;
    /**
     * Connect to Redis (call this before using the cache)
     */
    connect(): Promise<void>;
    /**
     * Disconnect from Redis
     */
    disconnect(): Promise<void>;
    /**
     * Check if cache is available
     */
    isAvailable(): boolean;
}
//# sourceMappingURL=cache.d.ts.map