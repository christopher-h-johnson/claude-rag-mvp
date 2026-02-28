import Redis from 'ioredis';
import { createHash } from 'crypto';
import type { CacheConfig, DocumentChunk } from './types.js';

/**
 * Cache utility for storing Bedrock responses and search results
 * Implements graceful error handling - returns cache miss on Redis errors
 */
export class CacheLayer {
    private redis: Redis | null = null;
    private connectionFailed = false;

    constructor(config: CacheConfig) {
        try {
            this.redis = new Redis({
                host: config.host,
                port: config.port,
                password: config.password,
                tls: config.tls ? {} : undefined,
                connectTimeout: config.connectTimeout || 5000,
                maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
                retryStrategy: (times: number) => {
                    // Stop retrying after 3 attempts
                    if (times > 3) {
                        this.connectionFailed = true;
                        return null;
                    }
                    // Exponential backoff: 100ms, 200ms, 400ms
                    return Math.min(times * 100, 1000);
                },
                lazyConnect: true,
            });

            // Handle connection errors gracefully
            this.redis.on('error', (err) => {
                console.error('Redis connection error:', err.message);
                this.connectionFailed = true;
            });

            this.redis.on('connect', () => {
                console.log('Redis connected successfully');
                this.connectionFailed = false;
            });
        } catch (error) {
            console.error('Failed to initialize Redis client:', error);
            this.connectionFailed = true;
        }
    }

    /**
     * Hash a query string using SHA-256
     */
    private hashQuery(query: string): string {
        return createHash('sha256').update(query).digest('hex');
    }

    /**
     * Hash an embedding vector using SHA-256
     */
    private hashEmbedding(embedding: number[]): string {
        const embeddingStr = embedding.join(',');
        return createHash('sha256').update(embeddingStr).digest('hex');
    }

    /**
     * Get cached Bedrock response for a query
     * Returns null on cache miss or Redis error
     */
    async getCachedResponse(query: string): Promise<string | null> {
        if (this.connectionFailed || !this.redis) {
            return null;
        }

        try {
            const key = `bedrock:${this.hashQuery(query)}`;
            const cached = await this.redis.get(key);
            return cached;
        } catch (error) {
            console.error('Error getting cached response:', error);
            return null; // Treat error as cache miss
        }
    }

    /**
     * Set cached Bedrock response with TTL
     * TTL: 3600 seconds (1 hour) for Bedrock responses
     */
    async setCachedResponse(query: string, response: string): Promise<void> {
        if (this.connectionFailed || !this.redis) {
            return;
        }

        try {
            const key = `bedrock:${this.hashQuery(query)}`;
            const ttl = 3600; // 1 hour
            await this.redis.setex(key, ttl, response);
        } catch (error) {
            console.error('Error setting cached response:', error);
            // Fail silently - caching is not critical
        }
    }

    /**
     * Get cached search results for a query embedding
     * Returns null on cache miss or Redis error
     */
    async getCachedSearchResults(queryEmbedding: number[]): Promise<DocumentChunk[] | null> {
        if (this.connectionFailed || !this.redis) {
            return null;
        }

        try {
            const key = `search:${this.hashEmbedding(queryEmbedding)}`;
            const cached = await this.redis.get(key);

            if (!cached) {
                return null;
            }

            return JSON.parse(cached) as DocumentChunk[];
        } catch (error) {
            console.error('Error getting cached search results:', error);
            return null; // Treat error as cache miss
        }
    }

    /**
     * Set cached search results with TTL
     * TTL: 900 seconds (15 minutes) for search results
     */
    async setCachedSearchResults(queryEmbedding: number[], results: DocumentChunk[]): Promise<void> {
        if (this.connectionFailed || !this.redis) {
            return;
        }

        try {
            const key = `search:${this.hashEmbedding(queryEmbedding)}`;
            const ttl = 900; // 15 minutes
            const serialized = JSON.stringify(results);
            await this.redis.setex(key, ttl, serialized);
        } catch (error) {
            console.error('Error setting cached search results:', error);
            // Fail silently - caching is not critical
        }
    }

    /**
     * Connect to Redis (call this before using the cache)
     */
    async connect(): Promise<void> {
        if (!this.redis || this.connectionFailed) {
            return;
        }

        try {
            await this.redis.connect();
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            this.connectionFailed = true;
        }
    }

    /**
     * Disconnect from Redis
     */
    async disconnect(): Promise<void> {
        if (this.redis) {
            try {
                await this.redis.quit();
            } catch (error) {
                console.error('Error disconnecting from Redis:', error);
            }
        }
    }

    /**
     * Check if cache is available
     */
    isAvailable(): boolean {
        return !this.connectionFailed && this.redis !== null;
    }
}
