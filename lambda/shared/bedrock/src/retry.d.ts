/**
 * Retry Utility with Exponential Backoff
 *
 * Implements retry logic for Bedrock API calls with exponential backoff.
 * Handles throttling errors specifically and logs retry attempts to CloudWatch.
 * Implements requirement 3.3 from the design specification.
 */
export interface RetryConfig {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs?: number;
}
export interface RetryableError extends Error {
    name: string;
    $metadata?: {
        httpStatusCode?: number;
    };
}
/**
 * Retry decorator for async functions
 * Wraps a function with retry logic and exponential backoff
 */
export declare function withRetry<T>(fn: () => Promise<T>, config?: Partial<RetryConfig>, context?: string): Promise<T>;
/**
 * Retry decorator for async generator functions (streaming)
 * Wraps an async generator with retry logic
 */
export declare function withRetryGenerator<T>(fn: () => AsyncGenerator<T>, config?: Partial<RetryConfig>, context?: string): AsyncGenerator<T>;
