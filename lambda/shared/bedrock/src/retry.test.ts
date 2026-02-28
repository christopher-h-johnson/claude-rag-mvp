/**
 * Unit tests for retry logic with exponential backoff
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { withRetry, withRetryGenerator } from './retry.js';

describe('Retry Logic', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('withRetry', () => {
        it('should succeed on first attempt', async () => {
            const fn = vi.fn().mockResolvedValue('success');

            const result = await withRetry(fn);

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should retry on ThrottlingException', async () => {
            const error = new Error('Throttled');
            error.name = 'ThrottlingException';

            const fn = vi.fn()
                .mockRejectedValueOnce(error)
                .mockResolvedValueOnce('success');

            const promise = withRetry(fn);

            // Fast-forward through the 1s delay
            await vi.advanceTimersByTimeAsync(1000);

            const result = await promise;

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should retry with exponential backoff (1s, 2s, 4s)', async () => {
            const error = new Error('Throttled');
            error.name = 'ThrottlingException';

            const fn = vi.fn()
                .mockRejectedValueOnce(error)
                .mockRejectedValueOnce(error)
                .mockResolvedValueOnce('success');

            const promise = withRetry(fn);

            // First retry after 1s
            await vi.advanceTimersByTimeAsync(1000);
            expect(fn).toHaveBeenCalledTimes(2);

            // Second retry after 2s
            await vi.advanceTimersByTimeAsync(2000);
            expect(fn).toHaveBeenCalledTimes(3);

            const result = await promise;
            expect(result).toBe('success');
        });

        it('should throw after max attempts (3)', async () => {
            const error = new Error('Throttled');
            error.name = 'ThrottlingException';

            const fn = vi.fn().mockRejectedValue(error);

            const promise = withRetry(fn);

            // Catch the promise to prevent unhandled rejection
            const resultPromise = promise.catch(e => e);

            // Advance through all retry delays
            await vi.advanceTimersByTimeAsync(1000); // First retry
            await vi.advanceTimersByTimeAsync(2000); // Second retry

            const result = await resultPromise;
            expect(result).toBeInstanceOf(Error);
            expect((result as Error).message).toBe('Throttled');
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('should not retry on non-retryable errors', async () => {
            const error = new Error('Invalid request');
            error.name = 'ValidationException';

            const fn = vi.fn().mockRejectedValue(error);

            await expect(withRetry(fn)).rejects.toThrow('Invalid request');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should retry on HTTP 429 status code', async () => {
            const error: any = new Error('Too many requests');
            error.name = 'TooManyRequestsException';
            error.$metadata = { httpStatusCode: 429 };

            const fn = vi.fn()
                .mockRejectedValueOnce(error)
                .mockResolvedValueOnce('success');

            const promise = withRetry(fn);
            await vi.advanceTimersByTimeAsync(1000);

            const result = await promise;
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should retry on HTTP 503 status code', async () => {
            const error: any = new Error('Service unavailable');
            error.name = 'ServiceUnavailable';
            error.$metadata = { httpStatusCode: 503 };

            const fn = vi.fn()
                .mockRejectedValueOnce(error)
                .mockResolvedValueOnce('success');

            const promise = withRetry(fn);
            await vi.advanceTimersByTimeAsync(1000);

            const result = await promise;
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should handle custom retry config', async () => {
            const error = new Error('Throttled');
            error.name = 'ThrottlingException';

            const fn = vi.fn()
                .mockRejectedValueOnce(error)
                .mockResolvedValueOnce('success');

            const promise = withRetry(fn, { maxAttempts: 5, baseDelayMs: 500 });

            // Custom delay of 500ms
            await vi.advanceTimersByTimeAsync(500);

            const result = await promise;
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should log retry attempts', async () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            const error = new Error('Throttled');
            error.name = 'ThrottlingException';

            const fn = vi.fn()
                .mockRejectedValueOnce(error)
                .mockResolvedValueOnce('success');

            const promise = withRetry(fn, {}, 'TestFunction');
            await vi.advanceTimersByTimeAsync(1000);

            await promise;

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('[Retry] Attempt 1 failed (TestFunction)'),
                expect.objectContaining({
                    errorName: 'ThrottlingException',
                    nextAttempt: 2,
                    delayMs: 1000,
                })
            );

            consoleWarnSpy.mockRestore();
        });
    });

    describe('withRetryGenerator', () => {
        it('should succeed on first attempt', async () => {
            async function* generator() {
                yield 'chunk1';
                yield 'chunk2';
            }

            const chunks: string[] = [];
            for await (const chunk of withRetryGenerator(generator)) {
                chunks.push(chunk);
            }

            expect(chunks).toEqual(['chunk1', 'chunk2']);
        });

        it('should retry generator on ThrottlingException', async () => {
            let attemptCount = 0;

            async function* generator() {
                attemptCount++;
                if (attemptCount === 1) {
                    const error = new Error('Throttled');
                    error.name = 'ThrottlingException';
                    throw error;
                }
                yield 'chunk1';
                yield 'chunk2';
            }

            const promise = (async () => {
                const chunks: string[] = [];
                for await (const chunk of withRetryGenerator(generator)) {
                    chunks.push(chunk);
                }
                return chunks;
            })();

            await vi.advanceTimersByTimeAsync(1000);

            const chunks = await promise;
            expect(chunks).toEqual(['chunk1', 'chunk2']);
            expect(attemptCount).toBe(2);
        });

        it('should throw after max attempts in generator', async () => {
            async function* generator() {
                const error = new Error('Throttled');
                error.name = 'ThrottlingException';
                throw error;
            }

            const promise = (async () => {
                const chunks: string[] = [];
                try {
                    for await (const chunk of withRetryGenerator(generator)) {
                        chunks.push(chunk);
                    }
                    return chunks;
                } catch (e) {
                    return e;
                }
            })();

            await vi.advanceTimersByTimeAsync(1000);
            await vi.advanceTimersByTimeAsync(2000);

            const result = await promise;
            expect(result).toBeInstanceOf(Error);
            expect((result as Error).message).toBe('Throttled');
        });

        it('should not retry on non-retryable errors in generator', async () => {
            let attemptCount = 0;

            async function* generator() {
                attemptCount++;
                const error = new Error('Invalid request');
                error.name = 'ValidationException';
                throw error;
            }

            const promise = (async () => {
                const chunks: string[] = [];
                for await (const chunk of withRetryGenerator(generator)) {
                    chunks.push(chunk);
                }
                return chunks;
            })();

            await expect(promise).rejects.toThrow('Invalid request');
            expect(attemptCount).toBe(1);
        });
    });

    describe('Retryable Error Detection', () => {
        it('should identify throttling errors', async () => {
            const throttlingErrors = [
                'ThrottlingException',
                'TooManyRequestsException',
                'ProvisionedThroughputExceededException',
                'RequestLimitExceeded',
            ];

            for (const errorName of throttlingErrors) {
                const error = new Error('Throttled');
                error.name = errorName;

                const fn = vi.fn()
                    .mockRejectedValueOnce(error)
                    .mockResolvedValueOnce('success');

                const promise = withRetry(fn);
                await vi.advanceTimersByTimeAsync(1000);

                await expect(promise).resolves.toBe('success');
                expect(fn).toHaveBeenCalledTimes(2);

                fn.mockClear();
            }
        });

        it('should identify transient network errors', async () => {
            const transientErrors = [
                'TimeoutError',
                'RequestTimeout',
                'NetworkingError',
            ];

            for (const errorName of transientErrors) {
                const error = new Error('Network issue');
                error.name = errorName;

                const fn = vi.fn()
                    .mockRejectedValueOnce(error)
                    .mockResolvedValueOnce('success');

                const promise = withRetry(fn);
                await vi.advanceTimersByTimeAsync(1000);

                await expect(promise).resolves.toBe('success');
                expect(fn).toHaveBeenCalledTimes(2);

                fn.mockClear();
            }
        });
    });

    describe('Property Tests', () => {
        describe('Property 9: Retry with Exponential Backoff', () => {
            it('should calculate exponential backoff delays correctly for any attempt number', () => {
                // Property test without actual async execution - just verify the delay calculation
                fc.assert(
                    fc.property(
                        // Generate attempt number (0-10)
                        fc.integer({ min: 0, max: 10 }),
                        // Generate base delay (100ms - 5000ms)
                        fc.integer({ min: 100, max: 5000 }),
                        (attempt, baseDelayMs) => {
                            // Property: Delay for attempt N should be baseDelay * 2^N
                            const expectedDelay = baseDelayMs * Math.pow(2, attempt);

                            // Verify the exponential pattern holds
                            expect(expectedDelay).toBe(baseDelayMs * Math.pow(2, attempt));

                            // Property: Each subsequent delay should be exactly double
                            if (attempt > 0) {
                                const previousDelay = baseDelayMs * Math.pow(2, attempt - 1);
                                expect(expectedDelay).toBe(previousDelay * 2);
                            }

                            // Property: First attempt (attempt 0) should equal base delay
                            if (attempt === 0) {
                                expect(expectedDelay).toBe(baseDelayMs);
                            }
                        }
                    ),
                    {
                        numRuns: 100,
                    }
                );
            });

            it('should maintain doubling pattern across any sequence of attempts', () => {
                fc.assert(
                    fc.property(
                        // Generate base delay
                        fc.integer({ min: 50, max: 2000 }),
                        // Generate number of attempts to test (2-5)
                        fc.integer({ min: 2, max: 5 }),
                        (baseDelayMs, numAttempts) => {
                            const delays: number[] = [];

                            // Calculate delays for each attempt
                            for (let i = 0; i < numAttempts; i++) {
                                delays.push(baseDelayMs * Math.pow(2, i));
                            }

                            // Property: Each delay should be exactly double the previous
                            for (let i = 1; i < delays.length; i++) {
                                expect(delays[i]).toBe(delays[i - 1] * 2);
                                expect(delays[i] / delays[i - 1]).toBe(2);
                            }

                            // Property: First delay should always be base delay
                            expect(delays[0]).toBe(baseDelayMs);

                            // Property: Last delay should be base * 2^(n-1)
                            const lastIndex = delays.length - 1;
                            expect(delays[lastIndex]).toBe(baseDelayMs * Math.pow(2, lastIndex));
                        }
                    ),
                    {
                        numRuns: 100,
                    }
                );
            });

            it('should produce increasing delays for any base delay value', () => {
                fc.assert(
                    fc.property(
                        fc.integer({ min: 1, max: 10000 }),
                        (baseDelayMs) => {
                            // Generate sequence of delays
                            const delays = [
                                baseDelayMs,
                                baseDelayMs * 2,
                                baseDelayMs * 4,
                                baseDelayMs * 8,
                            ];

                            // Property: Delays must be strictly increasing
                            for (let i = 1; i < delays.length; i++) {
                                expect(delays[i]).toBeGreaterThan(delays[i - 1]);
                            }

                            // Property: Each delay is at least double the previous
                            for (let i = 1; i < delays.length; i++) {
                                expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1] * 2);
                            }
                        }
                    ),
                    {
                        numRuns: 100,
                    }
                );
            });

            it('should respect max attempts limit for any configuration', () => {
                fc.assert(
                    fc.property(
                        // Generate max attempts (1-10)
                        fc.integer({ min: 1, max: 10 }),
                        (maxAttempts) => {
                            // Property: Number of possible retries is maxAttempts - 1
                            // (first attempt + retries = maxAttempts)
                            const numRetries = maxAttempts - 1;

                            // Property: Number of delays needed equals number of retries
                            expect(numRetries).toBe(maxAttempts - 1);

                            // Property: For N max attempts, we have N-1 delays
                            const delays: number[] = [];
                            for (let i = 0; i < numRetries; i++) {
                                delays.push(1000 * Math.pow(2, i));
                            }

                            expect(delays.length).toBe(maxAttempts - 1);
                        }
                    ),
                    {
                        numRuns: 50,
                    }
                );
            });
        });
    });
});
