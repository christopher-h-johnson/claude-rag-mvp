/**
 * Error Handler Utility
 * 
 * Provides centralized error handling and user-friendly error messages.
 */

export interface AppError {
    code: string;
    message: string;
    retryable: boolean;
    retryAfter?: number;
}

/**
 * Parse error from various sources into a standardized AppError
 */
export const parseError = (error: any): AppError => {
    // Already an AppError
    if (error.code && error.message && typeof error.retryable === 'boolean') {
        return error as AppError;
    }

    // Axios error with response
    if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        if (status === 401) {
            return {
                code: 'UNAUTHORIZED',
                message: 'Session expired. Please log in again.',
                retryable: false
            };
        }

        if (status === 429) {
            const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
            return {
                code: 'RATE_LIMIT_EXCEEDED',
                message: `Rate limit exceeded. Please wait ${retryAfter} seconds.`,
                retryable: true,
                retryAfter
            };
        }

        if (status >= 500) {
            return {
                code: 'SERVER_ERROR',
                message: data?.message || 'Server error. Please try again later.',
                retryable: true
            };
        }

        if (status >= 400) {
            return {
                code: data?.code || 'CLIENT_ERROR',
                message: data?.message || 'Request failed. Please try again.',
                retryable: false
            };
        }
    }

    // Network error
    if (error.code === 'ECONNABORTED' || error.message === 'Network Error') {
        return {
            code: 'NETWORK_ERROR',
            message: 'Network error. Please check your connection.',
            retryable: true
        };
    }

    // WebSocket error
    if (error.type === 'error' && error.data) {
        return {
            code: error.data.code || 'WEBSOCKET_ERROR',
            message: error.data.message || 'WebSocket error occurred.',
            retryable: error.data.retryable ?? true
        };
    }

    // Generic Error object
    if (error instanceof Error) {
        return {
            code: 'UNKNOWN_ERROR',
            message: error.message || 'An unexpected error occurred.',
            retryable: true
        };
    }

    // Unknown error type
    return {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred.',
        retryable: true
    };
};

/**
 * Get user-friendly error message based on error code
 */
export const getErrorMessage = (code: string, defaultMessage?: string): string => {
    const messages: Record<string, string> = {
        UNAUTHORIZED: 'Your session has expired. Please log in again.',
        RATE_LIMIT_EXCEEDED: 'You are sending requests too quickly. Please slow down.',
        SERVER_ERROR: 'The server encountered an error. Please try again later.',
        NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection.',
        WEBSOCKET_ERROR: 'Connection to chat server failed. Attempting to reconnect...',
        VALIDATION_ERROR: 'Please check your input and try again.',
        NOT_FOUND: 'The requested resource was not found.',
        FORBIDDEN: 'You do not have permission to perform this action.',
        TIMEOUT: 'The request timed out. Please try again.',
    };

    return messages[code] || defaultMessage || 'An error occurred. Please try again.';
};

/**
 * Check if error is retryable
 */
export const isRetryableError = (error: any): boolean => {
    const appError = parseError(error);
    return appError.retryable;
};

/**
 * Get retry delay for exponential backoff
 */
export const getRetryDelay = (attemptNumber: number, baseDelay: number = 1000): number => {
    return Math.min(baseDelay * Math.pow(2, attemptNumber), 30000); // Max 30 seconds
};
