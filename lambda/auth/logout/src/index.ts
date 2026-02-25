import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SESSIONS_TABLE = process.env.SESSIONS_TABLE || 'Sessions';

/**
 * Logout endpoint Lambda function
 * POST /auth/logout
 */
export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    console.log('Logout request received', { requestId: context.awsRequestId });

    try {
        // Get session ID from authorizer context
        const sessionId = event.requestContext?.authorizer?.sessionId;

        if (!sessionId) {
            return createResponse(400, { error: 'Session ID not found in request context' });
        }

        // Delete session from DynamoDB
        await docClient.send(
            new DeleteCommand({
                TableName: SESSIONS_TABLE,
                Key: {
                    PK: `SESSION#${sessionId}`,
                    SK: `SESSION#${sessionId}`,
                },
            })
        );

        console.log('Logout successful', { sessionId });

        return createResponse(200, {
            success: true,
            message: 'Logged out successfully',
        });
    } catch (error) {
        console.error('Logout error', { error: error instanceof Error ? error.message : error });
        return createResponse(500, { error: 'Internal server error' });
    }
};

/**
 * Create API Gateway response
 */
function createResponse(statusCode: number, body: any): APIGatewayProxyResult {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify(body),
    };
}
