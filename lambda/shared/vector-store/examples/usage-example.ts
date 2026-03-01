/**
 * Example usage of OpenSearch Vector Store client
 * 
 * This example demonstrates:
 * - Initializing the client
 * - Indexing embeddings
 * - Searching for similar vectors
 * - Using filters
 * - Deleting documents
 */

import { OpenSearchVectorStore, Embedding, SearchFilters } from '../src';

async function main() {
    // Initialize the client
    const vectorStore = new OpenSearchVectorStore(
        process.env.OPENSEARCH_ENDPOINT || 'your-endpoint.us-east-1.es.amazonaws.com'
    );

    console.log('OpenSearch Vector Store initialized');

    // Example 1: Index a single embedding
    console.log('\n--- Example 1: Index Single Embedding ---');
    const singleEmbedding: Embedding = {
        chunkId: 'chunk-001',
        vector: generateRandomVector(1536),
        text: 'This is the first document chunk about machine learning.',
        metadata: {
            documentId: 'doc-001',
            documentName: 'ml-guide.pdf',
            pageNumber: 1,
            chunkIndex: 0,
            uploadedAt: Date.now(),
            uploadedBy: 'user-123'
        }
    };

    await vectorStore.indexEmbedding(singleEmbedding);
    console.log('✓ Single embedding indexed successfully');

    // Example 2: Batch index multiple embeddings
    console.log('\n--- Example 2: Batch Index Embeddings ---');
    const batchEmbeddings: Embedding[] = [
        {
            chunkId: 'chunk-002',
            vector: generateRandomVector(1536),
            text: 'Deep learning is a subset of machine learning.',
            metadata: {
                documentId: 'doc-001',
                documentName: 'ml-guide.pdf',
                pageNumber: 1,
                chunkIndex: 1,
                uploadedAt: Date.now(),
                uploadedBy: 'user-123'
            }
        },
        {
            chunkId: 'chunk-003',
            vector: generateRandomVector(1536),
            text: 'Neural networks are the foundation of deep learning.',
            metadata: {
                documentId: 'doc-001',
                documentName: 'ml-guide.pdf',
                pageNumber: 2,
                chunkIndex: 2,
                uploadedAt: Date.now(),
                uploadedBy: 'user-123'
            }
        },
        {
            chunkId: 'chunk-004',
            vector: generateRandomVector(1536),
            text: 'Cloud computing enables scalable AI applications.',
            metadata: {
                documentId: 'doc-002',
                documentName: 'cloud-guide.pdf',
                pageNumber: 1,
                chunkIndex: 0,
                uploadedAt: Date.now(),
                uploadedBy: 'user-456'
            }
        }
    ];

    await vectorStore.batchIndexEmbeddings(batchEmbeddings);
    console.log(`✓ Batch indexed ${batchEmbeddings.length} embeddings successfully`);

    // Wait a moment for indexing to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Example 3: Basic vector search
    console.log('\n--- Example 3: Basic Vector Search ---');
    const queryVector = generateRandomVector(1536);
    const basicResults = await vectorStore.searchSimilar(queryVector, 3);

    console.log(`Found ${basicResults.length} results:`);
    basicResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.chunk.documentName} (page ${result.chunk.pageNumber})`);
        console.log(`     Score: ${result.score.toFixed(4)}`);
        console.log(`     Text: ${result.chunk.text.substring(0, 60)}...`);
    });

    // Example 4: Search with document ID filter
    console.log('\n--- Example 4: Search with Document Filter ---');
    const docFilter: SearchFilters = {
        documentIds: ['doc-001']
    };

    const filteredResults = await vectorStore.searchSimilar(queryVector, 5, docFilter);
    console.log(`Found ${filteredResults.length} results in doc-001:`);
    filteredResults.forEach((result, index) => {
        console.log(`  ${index + 1}. Page ${result.chunk.pageNumber}, Chunk ${result.chunk.metadata.chunkIndex}`);
    });

    // Example 5: Search with date range filter
    console.log('\n--- Example 5: Search with Date Range Filter ---');
    const dateFilter: SearchFilters = {
        dateRange: {
            start: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
            end: Date.now()
        }
    };

    const recentResults = await vectorStore.searchSimilar(queryVector, 5, dateFilter);
    console.log(`Found ${recentResults.length} recent results`);

    // Example 6: Search with combined filters
    console.log('\n--- Example 6: Search with Combined Filters ---');
    const combinedFilters: SearchFilters = {
        documentIds: ['doc-001', 'doc-002'],
        dateRange: {
            start: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
            end: Date.now()
        }
    };

    const combinedResults = await vectorStore.searchSimilar(queryVector, 5, combinedFilters);
    console.log(`Found ${combinedResults.length} results with combined filters`);

    // Example 7: Delete document
    console.log('\n--- Example 7: Delete Document ---');
    await vectorStore.deleteDocument('doc-002');
    console.log('✓ Deleted all chunks for doc-002');

    // Verify deletion
    const afterDeleteResults = await vectorStore.searchSimilar(queryVector, 10);
    const doc002Count = afterDeleteResults.filter(r => r.chunk.documentId === 'doc-002').length;
    console.log(`Chunks from doc-002 remaining: ${doc002Count}`);

    console.log('\n✓ All examples completed successfully!');
}

/**
 * Generate a random vector for demonstration purposes
 * In production, use actual embeddings from Bedrock Titan
 */
function generateRandomVector(dimensions: number): number[] {
    return Array.from({ length: dimensions }, () => Math.random());
}

/**
 * Error handling example
 */
async function errorHandlingExample() {
    const vectorStore = new OpenSearchVectorStore(
        process.env.OPENSEARCH_ENDPOINT || 'your-endpoint.us-east-1.es.amazonaws.com'
    );

    try {
        // Try to search with invalid vector dimensions
        const invalidVector = new Array(512).fill(0.5); // Wrong dimension
        await vectorStore.searchSimilar(invalidVector, 5);
    } catch (error) {
        console.error('Expected error caught:', error);
    }

    try {
        // Try to index with missing required fields
        const invalidEmbedding = {
            chunkId: 'test',
            vector: generateRandomVector(1536),
            text: 'Test'
            // Missing metadata
        } as any;

        await vectorStore.indexEmbedding(invalidEmbedding);
    } catch (error) {
        console.error('Expected error caught:', error);
    }
}

// Run the examples
if (require.main === module) {
    main()
        .then(() => {
            console.log('\nExamples completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('Error running examples:', error);
            process.exit(1);
        });
}

export { main, errorHandlingExample };
