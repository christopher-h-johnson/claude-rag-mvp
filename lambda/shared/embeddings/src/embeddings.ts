/**
 * Embedding Generator using Amazon Bedrock Titan Embeddings
 * 
 * This module provides functions to generate vector embeddings from text
 * using the amazon.titan-embed-text-v1 model via Amazon Bedrock.
 */

import {
    BedrockRuntimeClient,
    InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { EmbeddingConfig, EmbeddingResult, BatchEmbeddingResult, ProgressCallback } from './types.js';

/**
 * Check if an error is retryable (throttling or transient errors)
 */
function isRetryableError(error: any): boolean {
    if (!error) return false;

    const throttlingErrors = [
        'ThrottlingException',
        'TooManyRequestsException',
        'ProvisionedThroughputExceededException',
        'RequestLimitExceeded',
    ];

    if (throttlingErrors.includes(error.name)) {
        return true;
    }

    const statusCode = error.$metadata?.httpStatusCode;
    if (statusCode === 429 || statusCode === 503) {
        return true;
    }

    return false;
}

/**
 * Retry wrapper with exponential backoff
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelayMs: number = 1000
): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            if (!isRetryableError(error) || attempt === maxAttempts) {
                throw error;
            }

            const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
            console.warn(`[Retry] Attempt ${attempt} failed, retrying in ${delayMs}ms:`, {
                errorName: error.name,
                errorMessage: error.message,
            });

            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    throw lastError || new Error('Retry failed with unknown error');
}

export class EmbeddingGenerator {
    private client: BedrockRuntimeClient;
    private modelId: string;

    constructor(config: EmbeddingConfig = {}) {
        const region = config.region || process.env.AWS_REGION || 'us-east-1';
        this.modelId = config.modelId || 'amazon.titan-embed-text-v1';

        this.client = new BedrockRuntimeClient({ region });
    }

    /**
     * Generate embedding for a single text input
     * 
     * @param text - The text to generate an embedding for
     * @returns EmbeddingResult containing the 1536-dimension vector
     */
    async generateEmbedding(text: string): Promise<EmbeddingResult> {
        if (!text || text.trim().length === 0) {
            throw new Error('Input text cannot be empty');
        }

        return withRetry(async () => {
            const requestBody = {
                inputText: text,
            };

            const command = new InvokeModelCommand({
                modelId: this.modelId,
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify(requestBody),
            });

            const response = await this.client.send(command);

            if (!response.body) {
                throw new Error('Empty response from Bedrock');
            }

            const responseBody = JSON.parse(new TextDecoder().decode(response.body));

            // Validate embedding dimensions
            if (!responseBody.embedding || !Array.isArray(responseBody.embedding)) {
                throw new Error('Invalid response format: missing embedding array');
            }

            if (responseBody.embedding.length !== 1536) {
                throw new Error(`Invalid embedding dimensions: expected 1536, got ${responseBody.embedding.length}`);
            }

            return {
                embedding: responseBody.embedding,
                inputTextTokenCount: responseBody.inputTextTokenCount,
            };
        });
    }

    /**
     * Generate embeddings for multiple text inputs in batches
     * 
     * @param texts - Array of texts to generate embeddings for
     * @param batchSize - Number of texts to process in parallel (default: 25)
     * @param onProgress - Optional callback for progress tracking
     * @returns BatchEmbeddingResult containing all embeddings
     */
    async batchGenerateEmbeddings(
        texts: string[],
        batchSize: number = 25,
        onProgress?: ProgressCallback
    ): Promise<BatchEmbeddingResult> {
        if (!texts || texts.length === 0) {
            throw new Error('Input texts array cannot be empty');
        }

        if (batchSize < 1) {
            throw new Error('Batch size must be at least 1');
        }

        const embeddings: number[][] = [];
        let totalTokenCount = 0;
        let processedCount = 0;

        // Process texts in batches
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);

            // Process batch in parallel with retry logic
            const batchPromises = batch.map(text => this.generateEmbedding(text));
            const batchResults = await Promise.all(batchPromises);

            // Collect results
            for (const result of batchResults) {
                embeddings.push(result.embedding);
                if (result.inputTextTokenCount) {
                    totalTokenCount += result.inputTextTokenCount;
                }
                processedCount++;

                // Report progress if callback provided
                if (onProgress) {
                    onProgress({
                        processed: processedCount,
                        total: texts.length,
                        percentage: Math.round((processedCount / texts.length) * 100),
                    });
                }
            }
        }

        return {
            embeddings,
            totalTokenCount: totalTokenCount > 0 ? totalTokenCount : undefined,
        };
    }

    /**
     * Generate embeddings with parallel batch processing
     * Processes multiple batches concurrently for improved throughput
     * 
     * @param texts - Array of texts to generate embeddings for
     * @param batchSize - Number of texts per batch (default: 25)
     * @param concurrentBatches - Number of batches to process concurrently (default: 3)
     * @param onProgress - Optional callback for progress tracking
     * @returns BatchEmbeddingResult containing all embeddings
     */
    async parallelBatchGenerateEmbeddings(
        texts: string[],
        batchSize: number = 25,
        concurrentBatches: number = 3,
        onProgress?: ProgressCallback
    ): Promise<BatchEmbeddingResult> {
        if (!texts || texts.length === 0) {
            throw new Error('Input texts array cannot be empty');
        }

        if (batchSize < 1) {
            throw new Error('Batch size must be at least 1');
        }

        if (concurrentBatches < 1) {
            throw new Error('Concurrent batches must be at least 1');
        }

        const embeddings: number[][] = new Array(texts.length);
        let totalTokenCount = 0;
        let processedCount = 0;

        // Split texts into batches
        const batches: Array<{ texts: string[]; startIndex: number }> = [];
        for (let i = 0; i < texts.length; i += batchSize) {
            batches.push({
                texts: texts.slice(i, i + batchSize),
                startIndex: i,
            });
        }

        // Process batches in parallel groups
        for (let i = 0; i < batches.length; i += concurrentBatches) {
            const batchGroup = batches.slice(i, i + concurrentBatches);

            // Process each batch in the group concurrently
            const batchPromises = batchGroup.map(async ({ texts: batchTexts, startIndex }) => {
                // Process all texts in this batch in parallel
                const textPromises = batchTexts.map(text => this.generateEmbedding(text));
                const results = await Promise.all(textPromises);

                // Store results at correct indices
                results.forEach((result, idx) => {
                    embeddings[startIndex + idx] = result.embedding;
                    if (result.inputTextTokenCount) {
                        totalTokenCount += result.inputTextTokenCount;
                    }
                });

                return results.length;
            });

            // Wait for all batches in this group to complete
            const batchCounts = await Promise.all(batchPromises);

            // Update progress
            processedCount += batchCounts.reduce((sum, count) => sum + count, 0);
            if (onProgress) {
                onProgress({
                    processed: processedCount,
                    total: texts.length,
                    percentage: Math.round((processedCount / texts.length) * 100),
                });
            }
        }

        return {
            embeddings,
            totalTokenCount: totalTokenCount > 0 ? totalTokenCount : undefined,
        };
    }
}
