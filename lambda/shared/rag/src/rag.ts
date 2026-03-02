/**
 * RAG Orchestration Module
 * 
 * Coordinates embedding generation, caching, and vector search
 * to retrieve relevant document chunks for user queries.
 * 
 * Requirements: 7.1, 7.2, 12.2
 */

// @ts-ignore - Using built dist files from sibling modules
import { EmbeddingGenerator } from '../../embeddings/dist/embeddings.js';
// @ts-ignore
import { OpenSearchVectorStore } from '../../vector-store/dist/opensearch-client.js';
// @ts-ignore
import { CacheLayer } from '../../cache/dist/cache.js';
import type { DocumentChunk } from './types.js';
import type { RAGConfig, RetrievalResult, RetrievalOptions, AssembledContext, ContextAssemblyOptions, ConversationMessage } from './types.js';

export class RAGSystem {
    private embeddingGenerator: EmbeddingGenerator;
    private vectorStore: OpenSearchVectorStore;
    private cache: CacheLayer | null = null;
    private cacheEnabled: boolean;

    constructor(config: RAGConfig) {
        // Initialize embedding generator
        this.embeddingGenerator = new EmbeddingGenerator({
            region: config.region,
        });

        // Initialize vector store
        this.vectorStore = new OpenSearchVectorStore(
            config.opensearchEndpoint,
            'documents',
            config.region
        );

        // Initialize cache if configuration provided
        this.cacheEnabled = !!(config.cacheHost && config.cachePort);
        if (this.cacheEnabled) {
            this.cache = new CacheLayer({
                host: config.cacheHost!,
                port: config.cachePort!,
                password: config.cachePassword,
                tls: config.cacheTls,
            });
        }
    }

    /**
     * Initialize the RAG system (connect to cache if enabled)
     */
    async initialize(): Promise<void> {
        if (this.cache && this.cacheEnabled) {
            try {
                await this.cache.connect();
                console.log('Cache connected successfully');
            } catch (error) {
                console.warn('Failed to connect to cache, continuing without cache:', error);
                this.cacheEnabled = false;
            }
        }
    }

    /**
     * Retrieve relevant document chunks for a query
     * 
     * This function:
     * 1. Generates query embedding using Embedding Generator
     * 2. Checks cache for query embedding hash
     * 3. Searches Vector Store with query embedding (if cache miss)
     * 4. Returns top k document chunks with scores
     * 5. Caches search results for 15 minutes
     * 
     * @param query - The user query text
     * @param options - Retrieval options (k, filters)
     * @returns RetrievalResult containing chunks and metadata
     */
    async retrieveContext(
        query: string,
        options: RetrievalOptions = {}
    ): Promise<RetrievalResult> {
        const k = options.k || 5;

        // Step 1: Generate query embedding
        console.log('Generating query embedding...');
        const startEmbedding = Date.now();
        const embeddingResult = await this.embeddingGenerator.generateEmbedding(query);
        const queryEmbedding = embeddingResult.embedding;
        const embeddingTime = Date.now() - startEmbedding;
        console.log(`Query embedding generated in ${embeddingTime}ms`);

        // Step 2: Check cache for query embedding hash
        let chunks: DocumentChunk[] | null = null;
        let fromCache = false;

        if (this.cacheEnabled && this.cache) {
            console.log('Checking cache for search results...');
            const startCache = Date.now();
            chunks = await this.cache.getCachedSearchResults(queryEmbedding);
            const cacheTime = Date.now() - startCache;

            if (chunks) {
                console.log(`Cache hit! Retrieved ${chunks.length} chunks in ${cacheTime}ms`);
                fromCache = true;

                // Apply k limit to cached results if needed
                if (chunks.length > k) {
                    chunks = chunks.slice(0, k);
                }

                return {
                    chunks,
                    fromCache,
                    queryEmbedding,
                };
            } else {
                console.log(`Cache miss (${cacheTime}ms)`);
            }
        }

        // Step 3: Search Vector Store with query embedding
        console.log(`Searching vector store for top ${k} chunks...`);
        const startSearch = Date.now();
        const searchResults = await this.vectorStore.searchSimilar(
            queryEmbedding,
            k,
            options.filters
        );
        const searchTime = Date.now() - startSearch;
        console.log(`Vector search completed in ${searchTime}ms, found ${searchResults.length} results`);

        // Extract chunks from search results
        chunks = searchResults.map((result: any) => result.chunk);

        // Step 4: Cache search results for 15 minutes
        if (this.cacheEnabled && this.cache && chunks && chunks.length > 0) {
            console.log('Caching search results...');
            try {
                await this.cache.setCachedSearchResults(queryEmbedding, chunks);
                console.log('Search results cached successfully');
            } catch (error) {
                console.warn('Failed to cache search results:', error);
                // Continue without caching - not critical
            }
        }

        return {
            chunks: chunks || [],
            fromCache,
            queryEmbedding,
        };
    }

    /**
     * Generate query embedding without performing search
     * Useful for pre-computing embeddings or testing
     * 
     * @param query - The query text
     * @returns The embedding vector
     */
    async generateQueryEmbedding(query: string): Promise<number[]> {
        const result = await this.embeddingGenerator.generateEmbedding(query);
        return result.embedding;
    }

    /**
     * Disconnect from cache
     */
    async disconnect(): Promise<void> {
        if (this.cache) {
            await this.cache.disconnect();
        }
    }

    /**
     * Check if cache is available
     */
    isCacheAvailable(): boolean {
        return this.cacheEnabled && this.cache !== null && this.cache.isAvailable();
    }

    /**
     * Assemble context for LLM prompt from retrieved chunks and conversation history
     * 
     * This function:
     * 1. Formats retrieved chunks with document citations (filename, page number)
     * 2. Combines chunks with conversation history
     * 3. Creates system prompt instructing Claude to use provided context
     * 4. Limits total context to fit within Claude's context window
     * 
     * Requirements: 7.4
     * 
     * @param query - The user query
     * @param chunks - Retrieved document chunks
     * @param conversationHistory - Previous conversation messages
     * @param options - Context assembly options
     * @returns AssembledContext ready for LLM invocation
     */
    assembleContext(
        query: string,
        chunks: DocumentChunk[],
        conversationHistory: ConversationMessage[] = [],
        options: ContextAssemblyOptions = {}
    ): AssembledContext {
        const maxContextTokens = options.maxContextTokens || 180000; // Claude 3 Sonnet: 200k context, leave buffer
        const conversationWindowSize = options.conversationWindowSize || 10;
        const includeChunkScores = options.includeChunkScores || false;

        // Step 1: Format retrieved chunks with document citations
        const formattedChunks = this.formatChunksWithCitations(chunks, includeChunkScores);

        // Step 2: Create system prompt instructing Claude to use provided context
        const systemPrompt = this.createSystemPrompt(chunks.length > 0);

        // Step 3: Apply sliding window to conversation history
        const limitedHistory = this.limitConversationHistory(
            conversationHistory,
            conversationWindowSize
        );

        // Step 4: Assemble user prompt with retrieved context
        const userPrompt = this.assembleUserPrompt(query, formattedChunks);

        // Step 5: Estimate total tokens and truncate if necessary
        const estimatedTokens = this.estimateTokenCount(
            systemPrompt,
            userPrompt,
            limitedHistory
        );

        let truncated = false;
        let finalHistory = limitedHistory;
        let finalChunks = formattedChunks;

        // If we exceed token limit, progressively reduce context
        if (estimatedTokens > maxContextTokens) {
            truncated = true;
            console.warn(
                `Context exceeds token limit (${estimatedTokens} > ${maxContextTokens}), truncating...`
            );

            // Strategy 1: Reduce conversation history further
            if (limitedHistory.length > 5) {
                finalHistory = limitedHistory.slice(-5);
                const newEstimate = this.estimateTokenCount(systemPrompt, userPrompt, finalHistory);

                if (newEstimate <= maxContextTokens) {
                    return {
                        systemPrompt,
                        userPrompt,
                        conversationHistory: finalHistory,
                        totalTokens: newEstimate,
                        truncated,
                    };
                }
            }

            // Strategy 2: Reduce number of chunks
            if (chunks.length > 3) {
                const reducedChunks = chunks.slice(0, 3);
                finalChunks = this.formatChunksWithCitations(reducedChunks, includeChunkScores);
                const reducedUserPrompt = this.assembleUserPrompt(query, finalChunks);
                const newEstimate = this.estimateTokenCount(
                    systemPrompt,
                    reducedUserPrompt,
                    finalHistory
                );

                if (newEstimate <= maxContextTokens) {
                    return {
                        systemPrompt,
                        userPrompt: reducedUserPrompt,
                        conversationHistory: finalHistory,
                        totalTokens: newEstimate,
                        truncated,
                    };
                }
            }

            // Strategy 3: Remove conversation history entirely
            finalHistory = [];
            const newEstimate = this.estimateTokenCount(systemPrompt, userPrompt, finalHistory);

            console.warn('Removed conversation history to fit context window');

            return {
                systemPrompt,
                userPrompt,
                conversationHistory: finalHistory,
                totalTokens: newEstimate,
                truncated,
            };
        }

        return {
            systemPrompt,
            userPrompt,
            conversationHistory: finalHistory,
            totalTokens: estimatedTokens,
            truncated,
        };
    }

    /**
     * Format document chunks with citations
     * @private
     */
    private formatChunksWithCitations(
        chunks: DocumentChunk[],
        includeScores: boolean
    ): string {
        if (chunks.length === 0) {
            return '';
        }

        const formattedChunks = chunks.map((chunk, index) => {
            const citation = `[${index + 1}] ${chunk.documentName}, Page ${chunk.pageNumber}`;
            const scoreInfo = includeScores ? ` (relevance: ${chunk.score.toFixed(3)})` : '';

            return `${citation}${scoreInfo}\n${chunk.text}`;
        });

        return formattedChunks.join('\n\n---\n\n');
    }

    /**
     * Create system prompt for Claude
     * @private
     */
    private createSystemPrompt(hasContext: boolean): string {
        if (hasContext) {
            return `You are a helpful AI assistant with access to a knowledge base of documents. 

When answering questions:
1. Use the provided document context to give accurate, well-sourced answers
2. Cite specific documents and page numbers when referencing information (e.g., "According to [Document Name, Page X]...")
3. If the context doesn't contain relevant information, acknowledge this and provide a general response based on your knowledge
4. Be concise but thorough in your responses
5. If multiple documents provide relevant information, synthesize them coherently

The document context will be provided in the user's message with citations in the format: [N] Document Name, Page X`;
        } else {
            return `You are a helpful AI assistant. Provide accurate, concise, and helpful responses to user questions.`;
        }
    }

    /**
     * Limit conversation history to window size
     * @private
     */
    private limitConversationHistory(
        history: ConversationMessage[],
        windowSize: number
    ): ConversationMessage[] {
        if (!history || history.length === 0) {
            return [];
        }

        // Take the last N messages
        const startIndex = Math.max(0, history.length - windowSize);
        return history.slice(startIndex);
    }

    /**
     * Assemble user prompt with query and context
     * @private
     */
    private assembleUserPrompt(query: string, formattedChunks: string): string {
        if (!formattedChunks) {
            return query;
        }

        return `Context from knowledge base:

${formattedChunks}

---

User question: ${query}`;
    }

    /**
     * Estimate token count for context
     * Uses rough approximation: 1 token ≈ 4 characters
     * @private
     */
    private estimateTokenCount(
        systemPrompt: string,
        userPrompt: string,
        conversationHistory: ConversationMessage[]
    ): number {
        let totalChars = systemPrompt.length + userPrompt.length;

        for (const msg of conversationHistory) {
            totalChars += msg.content.length;
        }

        // Rough approximation: 1 token ≈ 4 characters
        // Add 20% buffer for formatting and special tokens
        return Math.ceil((totalChars / 4) * 1.2);
    }
}

