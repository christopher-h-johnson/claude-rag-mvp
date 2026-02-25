"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const jwt = __importStar(require("jsonwebtoken"));
const bcrypt = __importStar(require("bcryptjs"));
const uuid_1 = require("uuid");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const SESSIONS_TABLE = process.env.SESSIONS_TABLE || 'Sessions';
const USERS_TABLE = process.env.USERS_TABLE || 'Users';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const SESSION_DURATION_HOURS = 24;
/**
 * Login endpoint Lambda function
 * POST /auth/login
 */
const handler = async (event, context) => {
    console.log('Login request received', { requestId: context.awsRequestId });
    try {
        // Parse request body
        if (!event.body) {
            return createResponse(400, { error: 'Request body is required' });
        }
        const request = JSON.parse(event.body);
        // Validate input
        if (!request.username || !request.password) {
            return createResponse(400, { error: 'Username and password are required' });
        }
        // Get user from DynamoDB
        const user = await getUser(request.username);
        if (!user) {
            console.log('User not found', { username: request.username });
            return createResponse(401, { error: 'Invalid credentials' });
        }
        // Verify password
        const passwordValid = await bcrypt.compare(request.password, user.passwordHash);
        if (!passwordValid) {
            console.log('Invalid password', { username: request.username });
            return createResponse(401, { error: 'Invalid credentials' });
        }
        // Generate session ID
        const sessionId = (0, uuid_1.v4)();
        const now = Date.now();
        const expiresAt = now + SESSION_DURATION_HOURS * 60 * 60 * 1000;
        // Get client IP address
        const ipAddress = event.requestContext?.identity?.sourceIp || 'unknown';
        // Create session in DynamoDB
        const session = {
            PK: `SESSION#${sessionId}`,
            SK: `SESSION#${sessionId}`,
            userId: user.userId,
            username: user.username,
            roles: user.roles,
            createdAt: now,
            lastAccessedAt: now,
            expiresAt,
            ipAddress,
        };
        await docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: SESSIONS_TABLE,
            Item: session,
        }));
        // Generate JWT token
        const token = jwt.sign({
            userId: user.userId,
            username: user.username,
            roles: user.roles,
            sessionId,
        }, JWT_SECRET, {
            expiresIn: `${SESSION_DURATION_HOURS}h`,
        });
        const response = {
            token,
            expiresAt,
            userId: user.userId,
        };
        console.log('Login successful', { userId: user.userId, sessionId });
        return createResponse(200, response);
    }
    catch (error) {
        console.error('Login error', { error: error instanceof Error ? error.message : error });
        return createResponse(500, { error: 'Internal server error' });
    }
};
exports.handler = handler;
/**
 * Get user from DynamoDB
 */
async function getUser(username) {
    try {
        const result = await docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: USERS_TABLE,
            Key: {
                PK: `USER#${username}`,
                SK: `USER#${username}`,
            },
        }));
        return result.Item;
    }
    catch (error) {
        console.error('Error fetching user from DynamoDB', { error, username });
        return null;
    }
}
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
