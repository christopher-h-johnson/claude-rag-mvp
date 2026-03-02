/**
 * RAG Orchestration Module
 * 
 * Exports the RAGSystem class and related types for coordinating
 * embedding generation, caching, and vector search operations.
 * 
 * Requirements: 7.1, 7.2, 7.4, 12.2
 */

export { RAGSystem } from './rag.js';
export type {
    RAGConfig,
    RetrievalResult,
    RetrievalOptions,
    AssembledContext,
    ContextAssemblyOptions,
    ConversationMessage,
    DocumentChunk
} from './types.js';
