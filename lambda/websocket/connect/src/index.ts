import { APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || '';

// Extend the event type to include authorizer context
interface WebSocketConnectEvent extends APIGatewayProxyWebsocketEventV2 {
    requestContext: APIGatewayProxyWebsocketEventV2['requestContext'] & {
        authorizer?: {
            userId: string;
            username?: string;
            [key: string]: any;
        };
    };
}

interface ConnectionRecord {
    PK: string;
    SK: string;
    connectionId: string;
    userId: string;
    connectedAt: number;
    ttl: number;
}

export const handler = async (
    event: WebSocketConnectEvent
): Promise<APIGatewayProxyResultV2> => {
    console.log('WebSocket $connect event:', JSON.stringify(event, null, 2));

    const connectionId = event.requestContext.connectionId;

    // Extract userId from authorizer context
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
        console.error('No userId found in authorizer context');
        return {
            statusCode: 401,
            body: JSON.stringify({ message: 'Unauthorized' })
        };
    }

    try {
        const now = Date.now();
        const ttl = Math.floor(now / 1000) + (10 * 60); // 10 minutes from now

        const record: ConnectionRecord = {
            PK: `CONNECTION#${connectionId}`,
            SK: `CONNECTION#${connectionId}`,
            connectionId,
            userId,
            connectedAt: now,
            ttl
        };

        await docClient.send(new PutCommand({
            TableName: CONNECTIONS_TABLE,
            Item: record
        }));

        console.log(`Connection stored: ${connectionId} for user ${userId}`);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Connected' })
        };
    } catch (error) {
        console.error('Error storing connection:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal server error' })
        };
    }
};
