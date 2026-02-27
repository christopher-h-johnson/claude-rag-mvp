/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
    allowed: boolean;
    remainingRequests: number;
    resetAt: number;
    retryAfter?: number; // Seconds until the user can retry
}

/**
 * Current rate limit status for a user
 */
export interface RateLimitStatus {
    requestCount: number;
    limit: number;
    windowStart: number;
    windowEnd: number;
}

/**
 * Configuration for rate limiter
 */
export interface RateLimiterConfig {
    tableName: string;
    defaultLimit: number; // Default: 60 requests per minute
    adminLimit: number; // Default: 300 requests per minute
    windowSizeSeconds: number; // Default: 60 seconds
}

/**
 * DynamoDB record structure for rate limits
 */
export interface RateLimitRecord {
    PK: string; // "USER#<userId>"
    SK: string; // "WINDOW#<windowStart>"
    requestCount: number;
    limit: number;
    windowStart: number;
    windowEnd: number;
    ttl: number; // Auto-delete after window expires
}

/**
 * User context from authorizer
 */
export interface UserContext {
    userId: string;
    username: string;
    roles: string[];
    sessionId: string;
}
