/**
 * Types for RAG orchestration module
 */

/**
 * Document chunk returned from vector search
 */
export interface DocumentChunk {
    chunkId: string;
    documentId: string;
    documentName: string;
    pageNumber: number;
    text: string;
    score: number;
    metadata: Record<string, any>;
}

/**
 * Configuration for RAG system
 */
export interface RAGConfig {
    region?: string;
    opensearchEndpoint: string;
    cacheHost?: string;
    cachePort?: number;
    cachePassword?: string;
    cacheTls?: boolean;
}

/**
 * Result from context retrieval
 */
export interface RetrievalResult {
    chunks: DocumentChunk[];
    fromCache: boolean;
    queryEmbedding: number[];
}

/**
 * Options for retrieveContext function
 */
export interface RetrievalOptions {
    k?: number; // Number of chunks to retrieve (default: 5)
    filters?: {
        documentIds?: string[];
        dateRange?: { start: number; end: number };
        metadata?: Record<string, any>;
    };
}

/**
 * Conversation message for context assembly
 */
export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * Assembled context for LLM prompt
 */
export interface AssembledContext {
    systemPrompt: string;
    userPrompt: string;
    conversationHistory: ConversationMessage[];
    totalTokens: number;
    truncated: boolean;
}

/**
 * Options for context assembly
 */
export interface ContextAssemblyOptions {
    maxContextTokens?: number; // Maximum tokens for total context (default: 180000 for Claude 3 Sonnet)
    conversationWindowSize?: number; // Number of conversation messages to include (default: 10)
    includeChunkScores?: boolean; // Include similarity scores in citations (default: false)
}
