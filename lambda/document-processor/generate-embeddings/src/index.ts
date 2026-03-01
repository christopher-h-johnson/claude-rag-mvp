/**
 * Generate Embeddings Lambda Function
 * 
 * This Lambda function generates vector embeddings for document chunks using
 * Amazon Bedrock Titan Embeddings model. It's invoked by the Document Processor
 * after text extraction and chunking.
 * 
 * Validates Requirements: 5.5, 6.1
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Handler } from 'aws-lambda';
import { EmbeddingGenerator } from '../../../shared/embeddings/dist/index.js';

const s3Client = new S3Client({});
const embeddingGenerator = new EmbeddingGenerator();

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
 */
export const handler: Handler<GenerateEmbeddingsEvent, GenerateEmbeddingsResponse> = async (event, context) => {
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
        const embeddings = await generateEmbeddingsForChunks(chunks);
        console.log(`Generated ${embeddings.length} embeddings`);

        // 3. Return embeddings (will be handled by orchestration in task 11.2)
        return {
            statusCode: 200,
            body: JSON.stringify({
                documentId,
                embeddingsCount: embeddings.length,
                embeddings,
            }),
        };
    } catch (error) {
        console.error('Error generating embeddings:', error);
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
