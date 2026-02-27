import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { RateLimiter } from './rate-limiter';
import { RateLimiterConfig, UserContext } from './types';

/**
 * Lambda handler type
 */
export type LambdaHandler = (
    event: APIGatewayProxyEvent,
    context: Context
) => Promise<APIGatewayProxyResult>;

/**
 * Rate limiting middleware for Lambda functions
 * 
 * Usage:
 * ```typescript
 * import { withRateLimit } from 'rate-limiter';
 * 
 * export const handler = withRateLimit(async (event, context) => {
 *   // Your handler logic here
 *   return {
 *     statusCode: 200,
 *     body: JSON.stringify({ message: 'Success' })
 *   };
 * });
 * ```
 */
export function withRateLimit(
    handler: LambdaHandler,
    config?: Partial<RateLimiterConfig>
): LambdaHandler {
    const rateLimiter = new RateLimiter(config);

    return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
        try {
            // Extract user context from authorizer
            const userContext = extractUserContext(event);

            if (!userContext) {
                return {
                    statusCode: 401,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        error: 'Unauthorized',
                        message: 'Missing or invalid authentication',
                    }),
                };
            }

            // Check rate limit
            const rateLimitResult = await rateLimiter.checkRateLimit(userContext);

            if (!rateLimitResult.allowed) {
                // Rate limit exceeded - return HTTP 429
                return {
                    statusCode: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
                        'X-RateLimit-Limit': userContext.roles.includes('admin') ? '300' : '60',
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
                    },
                    body: JSON.stringify({
                        error: 'Too Many Requests',
                        message: 'Rate limit exceeded. Please try again later.',
                        retryAfter: rateLimitResult.retryAfter,
                        resetAt: rateLimitResult.resetAt,
                    }),
                };
            }

            // Add rate limit headers to the response
            const response = await handler(event, context);

            // Merge rate limit headers with existing headers
            const limit = userContext.roles.includes('admin') ? '300' : '60';
            return {
                ...response,
                headers: {
                    ...response.headers,
                    'X-RateLimit-Limit': limit,
                    'X-RateLimit-Remaining': rateLimitResult.remainingRequests.toString(),
                    'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
                },
            };
        } catch (error) {
            console.error('Rate limiter middleware error:', error);

            // On error, allow the request to proceed (fail open)
            // This prevents rate limiter issues from blocking all traffic
            return handler(event, context);
        }
    };
}

/**
 * Extract user context from API Gateway authorizer context
 */
function extractUserContext(event: APIGatewayProxyEvent): UserContext | null {
    const authContext = event.requestContext.authorizer;

    if (!authContext || !authContext.userId) {
        return null;
    }

    return {
        userId: authContext.userId,
        username: authContext.username || '',
        roles: authContext.roles ? JSON.parse(authContext.roles) : [],
        sessionId: authContext.sessionId || '',
    };
}

/**
 * Standalone rate limit check function for custom implementations
 */
export async function checkRateLimit(
    event: APIGatewayProxyEvent,
    config?: Partial<RateLimiterConfig>
) {
    const rateLimiter = new RateLimiter(config);
    const userContext = extractUserContext(event);

    if (!userContext) {
        throw new Error('Missing user context');
    }

    return rateLimiter.checkRateLimit(userContext);
}
