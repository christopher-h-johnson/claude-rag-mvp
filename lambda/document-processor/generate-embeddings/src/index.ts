/**
 * Generate Embeddings Lambda Function
 * 
 * This Lambda function generates vector embeddings for document chunks using
 * Amazon Bedrock Titan Embeddings model. It's invoked by the Document Processor
 * after text extraction and chunking.
 * 
 * After generating embeddings, it stores them in OpenSearch and updates the
 * DocumentMetadata table with completion status.
 * 
 * Validates Requirements: 5.5, 6.1, 6.3, 6.4
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { Handler, Context } from 'aws-lambda';
import { EmbeddingGenerator } from '../../../shared/embeddings/dist/index.js';
import { OpenSearchVectorStore } from '../../../shared/vector-store/dist/index.js';
import { Embedding } from '../../../shared/vector-store/dist/types.js';
import { emitExecutionDuration, emitEmbeddingGenerationTime, flushMetrics } from '../../../shared/metrics/dist/index.mjs';

const s3Client = new S3Client({});
const dynamoDBClient = new DynamoDBClient({});
const embeddingGenerator = new EmbeddingGenerator();

// Initialize OpenSearch client from environment variables
const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT;
const OPENSEARCH_INDEX = process.env.OPENSEARCH_INDEX || 'documents';
const DOCUMENT_METADATA_TABLE = process.env.DOCUMENT_METADATA_TABLE;

if (!OPENSEARCH_ENDPOINT) {
    throw new Error('OPENSEARCH_ENDPOINT environment variable is required');
}

if (!DOCUMENT_METADATA_TABLE) {
    throw new Error('DOCUMENT_METADATA_TABLE environment variable is required');
}

const vectorStore = new OpenSearchVectorStore(
    OPENSEARCH_ENDPOINT,
    OPENSEARCH_INDEX,
    undefined, // region - use default
    async (latency, resultCount, scores) => {
        // Metrics callback for OpenSearch operations
        try {
            await emitExecutionDuration({
                functionName: 'opensearch-query',
                duration: latency,
            });
        } catch (error) {
            console.error('Failed to emit OpenSearch metrics:', error);
        }
    }
);

interface TextChunk {
    chunkId: string;
    documentId: string;
    text: string;
    chunkIndex: number;
    pageNumber: number;
    tokenCount: number;
    metadata: {
        filename: string;
        uploadedBy: string;
        uploadedAt: number;
        pageCount: number;
    };
}

interface GenerateEmbeddingsEvent {
    bucket: string;
    documentId: string;
    chunksKey: string;
}

interface EmbeddingWithMetadata {
    chunkId: string;
    documentId: string;
    embedding: number[];
    text: string;
    chunkIndex: number;
    pageNumber: number;
    metadata: {
        filename: string;
        uploadedBy: string;
        uploadedAt: number;
        pageCount: number;
    };
}

interface GenerateEmbeddingsResponse {
    statusCode: number;
    body: string;
}

/**
 * Lambda handler for generating embeddings
 * 
 * Validates Requirements: 5.5, 6.1, 6.3, 6.4, 15.1
 */
export const handler: Handler<GenerateEmbeddingsEvent, GenerateEmbeddingsResponse> = async (event, context: Context) => {
    const startTime = Date.now();
    console.log('Generate Embeddings Lambda triggered', {
        requestId: context.awsRequestId,
        documentId: event.documentId,
    });

    try {
        const { bucket, documentId, chunksKey } = event;

        // 1. Download chunks from S3
        console.log(`Downloading chunks from s3://${bucket}/${chunksKey}`);
        const chunks = await downloadChunks(bucket, chunksKey);
        console.log(`Downloaded ${chunks.length} chunks`);

        // 2. Generate embeddings for all chunks
        console.log('Generating embeddings...');
        const embeddingStartTime = Date.now();
        const embeddingsWithMetadata = await generateEmbeddingsForChunks(chunks);
        const embeddingDuration = Date.now() - embeddingStartTime;
        console.log(`Generated ${embeddingsWithMetadata.length} embeddings in ${embeddingDuration}ms`);

        // Emit embedding generation time metric (Requirement 15.1)
        try {
            await emitEmbeddingGenerationTime({
                generationTime: embeddingDuration,
                chunkCount: chunks.length,
                documentId,
            });
        } catch (error) {
            console.error('Error emitting embedding generation time metric:', error);
            // Non-critical, continue
        }

        // 3. Transform to OpenSearch Embedding format
        const embeddings: Embedding[] = embeddingsWithMetadata.map(e => ({
            chunkId: e.chunkId,
            vector: e.embedding,
            text: e.text,
            metadata: {
                documentId: e.documentId,
                documentName: e.metadata.filename,
                pageNumber: e.pageNumber,
                chunkIndex: e.chunkIndex,
                uploadedAt: e.metadata.uploadedAt,
                uploadedBy: e.metadata.uploadedBy,
            }
        }));

        // 4. Store embeddings in OpenSearch
        console.log(`Indexing ${embeddings.length} embeddings in OpenSearch...`);
        await vectorStore.batchIndexEmbeddings(embeddings);
        console.log('Successfully indexed embeddings in OpenSearch');

        // 5. Update DocumentMetadata table with completion status
        console.log(`Updating DocumentMetadata table for document ${documentId}...`);
        await updateDocumentMetadata(documentId, chunks.length);
        console.log('Successfully updated DocumentMetadata table');

        // Emit execution duration metric (Requirement 15.1)
        try {
            await emitExecutionDuration({
                functionName: 'generate-embeddings',
                duration: Date.now() - startTime,
            });
        } catch (error) {
            console.error('Error emitting execution duration metric:', error);
            // Non-critical, continue
        }

        // Flush metrics before returning
        await flushMetrics();

        // 6. Return success response
        return {
            statusCode: 200,
            body: JSON.stringify({
                documentId,
                embeddingsCount: embeddings.length,
                status: 'completed',
                message: 'Embeddings generated and indexed successfully'
            }),
        };
    } catch (error) {
        console.error('Error generating embeddings:', error);

        // Update DocumentMetadata table with failed status
        try {
            await updateDocumentMetadata(event.documentId, 0, 'failed', String(error));
        } catch (updateError) {
            console.error('Error updating DocumentMetadata with failure:', updateError);
        }

        // Emit execution duration metric even on error
        try {
            await emitExecutionDuration({
                functionName: 'generate-embeddings',
                duration: Date.now() - startTime,
            });
            await flushMetrics();
        } catch (metricsError) {
            console.error('Error emitting metrics on error:', metricsError);
        }

        throw error;
    }
};

/**
 * Download chunks from S3
 */
async function downloadChunks(bucket: string, key: string): Promise<TextChunk[]> {
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
        throw new Error('Empty response from S3');
    }

    const bodyString = await response.Body.transformToString();
    const chunksData = JSON.parse(bodyString);

    return chunksData.chunks as TextChunk[];
}

/**
 * Generate embeddings for all chunks with progress tracking
 */
async function generateEmbeddingsForChunks(chunks: TextChunk[]): Promise<EmbeddingWithMetadata[]> {
    // Extract text from chunks
    const texts = chunks.map(chunk => chunk.text);

    // Generate embeddings in batches with progress tracking
    const batchResult = await embeddingGenerator.batchGenerateEmbeddings(
        texts,
        25, // batch size
        (progress) => {
            console.log(`Embedding progress: ${progress.processed}/${progress.total} (${progress.percentage}%)`);
        }
    );

    // Combine embeddings with chunk metadata
    const embeddingsWithMetadata: EmbeddingWithMetadata[] = chunks.map((chunk, index) => ({
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        embedding: batchResult.embeddings[index],
        text: chunk.text,
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        metadata: chunk.metadata,
    }));

    return embeddingsWithMetadata;
}

/**
 * Update DocumentMetadata table with processing completion status
 * 
 * @param documentId - Document ID
 * @param chunkCount - Number of chunks processed
 * @param status - Processing status (default: 'completed')
 * @param errorMessage - Error message if status is 'failed'
 * 
 * Requirements: 6.4
 */
async function updateDocumentMetadata(
    documentId: string,
    chunkCount: number,
    status: 'completed' | 'failed' = 'completed',
    errorMessage?: string
): Promise<void> {
    const updateExpression = errorMessage
        ? 'SET processingStatus = :status, chunkCount = :chunkCount, errorMessage = :errorMessage'
        : 'SET processingStatus = :status, chunkCount = :chunkCount';

    const expressionAttributeValues: any = {
        ':status': { S: status },
        ':chunkCount': { N: String(chunkCount) }
    };

    if (errorMessage) {
        expressionAttributeValues[':errorMessage'] = { S: errorMessage };
    }

    const command = new UpdateItemCommand({
        TableName: DOCUMENT_METADATA_TABLE,
        Key: {
            PK: { S: `DOC#${documentId}` },
            SK: { S: 'METADATA' }
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues
    });

    await dynamoDBClient.send(command);
    console.log(`Updated DocumentMetadata: ${documentId} -> ${status} (${chunkCount} chunks)`);
}

