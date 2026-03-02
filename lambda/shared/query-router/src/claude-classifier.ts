/**
 * Claude-based fallback classifier for ambiguous queries
 * 
 * When heuristic classification has low confidence (< 0.7), this module
 * uses Claude via Bedrock to make a more informed classification decision.
 */

import { QueryClassification, Message } from './types';

/**
 * Minimal Bedrock service interface for classification
 * This allows the classifier to work without direct dependency on the bedrock module
 */
export interface BedrockClassifierService {
    generateResponseSync(request: {
        prompt: string;
        systemPrompt?: string;
        maxTokens?: number;
        temperature?: number;
    }): Promise<string>;
}

const CLASSIFICATION_SYSTEM_PROMPT = `You are a query classification assistant. Your job is to determine whether a user's query requires retrieving information from documents (RAG retrieval) or can be answered directly by the AI assistant without document lookup.

Queries that REQUIRE retrieval (answer "YES"):
- Questions about specific documents, files, or PDFs
- Questions asking for information that would be in organizational documents
- Questions referencing "the document", "the file", "uploaded content"
- Questions about specific facts, data, or details that need verification
- Questions asking to find, search, or look up information

Queries that DO NOT require retrieval (answer "NO"):
- General knowledge questions that don't reference documents
- Conversational exchanges (greetings, thanks, acknowledgments)
- Questions about the assistant's capabilities
- Creative tasks (writing, brainstorming) that don't need document context
- Follow-up clarifications about previous responses

Respond with ONLY a JSON object in this exact format:
{
  "requiresRetrieval": true or false,
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation of your decision"
}`;

/**
 * Use Claude to classify an ambiguous query
 * 
 * @param query - The user's query text
 * @param conversationContext - Previous messages for context
 * @param bedrockService - BedrockService instance (required)
 * @returns QueryClassification with Claude's decision
 */
export async function classifyWithClaude(
    query: string,
    conversationContext: Message[] = [],
    bedrockService: BedrockClassifierService
): Promise<QueryClassification> {
    // Build the classification prompt
    let prompt = `Query to classify: "${query}"`;

    // Add conversation context if available
    if (conversationContext.length > 0) {
        prompt += '\n\nRecent conversation context:\n';
        const recentMessages = conversationContext.slice(-3);  // Last 3 messages
        for (const msg of recentMessages) {
            prompt += `${msg.role}: ${msg.content}\n`;
        }
    }

    prompt += '\n\nProvide your classification as JSON:';

    try {
        // Call Claude for classification
        const response = await bedrockService.generateResponseSync({
            prompt,
            systemPrompt: CLASSIFICATION_SYSTEM_PROMPT,
            maxTokens: 256,
            temperature: 0.3,
        });

        // Parse Claude's response
        const classification = parseClaudeResponse(response, query);
        return classification;

    } catch (error) {
        // If Claude fails, default to requiring retrieval (safer choice)
        logError('Claude classification failed:', error);
        return {
            requiresRetrieval: true,
            confidence: 0.5,
            reasoning: 'Claude classification failed, defaulting to retrieval',
            suggestedK: 5,
        };
    }
}

/**
 * Parse Claude's JSON response into QueryClassification
 * 
 * @param response - Raw response text from Claude
 * @param query - Original query (for dynamic k calculation)
 * @returns QueryClassification object
 */
function parseClaudeResponse(response: string, query: string): QueryClassification {
    try {
        // Extract JSON from response (Claude might include extra text)
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in Claude response');
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // Validate required fields
        if (typeof parsed.requiresRetrieval !== 'boolean') {
            throw new Error('Invalid requiresRetrieval field');
        }

        const confidence = typeof parsed.confidence === 'number'
            ? Math.max(0, Math.min(1, parsed.confidence))
            : 0.7;

        const reasoning = typeof parsed.reasoning === 'string'
            ? `Claude: ${parsed.reasoning}`
            : 'Claude classification';

        // Determine suggested k based on query complexity
        const suggestedK = determineOptimalKForClaude(parsed.requiresRetrieval, query);

        return {
            requiresRetrieval: parsed.requiresRetrieval,
            confidence,
            reasoning,
            suggestedK,
        };

    } catch (error) {
        logError('Failed to parse Claude response:', error);
        logError('Raw response:', response);

        // Fallback: default to retrieval for safety
        return {
            requiresRetrieval: true,
            confidence: 0.5,
            reasoning: 'Failed to parse Claude response, defaulting to retrieval',
            suggestedK: 5,
        };
    }
}

/**
 * Determine optimal k value for Claude-classified queries
 * 
 * @param requiresRetrieval - Whether retrieval is needed
 * @param query - The original query text
 * @returns Suggested k value (0, 5, or 10)
 */
function determineOptimalKForClaude(requiresRetrieval: boolean, query: string): number {
    if (!requiresRetrieval) {
        return 0;
    }

    // Analyze query complexity
    const wordCount = query.trim().split(/\s+/).length;
    let complexityScore = 0;

    // Complex query patterns
    const complexPatterns = [
        /\b(compare|contrast|difference|similar|relationship)\b/i,
        /\b(all|every|entire|complete|comprehensive)\b/i,
        /\b(multiple|several|various|different)\b/i,
        /\b(overview|summary|summarize|explain everything)\b/i,
        /\b(list all|show all|find all)\b/i,
    ];

    for (const pattern of complexPatterns) {
        if (pattern.test(query)) {
            complexityScore += 1;
        }
    }

    // Long queries suggest complexity
    if (wordCount > 15) {
        complexityScore += 1;
    }

    // Multiple questions
    const questionMarkCount = (query.match(/\?/g) || []).length;
    if (questionMarkCount >= 2) {
        complexityScore += 1;
    }

    // Return k=10 for complex queries, k=5 for simple ones
    return complexityScore >= 2 ? 10 : 5;
}

/**
 * Simple error logging helper
 */
function logError(...args: any[]): void {
    // Simple no-op for now - errors will be caught and handled by callers
    // In production, this would integrate with CloudWatch Logs
}
