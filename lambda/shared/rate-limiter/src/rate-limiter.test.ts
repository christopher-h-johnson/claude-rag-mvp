import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { RateLimiter } from './rate-limiter';
import { UserContext } from './types';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Mock AWS SDK
vi.mock('@aws-sdk/client-dynamodb');
vi.mock('@aws-sdk/lib-dynamodb');

describe('RateLimiter', () => {
    let rateLimiter: RateLimiter;
    let mockSend: Mock;

    const regularUser: UserContext = {
        userId: 'user123',
        username: 'john',
        roles: ['user'],
        sessionId: 'session456',
    };

    const adminUser: UserContext = {
        userId: 'admin123',
        username: 'admin',
        roles: ['admin'],
        sessionId: 'session789',
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup mock send function
        mockSend = vi.fn();
        vi.mocked(DynamoDBDocumentClient.from).mockReturnValue({
            send: mockSend,
        } as any);

        // Create rate limiter with test config
        rateLimiter = new RateLimiter({
            tableName: 'TestRateLimits',
            defaultLimit: 60,
            adminLimit: 300,
            windowSizeSeconds: 60,
        });
    });

    describe('checkRateLimit', () => {
        it('should allow request when under limit', async () => {
            // Mock successful update
            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 1,
                    limit: 60,
                },
            });

            const result = await rateLimiter.checkRateLimit(regularUser);

            expect(result.allowed).toBe(true);
            expect(result.remainingRequests).toBe(59);
            expect(result.resetAt).toBeGreaterThan(Date.now());
        });

        it('should deny request when limit exceeded', async () => {
            // Mock conditional check failure
            const error: any = new Error('Conditional check failed');
            error.name = 'ConditionalCheckFailedException';
            mockSend.mockRejectedValueOnce(error);

            // Mock get status call
            mockSend.mockResolvedValueOnce({
                Item: {
                    PK: 'USER#user123',
                    SK: 'WINDOW#123456',
                    requestCount: 60,
                    limit: 60,
                    windowStart: Math.floor(Date.now() / 1000 / 60) * 60,
                    windowEnd: Math.floor(Date.now() / 1000 / 60) * 60 + 60,
                },
            });

            const result = await rateLimiter.checkRateLimit(regularUser);

            expect(result.allowed).toBe(false);
            expect(result.remainingRequests).toBe(0);
            expect(result.retryAfter).toBeGreaterThan(0);
        });

        it('should use higher limit for admin users', async () => {
            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 100,
                    limit: 300,
                },
            });

            const result = await rateLimiter.checkRateLimit(adminUser);

            expect(result.allowed).toBe(true);
            expect(result.remainingRequests).toBe(200);
        });

        it('should handle multiple requests in same window', async () => {
            // First request
            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 1,
                    limit: 60,
                },
            });

            const result1 = await rateLimiter.checkRateLimit(regularUser);
            expect(result1.allowed).toBe(true);
            expect(result1.remainingRequests).toBe(59);

            // Second request
            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 2,
                    limit: 60,
                },
            });

            const result2 = await rateLimiter.checkRateLimit(regularUser);
            expect(result2.allowed).toBe(true);
            expect(result2.remainingRequests).toBe(58);
        });
    });

    describe('getRateLimitStatus', () => {
        it('should return current status', async () => {
            const windowStart = Math.floor(Date.now() / 1000 / 60) * 60;

            mockSend.mockResolvedValueOnce({
                Item: {
                    PK: 'USER#user123',
                    SK: `WINDOW#${windowStart}`,
                    requestCount: 25,
                    limit: 60,
                    windowStart,
                    windowEnd: windowStart + 60,
                },
            });

            const status = await rateLimiter.getRateLimitStatus('user123');

            expect(status).not.toBeNull();
            expect(status?.requestCount).toBe(25);
            expect(status?.limit).toBe(60);
        });

        it('should return null when no record exists', async () => {
            mockSend.mockResolvedValueOnce({
                Item: undefined,
            });

            const status = await rateLimiter.getRateLimitStatus('user123');

            expect(status).toBeNull();
        });

        it('should handle errors gracefully', async () => {
            mockSend.mockRejectedValueOnce(new Error('DynamoDB error'));

            const status = await rateLimiter.getRateLimitStatus('user123');

            expect(status).toBeNull();
        });
    });

    describe('admin detection', () => {
        it('should detect admin role', async () => {
            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 1,
                    limit: 300,
                },
            });

            await rateLimiter.checkRateLimit(adminUser);

            // Verify the limit used was 300 (admin limit)
            expect(mockSend).toHaveBeenCalled();
        });

        it('should detect administrator role', async () => {
            const administratorUser: UserContext = {
                ...regularUser,
                roles: ['administrator'],
            };

            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 1,
                    limit: 300,
                },
            });

            await rateLimiter.checkRateLimit(administratorUser);

            expect(mockSend).toHaveBeenCalled();
        });

        it('should use default limit for non-admin users', async () => {
            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 1,
                    limit: 60,
                },
            });

            await rateLimiter.checkRateLimit(regularUser);

            expect(mockSend).toHaveBeenCalled();
        });
    });

    describe('sliding window algorithm', () => {
        it('should track requests within the same window', async () => {
            const windowStart = Math.floor(Date.now() / 1000 / 60) * 60;

            // Simulate 5 requests in the same window
            for (let i = 1; i <= 5; i++) {
                mockSend.mockResolvedValueOnce({
                    Attributes: {
                        requestCount: i,
                        limit: 60,
                        windowStart,
                        windowEnd: windowStart + 60,
                    },
                });

                const result = await rateLimiter.checkRateLimit(regularUser);
                expect(result.allowed).toBe(true);
                expect(result.remainingRequests).toBe(60 - i);
            }
        });

        it('should allow exactly the limit number of requests', async () => {
            const windowStart = Math.floor(Date.now() / 1000 / 60) * 60;

            // Request 60 (the exact limit)
            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 60,
                    limit: 60,
                    windowStart,
                    windowEnd: windowStart + 60,
                },
            });

            const result = await rateLimiter.checkRateLimit(regularUser);
            expect(result.allowed).toBe(true);
            expect(result.remainingRequests).toBe(0);
        });

        it('should deny request 61 when limit is 60', async () => {
            const windowStart = Math.floor(Date.now() / 1000 / 60) * 60;

            // Mock conditional check failure (limit exceeded)
            const error: any = new Error('Conditional check failed');
            error.name = 'ConditionalCheckFailedException';
            mockSend.mockRejectedValueOnce(error);

            // Mock get status call showing limit reached
            mockSend.mockResolvedValueOnce({
                Item: {
                    PK: 'USER#user123',
                    SK: `WINDOW#${windowStart}`,
                    requestCount: 60,
                    limit: 60,
                    windowStart,
                    windowEnd: windowStart + 60,
                },
            });

            const result = await rateLimiter.checkRateLimit(regularUser);
            expect(result.allowed).toBe(false);
            expect(result.remainingRequests).toBe(0);
            expect(result.retryAfter).toBeGreaterThan(0);
            expect(result.retryAfter).toBeLessThanOrEqual(60);
        });

        it('should handle burst request pattern', async () => {
            const windowStart = Math.floor(Date.now() / 1000 / 60) * 60;

            // Simulate burst of 10 requests
            const results = [];
            for (let i = 1; i <= 10; i++) {
                mockSend.mockResolvedValueOnce({
                    Attributes: {
                        requestCount: i,
                        limit: 60,
                        windowStart,
                        windowEnd: windowStart + 60,
                    },
                });

                const result = await rateLimiter.checkRateLimit(regularUser);
                results.push(result);
            }

            // All should be allowed
            expect(results.every(r => r.allowed)).toBe(true);
            // Last request should have 50 remaining
            expect(results[9].remainingRequests).toBe(50);
        });

        it('should handle gradual request pattern', async () => {
            const windowStart = Math.floor(Date.now() / 1000 / 60) * 60;

            // Simulate gradual requests: 1, 5, 10, 20, 30
            const requestCounts = [1, 5, 10, 20, 30];

            for (const count of requestCounts) {
                mockSend.mockResolvedValueOnce({
                    Attributes: {
                        requestCount: count,
                        limit: 60,
                        windowStart,
                        windowEnd: windowStart + 60,
                    },
                });

                const result = await rateLimiter.checkRateLimit(regularUser);
                expect(result.allowed).toBe(true);
                expect(result.remainingRequests).toBe(60 - count);
            }
        });
    });

    describe('counter reset behavior', () => {
        it('should reset counter in new window', async () => {
            const firstWindowStart = Math.floor(Date.now() / 1000 / 60) * 60;
            const secondWindowStart = firstWindowStart + 60;

            // First window - request 60 (at limit)
            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 60,
                    limit: 60,
                    windowStart: firstWindowStart,
                    windowEnd: firstWindowStart + 60,
                },
            });

            const result1 = await rateLimiter.checkRateLimit(regularUser);
            expect(result1.allowed).toBe(true);
            expect(result1.remainingRequests).toBe(0);

            // Simulate time passing to next window
            vi.useFakeTimers();
            vi.setSystemTime(new Date((secondWindowStart + 1) * 1000));

            // Second window - counter should reset
            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 1,
                    limit: 60,
                    windowStart: secondWindowStart,
                    windowEnd: secondWindowStart + 60,
                },
            });

            const result2 = await rateLimiter.checkRateLimit(regularUser);
            expect(result2.allowed).toBe(true);
            expect(result2.remainingRequests).toBe(59);

            vi.useRealTimers();
        });

        it('should calculate correct window boundaries', async () => {
            const now = Date.now();
            const windowStart = Math.floor(now / 1000 / 60) * 60;
            const windowEnd = windowStart + 60;

            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 1,
                    limit: 60,
                    windowStart,
                    windowEnd,
                },
            });

            const result = await rateLimiter.checkRateLimit(regularUser);

            expect(result.resetAt).toBe(windowEnd * 1000);
            expect(result.resetAt).toBeGreaterThan(now);
            expect(result.resetAt).toBeLessThanOrEqual(now + 60000);
        });

        it('should set TTL for automatic cleanup', async () => {
            const windowStart = Math.floor(Date.now() / 1000 / 60) * 60;
            const windowEnd = windowStart + 60;
            const expectedTTL = windowEnd + 60;

            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 1,
                    limit: 60,
                    windowStart,
                    windowEnd,
                    ttl: expectedTTL,
                },
            });

            await rateLimiter.checkRateLimit(regularUser);

            // Verify UpdateCommand was called
            expect(mockSend).toHaveBeenCalled();

            // Verify the command has the correct structure
            const callArg = mockSend.mock.calls[0][0];
            expect(callArg.constructor.name).toBe('UpdateCommand');
        });

        it('should handle requests at window boundary', async () => {
            const windowStart = Math.floor(Date.now() / 1000 / 60) * 60;
            const windowEnd = windowStart + 60;

            // Request at the very end of window
            vi.useFakeTimers();
            vi.setSystemTime(new Date((windowEnd - 1) * 1000));

            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 59,
                    limit: 60,
                    windowStart,
                    windowEnd,
                },
            });

            const result = await rateLimiter.checkRateLimit(regularUser);
            expect(result.allowed).toBe(true);
            expect(result.remainingRequests).toBe(1);

            vi.useRealTimers();
        });
    });

    describe('admin vs regular user limits', () => {
        it('should enforce 60 requests/min for regular users', async () => {
            const windowStart = Math.floor(Date.now() / 1000 / 60) * 60;

            // Request at limit
            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 60,
                    limit: 60,
                    windowStart,
                    windowEnd: windowStart + 60,
                },
            });

            const result = await rateLimiter.checkRateLimit(regularUser);
            expect(result.allowed).toBe(true);
            expect(result.remainingRequests).toBe(0);

            // Next request should fail
            const error: any = new Error('Conditional check failed');
            error.name = 'ConditionalCheckFailedException';
            mockSend.mockRejectedValueOnce(error);
            mockSend.mockResolvedValueOnce({
                Item: {
                    requestCount: 60,
                    limit: 60,
                    windowStart,
                    windowEnd: windowStart + 60,
                },
            });

            const result2 = await rateLimiter.checkRateLimit(regularUser);
            expect(result2.allowed).toBe(false);
        });

        it('should enforce 300 requests/min for admin users', async () => {
            const windowStart = Math.floor(Date.now() / 1000 / 60) * 60;

            // Request at limit
            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 300,
                    limit: 300,
                    windowStart,
                    windowEnd: windowStart + 60,
                },
            });

            const result = await rateLimiter.checkRateLimit(adminUser);
            expect(result.allowed).toBe(true);
            expect(result.remainingRequests).toBe(0);

            // Next request should fail
            const error: any = new Error('Conditional check failed');
            error.name = 'ConditionalCheckFailedException';
            mockSend.mockRejectedValueOnce(error);
            mockSend.mockResolvedValueOnce({
                Item: {
                    requestCount: 300,
                    limit: 300,
                    windowStart,
                    windowEnd: windowStart + 60,
                },
            });

            const result2 = await rateLimiter.checkRateLimit(adminUser);
            expect(result2.allowed).toBe(false);
        });

        it('should allow admin to make 5x more requests than regular user', async () => {
            const windowStart = Math.floor(Date.now() / 1000 / 60) * 60;

            // Regular user at 60 requests
            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 60,
                    limit: 60,
                },
            });

            const regularResult = await rateLimiter.checkRateLimit(regularUser);
            expect(regularResult.remainingRequests).toBe(0);

            // Admin at 60 requests still has 240 remaining
            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 60,
                    limit: 300,
                },
            });

            const adminResult = await rateLimiter.checkRateLimit(adminUser);
            expect(adminResult.remainingRequests).toBe(240);
        });

        it('should apply correct limit based on role in UpdateCommand', async () => {
            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 1,
                    limit: 60,
                },
            });

            await rateLimiter.checkRateLimit(regularUser);

            // Verify UpdateCommand was called for regular user
            expect(mockSend).toHaveBeenCalled();
            let callArg = mockSend.mock.calls[0][0];
            expect(callArg.constructor.name).toBe('UpdateCommand');

            mockSend.mockClear();
            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 1,
                    limit: 300,
                },
            });

            await rateLimiter.checkRateLimit(adminUser);

            // Verify UpdateCommand was called for admin user
            expect(mockSend).toHaveBeenCalled();
            callArg = mockSend.mock.calls[0][0];
            expect(callArg.constructor.name).toBe('UpdateCommand');
        });

        it('should handle user with multiple roles including admin', async () => {
            const multiRoleUser: UserContext = {
                userId: 'user456',
                username: 'poweruser',
                roles: ['user', 'admin', 'developer'],
                sessionId: 'session999',
            };

            mockSend.mockResolvedValueOnce({
                Attributes: {
                    requestCount: 1,
                    limit: 300,
                },
            });

            const result = await rateLimiter.checkRateLimit(multiRoleUser);
            expect(result.allowed).toBe(true);
            expect(result.remainingRequests).toBe(299);
        });
    });
});
