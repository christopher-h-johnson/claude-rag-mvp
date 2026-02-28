/**
 * Types for Embedding Generator
 */

export interface EmbeddingConfig {
    region?: string;
    modelId?: string;
}

export interface EmbeddingResult {
    embedding: number[];
    inputTextTokenCount?: number;
}

export interface BatchEmbeddingResult {
    embeddings: number[][];
    totalTokenCount?: number;
}

export interface ProgressInfo {
    processed: number;
    total: number;
    percentage: number;
}

export type ProgressCallback = (progress: ProgressInfo) => void;
