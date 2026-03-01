import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import * as AWS from 'aws-sdk';

/**
 * OpenSearch index configuration for document embeddings with k-NN search
 * 
 * This configuration creates an index optimized for:
 * - 1024-dimension vectors (matching Titan Embeddings V2 output)
 * - Cosine similarity metric for semantic search
 * - HNSW algorithm for approximate nearest neighbor search
 * - Near-real-time search with 5s refresh interval
 */

const INDEX_NAME = 'documents';

interface IndexMapping {
    mappings: {
        properties: {
            chunkId: { type: string };
            documentId: { type: string };
            documentName: { type: string };
            pageNumber: { type: string };
            chunkIndex: { type: string };
            text: { type: string };
            embedding: {
                type: string;
                dimension: number;
                method: {
                    name: string;
                    space_type: string;
                    engine: string;
                    parameters: {
                        ef_construction: number;
                        m: number;
                    };
                };
            };
            uploadedAt: { type: string };
            uploadedBy: { type: string };
        };
    };
    settings: {
        index: {
            knn: boolean;
            'knn.algo_param.ef_search': number;
            refresh_interval: string;
            number_of_shards: number;
            number_of_replicas: number;
        };
    };
}

/**
 * Creates the index mapping configuration with k-NN settings
 */
function getIndexConfiguration(): IndexMapping {
    return {
        mappings: {
            properties: {
                chunkId: { type: 'keyword' },
                documentId: { type: 'keyword' },
                documentName: { type: 'text' },
                pageNumber: { type: 'integer' },
                chunkIndex: { type: 'integer' },
                text: { type: 'text' },
                embedding: {
                    type: 'knn_vector',
                    dimension: 1024,
                    method: {
                        name: 'hnsw',
                        space_type: 'cosinesimil',
                        engine: 'lucene',
                        parameters: {
                            ef_construction: 512,
                            m: 16
                        }
                    }
                },
                uploadedAt: { type: 'date' },
                uploadedBy: { type: 'keyword' }
            }
        },
        settings: {
            index: {
                knn: true,
                'knn.algo_param.ef_search': 512,
                refresh_interval: '5s',
                number_of_shards: 3,
                number_of_replicas: 1
            }
        }
    };
}

/**
 * Creates an OpenSearch client with AWS Sigv4 authentication
 */
function createOpenSearchClient(endpoint: string): Client {
    const region = process.env.AWS_REGION || 'us-east-1';

    return new Client({
        ...AwsSigv4Signer({
            region,
            service: 'es',
            getCredentials: () => {
                const credentials = new AWS.EnvironmentCredentials('AWS');
                return Promise.resolve(credentials);
            }
        }),
        node: `https://${endpoint}`
    });
}

/**
 * Deletes the OpenSearch index if it exists
 * 
 * @param endpoint - OpenSearch domain endpoint
 * @returns Success status and message
 */
export async function deleteIndex(endpoint: string): Promise<{ success: boolean; message: string }> {
    const client = createOpenSearchClient(endpoint);

    try {
        // Check if index exists
        const indexExists = await client.indices.exists({ index: INDEX_NAME });

        if (!indexExists.body) {
            return {
                success: true,
                message: `Index '${INDEX_NAME}' does not exist, nothing to delete`
            };
        }

        // Delete the index
        await client.indices.delete({ index: INDEX_NAME });

        console.log(`Successfully deleted index '${INDEX_NAME}'`);

        return {
            success: true,
            message: `Index '${INDEX_NAME}' deleted successfully`
        };
    } catch (error) {
        console.error('Error deleting OpenSearch index:', error);
        throw error;
    }
}

/**
 * Initializes the OpenSearch index with k-NN configuration
 * 
 * @param endpoint - OpenSearch domain endpoint
 * @returns Success status and message
 */
export async function initializeIndex(endpoint: string): Promise<{ success: boolean; message: string }> {
    const client = createOpenSearchClient(endpoint);

    try {
        // Check if index already exists
        const indexExists = await client.indices.exists({ index: INDEX_NAME });

        if (indexExists.body) {
            return {
                success: true,
                message: `Index '${INDEX_NAME}' already exists`
            };
        }

        // Create index with k-NN configuration
        const indexConfig = getIndexConfiguration();
        await client.indices.create({
            index: INDEX_NAME,
            body: indexConfig
        });

        console.log(`Successfully created index '${INDEX_NAME}' with k-NN configuration`);

        return {
            success: true,
            message: `Index '${INDEX_NAME}' created successfully with k-NN configuration`
        };
    } catch (error) {
        console.error('Error initializing OpenSearch index:', error);
        throw error;
    }
}

/**
 * Lambda handler for index operations
 * 
 * Supports two operations via the 'action' field in the event:
 * - 'create' or undefined: Creates the index (default)
 * - 'delete': Deletes the index
 * - 'recreate': Deletes and recreates the index
 * 
 * @example
 * // Create index
 * { "action": "create" }
 * 
 * // Delete index
 * { "action": "delete" }
 * 
 * // Recreate index (delete + create)
 * { "action": "recreate" }
 */
export async function handler(event: any): Promise<any> {
    const endpoint = process.env.OPENSEARCH_ENDPOINT;

    if (!endpoint) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'OPENSEARCH_ENDPOINT environment variable not set'
            })
        };
    }

    const action = event.action || 'create';

    try {
        let result;

        switch (action) {
            case 'delete':
                result = await deleteIndex(endpoint);
                break;

            case 'recreate':
                // Delete first
                const deleteResult = await deleteIndex(endpoint);
                console.log('Delete result:', deleteResult.message);

                // Then create
                result = await initializeIndex(endpoint);
                result.message = `Index recreated: ${deleteResult.message}; ${result.message}`;
                break;

            case 'create':
            default:
                result = await initializeIndex(endpoint);
                break;
        }

        return {
            statusCode: 200,
            body: JSON.stringify(result)
        };
    } catch (error: any) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: `Failed to ${action} index`,
                message: error.message
            })
        };
    }
}
