import { Message } from './types';
/**
 * WebSocket message sender utility
 */
export declare class MessageSender {
    private apiClient;
    private connectionsTable;
    constructor(apiEndpoint: string, connectionsTable: string);
    /**
     * Send a message to a specific WebSocket connection
     * @param connectionId - The WebSocket connection ID
     * @param message - The message to send
     * @returns Promise<boolean> - true if sent successfully, false if connection is stale
     */
    sendMessage(connectionId: string, message: Message): Promise<boolean>;
    /**
     * Broadcast a message to all connections for a specific user
     * @param userId - The user ID
     * @param message - The message to broadcast
     * @returns Promise<number> - Number of successful sends
     */
    broadcastToUser(userId: string, message: Message): Promise<number>;
    /**
     * Remove a stale connection from the database
     * @param connectionId - The connection ID to remove
     */
    private removeStaleConnection;
    /**
     * Create a chat response message
     */
    static createChatResponse(messageId: string, content: string, isComplete: boolean, retrievedChunks?: Array<{
        documentName: string;
        pageNumber: number;
        text: string;
    }>): Message;
    /**
     * Create a typing indicator message
     */
    static createTypingIndicator(isTyping: boolean): Message;
    /**
     * Create an error message
     */
    static createError(code: string, message: string, retryable: boolean): Message;
    /**
     * Create a system message
     */
    static createSystem(message: string, level: 'info' | 'warning' | 'error'): Message;
}
