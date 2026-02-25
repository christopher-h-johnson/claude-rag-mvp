"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || '';
const handler = async (event) => {
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
        const record = {
            PK: `CONNECTION#${connectionId}`,
            SK: `CONNECTION#${connectionId}`,
            connectionId,
            userId,
            connectedAt: now,
            ttl
        };
        await docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: CONNECTIONS_TABLE,
            Item: record
        }));
        console.log(`Connection stored: ${connectionId} for user ${userId}`);
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Connected' })
        };
    }
    catch (error) {
        console.error('Error storing connection:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal server error' })
        };
    }
};
exports.handler = handler;
