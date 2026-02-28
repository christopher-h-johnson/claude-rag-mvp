/**
 * Retry Utility with Exponential Backoff
 *
 * Implements retry logic for Bedrock API calls with exponential backoff.
 * Handles throttling errors specifically and logs retry attempts to CloudWatch.
 * Implements requirement 3.3 from the design specification.
 */
const DEFAULT_RETRY_CONFIG = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 4000,
};
/**
 * Check if an error is retryable (throttling or transient errors)
 */
function isRetryableError(error) {
    if (!error)
        return false;
    // Check for throttling exceptions
    const throttlingErrors = [
        'ThrottlingException',
        'TooManyRequestsException',
        'ProvisionedThroughputExceededException',
        'RequestLimitExceeded',
    ];
    if (throttlingErrors.includes(error.name)) {
        return true;
    }
    // Check for HTTP 429 or 503 status codes
    const statusCode = error.$metadata?.httpStatusCode;
    if (statusCode === 429 || statusCode === 503) {
        return true;
    }
    // Check for transient network errors
    const transientErrors = [
        'TimeoutError',
        'RequestTimeout',
        'NetworkingError',
    ];
    if (transientErrors.includes(error.name)) {
        return true;
    }
    return false;
}
/**
 * Calculate delay for exponential backoff
 * Returns delay in milliseconds: 1s, 2s, 4s for attempts 1, 2, 3
 */
function calculateDelay(attempt, config) {
    const delay = config.baseDelayMs * Math.pow(2, attempt - 1);
    return config.maxDelayMs ? Math.min(delay, config.maxDelayMs) : delay;
}
/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Retry decorator for async functions
 * Wraps a function with retry logic and exponential backoff
 */
export async function withRetry(fn, config = {}, context) {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError;
    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            // Check if error is retryable
            if (!isRetryableError(error)) {
                console.error(`[Retry] Non-retryable error encountered${context ? ` (${context})` : ''}:`, {
                    errorName: error.name,
                    errorMessage: error.message,
                    attempt,
                });
                throw error;
            }
            // If this was the last attempt, throw the error
            if (attempt === retryConfig.maxAttempts) {
                console.error(`[Retry] Max attempts reached${context ? ` (${context})` : ''}:`, {
                    errorName: error.name,
                    errorMessage: error.message,
                    attempts: attempt,
                });
                throw error;
            }
            // Calculate delay and log retry attempt
            const delayMs = calculateDelay(attempt, retryConfig);
            console.warn(`[Retry] Attempt ${attempt} failed${context ? ` (${context})` : ''}, retrying in ${delayMs}ms:`, {
                errorName: error.name,
                errorMessage: error.message,
                statusCode: error.$metadata?.httpStatusCode,
                nextAttempt: attempt + 1,
                delayMs,
            });
            // Wait before retrying
            await sleep(delayMs);
        }
    }
    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Retry failed with unknown error');
}
/**
 * Retry decorator for async generator functions (streaming)
 * Wraps an async generator with retry logic
 */
export async function* withRetryGenerator(fn, config = {}, context) {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError;
    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
        try {
            yield* fn();
            return; // Success, exit retry loop
        }
        catch (error) {
            lastError = error;
            // Check if error is retryable
            if (!isRetryableError(error)) {
                console.error(`[Retry] Non-retryable error in generator${context ? ` (${context})` : ''}:`, {
                    errorName: error.name,
                    errorMessage: error.message,
                    attempt,
                });
                throw error;
            }
            // If this was the last attempt, throw the error
            if (attempt === retryConfig.maxAttempts) {
                console.error(`[Retry] Max attempts reached in generator${context ? ` (${context})` : ''}:`, {
                    errorName: error.name,
                    errorMessage: error.message,
                    attempts: attempt,
                });
                throw error;
            }
            // Calculate delay and log retry attempt
            const delayMs = calculateDelay(attempt, retryConfig);
            console.warn(`[Retry] Generator attempt ${attempt} failed${context ? ` (${context})` : ''}, retrying in ${delayMs}ms:`, {
                errorName: error.name,
                errorMessage: error.message,
                statusCode: error.$metadata?.httpStatusCode,
                nextAttempt: attempt + 1,
                delayMs,
            });
            // Wait before retrying
            await sleep(delayMs);
        }
    }
    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Retry failed with unknown error');
}
