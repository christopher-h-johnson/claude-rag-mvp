"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const SESSIONS_TABLE = process.env.SESSIONS_TABLE || 'Sessions';
/**
 * Logout endpoint Lambda function
 * POST /auth/logout
 */
const handler = async (event, context) => {
    console.log('Logout request received', { requestId: context.awsRequestId });
    try {
        // Get session ID from authorizer context
        const sessionId = event.requestContext?.authorizer?.sessionId;
        if (!sessionId) {
            return createResponse(400, { error: 'Session ID not found in request context' });
        }
        // Delete session from DynamoDB
        await docClient.send(new lib_dynamodb_1.DeleteCommand({
            TableName: SESSIONS_TABLE,
            Key: {
                PK: `SESSION#${sessionId}`,
                SK: `SESSION#${sessionId}`,
            },
        }));
        console.log('Logout successful', { sessionId });
        return createResponse(200, {
            success: true,
            message: 'Logged out successfully',
        });
    }
    catch (error) {
        console.error('Logout error', { error: error instanceof Error ? error.message : error });
        return createResponse(500, { error: 'Internal server error' });
    }
};
exports.handler = handler;
/**
 * Create API Gateway response
 */
function createResponse(statusCode, body) {
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
