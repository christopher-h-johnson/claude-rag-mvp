"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || '';
const handler = async (event) => {
    console.log('WebSocket $disconnect event:', JSON.stringify(event, null, 2));
    const connectionId = event.requestContext.connectionId;
    try {
        await docClient.send(new lib_dynamodb_1.DeleteCommand({
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
    }
    catch (error) {
        console.error('Error removing connection:', error);
        // Return 200 even on error since connection is already closed
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Disconnected' })
        };
    }
};
exports.handler = handler;
