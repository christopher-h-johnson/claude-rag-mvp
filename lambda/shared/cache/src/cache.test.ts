import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheLayer } from './cache.js';
import type { DocumentChunk } from './types.js';

// Mock ioredis
vi.mock('ioredis', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            connect: vi.fn().mockResolvedValue(undefined),
            quit: vi.fn().mockResolvedValue(undefined),
            get: vi.fn().mockResolvedValue(null),
            setex: vi.fn().mockResolvedValue('OK'),
            on: vi.fn(),
        })),
    };
});

describe('CacheLayer', () => {
    let cache: CacheLayer;
    let mockRedis: any;

    beforeEach(async () => {
        // Clear all mocks
        vi.clearAllMocks();

        // Import Redis mock
        const Redis = (await import('ioredis')).default;

        // Create cache instance
        cache = new CacheLayer({
            host: 'localhost',
            port: 6379,
        });

        // Get the mock Redis instance
        mockRedis = (Redis as any).mock.results[0].value;

        // Connect to cache
        await cache.connect();
    });

    afterEach(async () => {
        await cache.disconnect();
    });

    describe('getCachedResponse', () => {
        it('should return cached response on cache hit', async () => {
            // Arrange
            const query = 'What is the capital of France?';
            const expectedResponse = 'The capital of France is Paris.';
            mockRedis.get.mockResolvedValueOnce(expectedResponse);

            // Act
            const result = await cache.getCachedResponse(query);

            // Assert
            expect(result).toBe(expectedResponse);
            expect(mockRedis.get).toHaveBeenCalledWith(expect.stringContaining('bedrock:'));
        });

        it('should return null on cache miss', async () => {
            // Arrange
            const query = 'What is the capital of Germany?';
            mockRedis.get.mockResolvedValueOnce(null);

            // Act
            const result = await cache.getCachedResponse(query);

            // Assert
            expect(result).toBeNull();
        });

        it('should use consistent hash for same query', async () => {
            // Arrange
            const query = 'What is AI?';
            mockRedis.get.mockResolvedValue('AI is artificial intelligence.');

            // Act
            await cache.getCachedResponse(query);
            await cache.getCachedResponse(query);

            // Assert
            const calls = mockRedis.get.mock.calls;
            expect(calls[0][0]).toBe(calls[1][0]); // Same key used
        });

        it('should use different hash for different queries', async () => {
            // Arrange
            const query1 = 'What is AI?';
            const query2 = 'What is ML?';
            mockRedis.get.mockResolvedValue(null);

            // Act
            await cache.getCachedResponse(query1);
            await cache.getCachedResponse(query2);

            // Assert
            const calls = mockRedis.get.mock.calls;
            expect(calls[0][0]).not.toBe(calls[1][0]); // Different keys
        });

        it('should return null on Redis error', async () => {
            // Arrange
            const query = 'What is the capital of Spain?';
            mockRedis.get.mockRejectedValueOnce(new Error('Redis connection error'));

            // Act
            const result = await cache.getCachedResponse(query);

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('setCachedResponse', () => {
        it('should cache response with correct TTL', async () => {
            // Arrange
            const query = 'What is the capital of Italy?';
            const response = 'The capital of Italy is Rome.';

            // Act
            await cache.setCachedResponse(query, response);

            // Assert
            expect(mockRedis.setex).toHaveBeenCalledWith(
                expect.stringContaining('bedrock:'),
                3600, // 1 hour TTL
                response
            );
        });

        it('should use consistent hash for same query', async () => {
            // Arrange
            const query = 'What is blockchain?';
            const response = 'Blockchain is a distributed ledger.';

            // Act
            await cache.setCachedResponse(query, response);
            await cache.setCachedResponse(query, response);

            // Assert
            const calls = mockRedis.setex.mock.calls;
            expect(calls[0][0]).toBe(calls[1][0]); // Same key used
        });

        it('should fail silently on Redis error', async () => {
            // Arrange
            const query = 'What is quantum computing?';
            const response = 'Quantum computing uses quantum mechanics.';
            mockRedis.setex.mockRejectedValueOnce(new Error('Redis write error'));

            // Act & Assert - should not throw
            await expect(cache.setCachedResponse(query, response)).resolves.toBeUndefined();
        });
    });

    describe('getCachedSearchResults', () => {
        it('should return cached search results on cache hit', async () => {
            // Arrange
            const queryEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
            const expectedResults: DocumentChunk[] = [
                {
                    chunkId: 'chunk1',
                    documentId: 'doc1',
                    documentName: 'test.pdf',
                    pageNumber: 1,
                    text: 'Sample text',
                    score: 0.95,
                    metadata: { author: 'John Doe' },
                },
            ];
            mockRedis.get.mockResolvedValueOnce(JSON.stringify(expectedResults));

            // Act
            const result = await cache.getCachedSearchResults(queryEmbedding);

            // Assert
            expect(result).toEqual(expectedResults);
            expect(mockRedis.get).toHaveBeenCalledWith(expect.stringContaining('search:'));
        });

        it('should return null on cache miss', async () => {
            // Arrange
            const queryEmbedding = [0.5, 0.6, 0.7, 0.8, 0.9];
            mockRedis.get.mockResolvedValueOnce(null);

            // Act
            const result = await cache.getCachedSearchResults(queryEmbedding);

            // Assert
            expect(result).toBeNull();
        });

        it('should use consistent hash for same embedding', async () => {
            // Arrange
            const queryEmbedding = [0.1, 0.2, 0.3];
            mockRedis.get.mockResolvedValue(null);

            // Act
            await cache.getCachedSearchResults(queryEmbedding);
            await cache.getCachedSearchResults(queryEmbedding);

            // Assert
            const calls = mockRedis.get.mock.calls;
            expect(calls[0][0]).toBe(calls[1][0]); // Same key used
        });

        it('should use different hash for different embeddings', async () => {
            // Arrange
            const embedding1 = [0.1, 0.2, 0.3];
            const embedding2 = [0.4, 0.5, 0.6];
            mockRedis.get.mockResolvedValue(null);

            // Act
            await cache.getCachedSearchResults(embedding1);
            await cache.getCachedSearchResults(embedding2);

            // Assert
            const calls = mockRedis.get.mock.calls;
            expect(calls[0][0]).not.toBe(calls[1][0]); // Different keys
        });

        it('should return null on Redis error', async () => {
            // Arrange
            const queryEmbedding = [0.1, 0.2, 0.3];
            mockRedis.get.mockRejectedValueOnce(new Error('Redis connection error'));

            // Act
            const result = await cache.getCachedSearchResults(queryEmbedding);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null on JSON parse error', async () => {
            // Arrange
            const queryEmbedding = [0.1, 0.2, 0.3];
            mockRedis.get.mockResolvedValueOnce('invalid json');

            // Act
            const result = await cache.getCachedSearchResults(queryEmbedding);

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('setCachedSearchResults', () => {
        it('should cache search results with correct TTL', async () => {
            // Arrange
            const queryEmbedding = [0.1, 0.2, 0.3];
            const results: DocumentChunk[] = [
                {
                    chunkId: 'chunk1',
                    documentId: 'doc1',
                    documentName: 'test.pdf',
                    pageNumber: 1,
                    text: 'Sample text',
                    score: 0.95,
                    metadata: {},
                },
            ];

            // Act
            await cache.setCachedSearchResults(queryEmbedding, results);

            // Assert
            expect(mockRedis.setex).toHaveBeenCalledWith(
                expect.stringContaining('search:'),
                900, // 15 minutes TTL
                JSON.stringify(results)
            );
        });

        it('should serialize complex document chunks correctly', async () => {
            // Arrange
            const queryEmbedding = [0.1, 0.2, 0.3];
            const results: DocumentChunk[] = [
                {
                    chunkId: 'chunk1',
                    documentId: 'doc1',
                    documentName: 'test.pdf',
                    pageNumber: 1,
                    text: 'Sample text with special chars: "quotes" and \'apostrophes\'',
                    score: 0.95,
                    metadata: { nested: { key: 'value' }, array: [1, 2, 3] },
                },
            ];

            // Act
            await cache.setCachedSearchResults(queryEmbedding, results);

            // Assert
            const serialized = mockRedis.setex.mock.calls[0][2];
            expect(JSON.parse(serialized)).toEqual(results);
        });

        it('should fail silently on Redis error', async () => {
            // Arrange
            const queryEmbedding = [0.1, 0.2, 0.3];
            const results: DocumentChunk[] = [];
            mockRedis.setex.mockRejectedValueOnce(new Error('Redis write error'));

            // Act & Assert - should not throw
            await expect(cache.setCachedSearchResults(queryEmbedding, results)).resolves.toBeUndefined();
        });
    });

    describe('TTL behavior', () => {
        it('should set 1 hour TTL for Bedrock responses', async () => {
            // Arrange
            const query = 'Test query';
            const response = 'Test response';

            // Act
            await cache.setCachedResponse(query, response);

            // Assert
            const ttl = mockRedis.setex.mock.calls[0][1];
            expect(ttl).toBe(3600); // 1 hour in seconds
        });

        it('should set 15 minute TTL for search results', async () => {
            // Arrange
            const queryEmbedding = [0.1, 0.2, 0.3];
            const results: DocumentChunk[] = [];

            // Act
            await cache.setCachedSearchResults(queryEmbedding, results);

            // Assert
            const ttl = mockRedis.setex.mock.calls[0][1];
            expect(ttl).toBe(900); // 15 minutes in seconds
        });
    });

    describe('error handling', () => {
        it('should handle connection failure gracefully', async () => {
            // Arrange
            const Redis = (await import('ioredis')).default;
            const failingRedis = {
                connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
                quit: vi.fn().mockResolvedValue(undefined),
                get: vi.fn(),
                setex: vi.fn(),
                on: vi.fn(),
            };
            (Redis as any).mockImplementationOnce(() => failingRedis);

            const failingCache = new CacheLayer({
                host: 'invalid-host',
                port: 6379,
            });

            // Act
            await failingCache.connect();

            // Assert
            expect(failingCache.isAvailable()).toBe(false);
        });

        it('should return null for getCachedResponse when connection failed', async () => {
            // Arrange
            const Redis = (await import('ioredis')).default;
            const failingRedis = {
                connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
                quit: vi.fn().mockResolvedValue(undefined),
                get: vi.fn(),
                setex: vi.fn(),
                on: vi.fn(),
            };
            (Redis as any).mockImplementationOnce(() => failingRedis);

            const failingCache = new CacheLayer({
                host: 'invalid-host',
                port: 6379,
            });
            await failingCache.connect();

            // Act
            const result = await failingCache.getCachedResponse('test query');

            // Assert
            expect(result).toBeNull();
            expect(failingRedis.get).not.toHaveBeenCalled();
        });

        it('should not throw for setCachedResponse when connection failed', async () => {
            // Arrange
            const Redis = (await import('ioredis')).default;
            const failingRedis = {
                connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
                quit: vi.fn().mockResolvedValue(undefined),
                get: vi.fn(),
                setex: vi.fn(),
                on: vi.fn(),
            };
            (Redis as any).mockImplementationOnce(() => failingRedis);

            const failingCache = new CacheLayer({
                host: 'invalid-host',
                port: 6379,
            });
            await failingCache.connect();

            // Act & Assert
            await expect(failingCache.setCachedResponse('test', 'response')).resolves.toBeUndefined();
            expect(failingRedis.setex).not.toHaveBeenCalled();
        });

        it('should handle disconnect errors gracefully', async () => {
            // Arrange
            mockRedis.quit.mockRejectedValueOnce(new Error('Disconnect failed'));

            // Act & Assert - should not throw
            await expect(cache.disconnect()).resolves.toBeUndefined();
        });
    });

    describe('isAvailable', () => {
        it('should return true when cache is available', () => {
            // Act
            const available = cache.isAvailable();

            // Assert
            expect(available).toBe(true);
        });

        it('should return false when connection failed', async () => {
            // Arrange
            const Redis = (await import('ioredis')).default;
            const failingRedis = {
                connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
                quit: vi.fn().mockResolvedValue(undefined),
                get: vi.fn(),
                setex: vi.fn(),
                on: vi.fn(),
            };
            (Redis as any).mockImplementationOnce(() => failingRedis);

            const failingCache = new CacheLayer({
                host: 'invalid-host',
                port: 6379,
            });
            await failingCache.connect();

            // Act
            const available = failingCache.isAvailable();

            // Assert
            expect(available).toBe(false);
        });
    });
});
