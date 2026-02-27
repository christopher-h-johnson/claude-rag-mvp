/**
 * Example Lambda handler demonstrating rate limiter middleware usage
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { withRateLimit } from '../src/middleware';

/**
 * Example 1: Basic usage with default configuration
 * - 60 requests/minute for regular users
 * - 300 requests/minute for admin users
 */
const basicHandler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: 'Request processed successfully',
            requestId: context.requestId,
        }),
    };
};

export const handler = withRateLimit(basicHandler);

/**
 * Example 2: Custom configuration
 * - Custom rate limits
 * - Custom DynamoDB table name
 */
const customHandler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: 'Request processed with custom limits',
        }),
    };
};

export const handlerWithCustomConfig = withRateLimit(customHandler, {
    tableName: 'CustomRateLimits',
    defaultLimit: 100, // 100 requests per minute for regular users
    adminLimit: 500,   // 500 requests per minute for admins
    windowSizeSeconds: 60,
});

/**
 * Example 3: Manual rate limit checking
 * For cases where you need more control over the rate limiting logic
 */
import { checkRateLimit } from '../src/middleware';

export const manualCheckHandler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    try {
        // Manually check rate limit
        const rateLimitResult = await checkRateLimit(event);

        if (!rateLimitResult.allowed) {
            return {
                statusCode: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
                },
                body: JSON.stringify({
                    error: 'Rate limit exceeded',
                    retryAfter: rateLimitResult.retryAfter,
                    resetAt: rateLimitResult.resetAt,
                }),
            };
        }

        // Custom logic here
        console.log(`Remaining requests: ${rateLimitResult.remainingRequests}`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'X-RateLimit-Remaining': rateLimitResult.remainingRequests.toString(),
            },
            body: JSON.stringify({
                message: 'Request processed',
                remainingRequests: rateLimitResult.remainingRequests,
            }),
        };
    } catch (error) {
        console.error('Error checking rate limit:', error);

        // Fail open - allow request on error
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: 'Request processed (rate limiter bypassed due to error)',
            }),
        };
    }
};

/**
 * Example 4: Using RateLimiter class directly
 * For advanced use cases or non-API Gateway Lambda functions
 */
import { RateLimiter } from '../src/rate-limiter';

export const directUsageHandler = async (
    event: any,
    context: Context
): Promise<any> => {
    const rateLimiter = new RateLimiter({
        tableName: 'RateLimits',
        defaultLimit: 60,
        adminLimit: 300,
    });

    // Assuming you have user context from somewhere
    const userContext = {
        userId: event.userId,
        username: event.username,
        roles: event.roles || [],
        sessionId: event.sessionId,
    };

    const result = await rateLimiter.checkRateLimit(userContext);

    if (!result.allowed) {
        throw new Error(`Rate limit exceeded. Retry after ${result.retryAfter} seconds`);
    }

    // Process the request
    return {
        success: true,
        remainingRequests: result.remainingRequests,
    };
};
