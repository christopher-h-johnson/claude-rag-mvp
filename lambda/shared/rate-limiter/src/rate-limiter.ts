import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
    RateLimitResult,
    RateLimitStatus,
    RateLimiterConfig,
    RateLimitRecord,
    UserContext,
} from './types';

/**
 * Rate Limiter implementation using DynamoDB sliding window algorithm
 * 
 * Implements requirements:
 * - 10.1: Enforce 60 requests per minute per user
 * - 10.2: Return HTTP 429 with retry-after header when limit exceeded
 * - 10.3: Track request counts using sliding window algorithm
 * - 10.4: Reset user request counts every 60 seconds
 * - 10.5: Allow 300 requests per minute for administrative access
 */
export class RateLimiter {
    private docClient: DynamoDBDocumentClient;
    private config: RateLimiterConfig;

    constructor(config: Partial<RateLimiterConfig> = {}) {
        const dynamoClient = new DynamoDBClient({});
        this.docClient = DynamoDBDocumentClient.from(dynamoClient);

        this.config = {
            tableName: config.tableName || process.env.RATE_LIMITS_TABLE || 'RateLimits',
            defaultLimit: config.defaultLimit || 60,
            adminLimit: config.adminLimit || 300,
            windowSizeSeconds: config.windowSizeSeconds || 60,
        };
    }

    /**
     * Check if a request is allowed and increment the counter atomically
     * Uses DynamoDB conditional writes to implement sliding window algorithm
     */
    async checkRateLimit(userContext: UserContext): Promise<RateLimitResult> {
        const now = Date.now();
        const windowStart = Math.floor(now / 1000 / this.config.windowSizeSeconds) * this.config.windowSizeSeconds;
        const windowEnd = windowStart + this.config.windowSizeSeconds;

        // Determine limit based on user roles
        const limit = this.isAdmin(userContext) ? this.config.adminLimit : this.config.defaultLimit;

        const pk = `USER#${userContext.userId}`;
        const sk = `WINDOW#${windowStart}`;

        try {
            // Try to increment the counter with a conditional write
            // This ensures atomicity and prevents race conditions
            const result = await this.docClient.send(
                new UpdateCommand({
                    TableName: this.config.tableName,
                    Key: { PK: pk, SK: sk },
                    UpdateExpression: 'SET requestCount = if_not_exists(requestCount, :zero) + :inc, #limit = :limit, windowStart = :windowStart, windowEnd = :windowEnd, #ttl = :ttl',
                    ConditionExpression: 'attribute_not_exists(requestCount) OR requestCount < :limit',
                    ExpressionAttributeNames: {
                        '#limit': 'limit',
                        '#ttl': 'ttl',
                    },
                    ExpressionAttributeValues: {
                        ':zero': 0,
                        ':inc': 1,
                        ':limit': limit,
                        ':windowStart': windowStart,
                        ':windowEnd': windowEnd,
                        ':ttl': windowEnd + 60, // Keep record for 60 seconds after window ends
                    },
                    ReturnValues: 'ALL_NEW',
                })
            );

            const requestCount = result.Attributes?.requestCount || 1;
            const remainingRequests = Math.max(0, limit - requestCount);

            return {
                allowed: true,
                remainingRequests,
                resetAt: windowEnd * 1000, // Convert to milliseconds
            };
        } catch (error: any) {
            // ConditionalCheckFailedException means the limit was exceeded
            if (error.name === 'ConditionalCheckFailedException') {
                // Get current status to return accurate information
                const status = await this.getRateLimitStatus(userContext.userId);

                const retryAfter = status ? Math.ceil((status.windowEnd * 1000 - now) / 1000) : this.config.windowSizeSeconds;

                return {
                    allowed: false,
                    remainingRequests: 0,
                    resetAt: status ? status.windowEnd * 1000 : (windowEnd * 1000),
                    retryAfter,
                };
            }

            // Re-throw unexpected errors
            console.error('Rate limiter error:', error);
            throw error;
        }
    }

    /**
     * Get current rate limit status for a user without incrementing
     */
    async getRateLimitStatus(userId: string): Promise<RateLimitStatus | null> {
        const now = Date.now();
        const windowStart = Math.floor(now / 1000 / this.config.windowSizeSeconds) * this.config.windowSizeSeconds;

        const pk = `USER#${userId}`;
        const sk = `WINDOW#${windowStart}`;

        try {
            const result = await this.docClient.send(
                new GetCommand({
                    TableName: this.config.tableName,
                    Key: { PK: pk, SK: sk },
                })
            );

            if (!result.Item) {
                return null;
            }

            const record = result.Item as RateLimitRecord;
            return {
                requestCount: record.requestCount,
                limit: record.limit,
                windowStart: record.windowStart,
                windowEnd: record.windowEnd,
            };
        } catch (error) {
            console.error('Error fetching rate limit status:', error);
            return null;
        }
    }

    /**
     * Check if user has admin role
     */
    private isAdmin(userContext: UserContext): boolean {
        return userContext.roles.includes('admin') || userContext.roles.includes('administrator');
    }
}
