/**
 * Types for Bedrock Service
 */

export interface GenerationRequest {
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
    conversationHistory?: ConversationMessage[];
}

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ResponseChunk {
    text: string;
    isComplete: boolean;
    tokenCount?: number;
}

export interface BedrockConfig {
    region?: string;
    modelId?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
}
