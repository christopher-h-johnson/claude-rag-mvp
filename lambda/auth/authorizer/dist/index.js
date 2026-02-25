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
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const SESSIONS_TABLE = process.env.SESSIONS_TABLE || 'Sessions';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const authCache = new Map();
/**
 * Lambda Authorizer function for API Gateway
 * Validates JWT tokens and checks session validity in DynamoDB
 */
const handler = async (event, context) => {
    console.log('Authorizer invoked', { requestId: context.awsRequestId });
    try {
        const token = event.authorizationToken;
        if (!token) {
            throw new Error('No authorization token provided');
        }
        // Remove 'Bearer ' prefix if present
        const cleanToken = token.replace(/^Bearer\s+/i, '');
        // Check cache first
        const cachedEntry = authCache.get(cleanToken);
        if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
            console.log('Returning cached authorization decision');
            return cachedEntry.policy;
        }
        // Verify JWT token
        const decoded = jwt.verify(cleanToken, JWT_SECRET);
        // Check if token is expired (24 hours)
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp < now) {
            console.log('Token expired', { exp: decoded.exp, now });
            throw new Error('Token expired');
        }
        // Validate session in DynamoDB
        const sessionId = decoded.sessionId;
        const session = await getSession(sessionId);
        if (!session) {
            console.log('Session not found in DynamoDB', { sessionId });
            throw new Error('Invalid session');
        }
        // Check if session is expired
        if (session.expiresAt < Date.now()) {
            console.log('Session expired in DynamoDB', { expiresAt: session.expiresAt });
            throw new Error('Session expired');
        }
        // Generate IAM policy
        const policy = generatePolicy(decoded.userId, 'Allow', event.methodArn, {
            userId: decoded.userId,
            username: decoded.username,
            roles: JSON.stringify(decoded.roles),
            sessionId: decoded.sessionId,
        });
        // Cache the authorization decision
        authCache.set(cleanToken, {
            policy,
            expiresAt: Date.now() + CACHE_TTL_MS,
        });
        // Clean up expired cache entries periodically
        cleanupCache();
        console.log('Authorization successful', { userId: decoded.userId });
        return policy;
    }
    catch (error) {
        console.error('Authorization failed', { error: error instanceof Error ? error.message : error });
        // Return deny policy
        return generatePolicy('user', 'Deny', event.methodArn);
    }
};
exports.handler = handler;
/**
 * Get session from DynamoDB
 */
async function getSession(sessionId) {
    try {
        const result = await docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: SESSIONS_TABLE,
            Key: {
                PK: `SESSION#${sessionId}`,
                SK: `SESSION#${sessionId}`,
            },
        }));
        return result.Item;
    }
    catch (error) {
        console.error('Error fetching session from DynamoDB', { error, sessionId });
        return null;
    }
}
/**
 * Generate IAM policy document for API Gateway
 */
function generatePolicy(principalId, effect, resource, context) {
    const policy = {
        principalId,
        policyDocument: {
            Version: '2012-10-17',
            Statement: [
                {
                    Action: 'execute-api:Invoke',
                    Effect: effect,
                    Resource: resource,
                },
            ],
        },
    };
    if (context && effect === 'Allow') {
        policy.context = context;
    }
    return policy;
}
/**
 * Clean up expired cache entries
 */
function cleanupCache() {
    const now = Date.now();
    for (const [key, entry] of authCache.entries()) {
        if (entry.expiresAt < now) {
            authCache.delete(key);
        }
    }
}
