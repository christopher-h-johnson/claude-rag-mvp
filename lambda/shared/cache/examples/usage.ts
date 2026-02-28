import { CacheLayer } from '../src/index.js';

/**
 * Example: Using cache with Bedrock responses
 */
async function exampleBedrockCache() {
    const cache = new CacheLayer({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_TLS === 'true',
    });

    await cache.connect();

    const query = "What is the capital of France?";

    // Try to get from cache
    let response = await cache.getCachedResponse(query);

    if (response) {
        console.log('✓ Cache hit! Response:', response);
    } else {
        console.log('✗ Cache miss. Calling Bedrock API...');

        // Simulate Bedrock API call
        response = "The capital of France is Paris.";

        // Store in cache
        await cache.setCachedResponse(query, response);
        console.log('✓ Response cached for 1 hour');
    }

    await cache.disconnect();
}

/**
 * Example: Using cache with search results
 */
async function exampleSearchCache() {
    const cache = new CacheLayer({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
    });

    await cache.connect();

    // Simulate query embedding (1536 dimensions)
    const queryEmbedding = Array(1536).fill(0).map(() => Math.random());

    // Try to get from cache
    let results = await cache.getCachedSearchResults(queryEmbedding);

    if (results) {
        console.log('✓ Cache hit! Found', results.length, 'chunks');
    } else {
        console.log('✗ Cache miss. Searching OpenSearch...');

        // Simulate OpenSearch results
        results = [
            {
                chunkId: 'chunk-1',
                documentId: 'doc-1',
                documentName: 'example.pdf',
                pageNumber: 1,
                text: 'This is example text from the document.',
                score: 0.95,
                metadata: { uploadedAt: Date.now() },
            },
        ];

        // Store in cache
        await cache.setCachedSearchResults(queryEmbedding, results);
        console.log('✓ Results cached for 15 minutes');
    }

    await cache.disconnect();
}

/**
 * Example: Graceful error handling
 */
async function exampleErrorHandling() {
    // Connect to non-existent Redis instance
    const cache = new CacheLayer({
        host: 'invalid-host',
        port: 6379,
        connectTimeout: 1000,
    });

    await cache.connect();

    // Cache operations will fail gracefully
    const response = await cache.getCachedResponse('test query');
    console.log('Response (should be null):', response);

    // Application continues without caching
    console.log('✓ Application continues despite Redis error');

    await cache.disconnect();
}

// Run examples
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('=== Bedrock Cache Example ===');
    await exampleBedrockCache();

    console.log('\n=== Search Cache Example ===');
    await exampleSearchCache();

    console.log('\n=== Error Handling Example ===');
    await exampleErrorHandling();
}
