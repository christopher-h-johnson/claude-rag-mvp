import {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
    GoneException
} from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Message } from './types';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * WebSocket message sender utility
 */
export class MessageSender {
    private apiClient: ApiGatewayManagementApiClient;
    private connectionsTable: string;

    constructor(apiEndpoint: string, connectionsTable: string) {
        this.apiClient = new ApiGatewayManagementApiClient({
            endpoint: apiEndpoint
        });
        this.connectionsTable = connectionsTable;
    }

    /**
     * Send a message to a specific WebSocket connection
     * @param connectionId - The WebSocket connection ID
     * @param message - The message to send
     * @returns Promise<boolean> - true if sent successfully, false if connection is stale
     */
    async sendMessage(connectionId: string, message: Message): Promise<boolean> {
        try {
            const data = JSON.stringify(message);

            await this.apiClient.send(new PostToConnectionCommand({
                ConnectionId: connectionId,
                Data: Buffer.from(data)
            }));

            console.log(`Message sent to connection ${connectionId}:`, message.type);
            return true;
        } catch (error) {
            if (error instanceof GoneException) {
                console.log(`Connection ${connectionId} is stale (410 Gone), removing from database`);
                await this.removeStaleConnection(connectionId);
                return false;
            }

            console.error(`Error sending message to connection ${connectionId}:`, error);
            throw error;
        }
    }

    /**
     * Broadcast a message to all connections for a specific user
     * @param userId - The user ID
     * @param message - The message to broadcast
     * @returns Promise<number> - Number of successful sends
     */
    async broadcastToUser(userId: string, message: Message): Promise<number> {
        try {
            // Query all connections for this user
            const result = await docClient.send(new QueryCommand({
                TableName: this.connectionsTable,
                IndexName: 'userId-index',
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeValues: {
                    ':userId': userId
                }
            }));

            if (!result.Items || result.Items.length === 0) {
                console.log(`No active connections found for user ${userId}`);
                return 0;
            }

            // Send message to all connections
            const sendPromises = result.Items.map(item =>
                this.sendMessage(item.connectionId, message)
            );

            const results = await Promise.allSettled(sendPromises);

            const successCount = results.filter(r =>
                r.status === 'fulfilled' && r.value === true
            ).length;

            console.log(`Broadcast to user ${userId}: ${successCount}/${result.Items.length} successful`);
            return successCount;
        } catch (error) {
            console.error(`Error broadcasting to user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Remove a stale connection from the database
     * @param connectionId - The connection ID to remove
     */
    private async removeStaleConnection(connectionId: string): Promise<void> {
        try {
            await docClient.send(new DeleteCommand({
                TableName: this.connectionsTable,
                Key: {
                    PK: `CONNECTION#${connectionId}`,
                    SK: `CONNECTION#${connectionId}`
                }
            }));
            console.log(`Removed stale connection ${connectionId} from database`);
        } catch (error) {
            console.error(`Error removing stale connection ${connectionId}:`, error);
            // Don't throw - this is cleanup, not critical
        }
    }

    /**
     * Create a chat response message
     */
    static createChatResponse(
        messageId: string,
        content: string,
        isComplete: boolean,
        retrievedChunks?: Array<{ documentName: string; pageNumber: number; text: string }>
    ): Message {
        return {
            type: 'chat_response',
            payload: {
                messageId,
                content,
                isComplete,
                retrievedChunks
            },
            timestamp: Date.now()
        };
    }

    /**
     * Create a typing indicator message
     */
    static createTypingIndicator(isTyping: boolean): Message {
        return {
            type: 'typing_indicator',
            payload: { isTyping },
            timestamp: Date.now()
        };
    }

    /**
     * Create an error message
     */
    static createError(code: string, message: string, retryable: boolean): Message {
        return {
            type: 'error',
            payload: { code, message, retryable },
            timestamp: Date.now()
        };
    }

    /**
     * Create a system message
     */
    static createSystem(message: string, level: 'info' | 'warning' | 'error'): Message {
        return {
            type: 'system',
            payload: { message, level },
            timestamp: Date.now()
        };
    }
}
