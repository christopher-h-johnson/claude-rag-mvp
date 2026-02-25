import { APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || '';

export const handler = async (
    event: APIGatewayProxyWebsocketEventV2
): Promise<APIGatewayProxyResultV2> => {
    console.log('WebSocket $disconnect event:', JSON.stringify(event, null, 2));

    const connectionId = event.requestContext.connectionId;

    try {
        await docClient.send(new DeleteCommand({
            TableName: CONNECTIONS_TABLE,
            Key: {
                PK: `CONNECTION#${connectionId}`,
                SK: `CONNECTION#${connectionId}`
            }
        }));

        console.log(`Connection removed: ${connectionId}`);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Disconnected' })
        };
    } catch (error) {
        console.error('Error removing connection:', error);
        // Return 200 even on error since connection is already closed
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Disconnected' })
        };
    }
};
