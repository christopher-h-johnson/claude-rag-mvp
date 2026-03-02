/**
 * Embedding Generator using Amazon Bedrock Titan Embeddings
 *
 * This module provides functions to generate vector embeddings from text
 * using the amazon.titan-embed-text-v1 model via Amazon Bedrock.
 */
import type { EmbeddingConfig, EmbeddingResult, BatchEmbeddingResult, ProgressCallback } from './types.js';
export declare class EmbeddingGenerator {
    private client;
    private modelId;
    constructor(config?: EmbeddingConfig);
    /**
     * Generate embedding for a single text input
     *
     * @param text - The text to generate an embedding for
     * @returns EmbeddingResult containing the 1024-dimension vector (Titan V2)
     */
    generateEmbedding(text: string): Promise<EmbeddingResult>;
    /**
     * Generate embeddings for multiple text inputs in batches
     *
     * @param texts - Array of texts to generate embeddings for
     * @param batchSize - Number of texts to process in parallel (default: 25)
     * @param onProgress - Optional callback for progress tracking
     * @returns BatchEmbeddingResult containing all embeddings
     */
    batchGenerateEmbeddings(texts: string[], batchSize?: number, onProgress?: ProgressCallback): Promise<BatchEmbeddingResult>;
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
    parallelBatchGenerateEmbeddings(texts: string[], batchSize?: number, concurrentBatches?: number, onProgress?: ProgressCallback): Promise<BatchEmbeddingResult>;
}
//# sourceMappingURL=embeddings.d.ts.map