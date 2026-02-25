/**
 * WebSocket message types
 */
export type MessageType = 'chat_response' | 'typing_indicator' | 'error' | 'system';

/**
 * Base message structure
 */
export interface Message {
    type: MessageType;
    payload: any;
    timestamp: number;
}

/**
 * Chat response message
 */
export interface ChatResponseMessage extends Message {
    type: 'chat_response';
    payload: {
        messageId: string;
        content: string;
        isComplete: boolean;
        retrievedChunks?: Array<{
            documentName: string;
            pageNumber: number;
            text: string;
        }>;
    };
}

/**
 * Typing indicator message
 */
export interface TypingIndicatorMessage extends Message {
    type: 'typing_indicator';
    payload: {
        isTyping: boolean;
    };
}

/**
 * Error message
 */
export interface ErrorMessage extends Message {
    type: 'error';
    payload: {
        code: string;
        message: string;
        retryable: boolean;
    };
}

/**
 * System message
 */
export interface SystemMessage extends Message {
    type: 'system';
    payload: {
        message: string;
        level: 'info' | 'warning' | 'error';
    };
}
