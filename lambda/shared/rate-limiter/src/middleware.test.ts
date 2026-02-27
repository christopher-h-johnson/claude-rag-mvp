import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { withRateLimit, checkRateLimit } from './middleware';
import { RateLimiter } from './rate-limiter';

// Mock the RateLimiter class
vi.mock('./rate-limiter');

describe('Rate Limiter Middleware', () => {
    let mockEvent: APIGatewayProxyEvent;
    let mockContext: Context;
    let mockHandler: Mock;
    let mockCheckRateLimit: Mock;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup mock event with authorizer context
        mockEvent = {
            requestContext: {
                authorizer: {
                    userId: 'user123',
                    username: 'john',
                    roles: JSON.stringify(['user']),
                    sessionId: 'session456',
                },
            },
        } as any;

        mockContext = {} as Context;

        // Setup mock handler
        mockHandler = vi.fn(async () => ({
            statusCode: 200,
            body: JSON.stringify({ message: 'Success' }),
        }));

        // Setup mock rate limiter
        mockCheckRateLimit = vi.fn();
        vi.mocked(RateLimiter).mockImplementation(() => ({
            checkRateLimit: mockCheckRateLimit,
            getRateLimitStatus: vi.fn(),
        } as any));
    });

    describe('withRateLimit', () => {
        it('should allow request when under rate limit', async () => {
            mockCheckRateLimit.mockResolvedValueOnce({
                allowed: true,
                remainingRequests: 59,
                resetAt: Date.now() + 60000,
            });

            const wrappedHandler = withRateLimit(mockHandler);
            const result = await wrappedHandler(mockEvent, mockContext);

            expect(result.statusCode).toBe(200);
            expect(mockHandler).toHaveBeenCalledWith(mockEvent, mockContext);
        });

        it('should return 429 when rate limit exceeded', async () => {
            mockCheckRateLimit.mockResolvedValueOnce({
                allowed: false,
                remainingRequests: 0,
                resetAt: Date.now() + 30000,
                retryAfter: 30,
            });

            const wrappedHandler = withRateLimit(mockHandler);
            const result = await wrappedHandler(mockEvent, mockContext);

            expect(result.statusCode).toBe(429);
            expect(mockHandler).not.toHaveBeenCalled();

            const body = JSON.parse(result.body);
            expect(body.error).toBe('Too Many Requests');
        });

        it('should return 401 when no user context', async () => {
            mockEvent.requestContext.authorizer = undefined as any;

            const wrappedHandler = withRateLimit(mockHandler);
            const result = await wrappedHandler(mockEvent, mockContext);

            expect(result.statusCode).toBe(401);
            expect(mockHandler).not.toHaveBeenCalled();
        });

        it('should fail open on rate limiter errors', async () => {
            mockCheckRateLimit.mockRejectedValueOnce(
                new Error('DynamoDB error')
            );

            const wrappedHandler = withRateLimit(mockHandler);
            const result = await wrappedHandler(mockEvent, mockContext);

            // Should still call the handler (fail open)
            expect(result.statusCode).toBe(200);
            expect(mockHandler).toHaveBeenCalled();
        });
    });

    describe('checkRateLimit', () => {
        it('should check rate limit for event', async () => {
            mockCheckRateLimit.mockResolvedValueOnce({
                allowed: true,
                remainingRequests: 59,
                resetAt: Date.now() + 60000,
            });

            const result = await checkRateLimit(mockEvent);

            expect(result.allowed).toBe(true);
            expect(result.remainingRequests).toBe(59);
        });

        it('should throw error when no user context', async () => {
            mockEvent.requestContext.authorizer = undefined as any;

            await expect(checkRateLimit(mockEvent)).rejects.toThrow(
                'Missing user context'
            );
        });
    });
});
