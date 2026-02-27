/**
 * User action event types for audit logging
 */
export type UserActionType = 'login' | 'logout' | 'query' | 'upload' | 'delete';

/**
 * Service types for API call logging
 */
export type ServiceType = 'bedrock' | 'opensearch' | 's3';

/**
 * Document operation types
 */
export type DocumentOperationType = 'upload' | 'delete' | 'process';

/**
 * Operation status
 */
export type OperationStatus = 'success' | 'failed';

/**
 * User action event for audit logging
 * Validates: Requirements 11.1
 */
export interface UserActionEvent {
    eventType: UserActionType;
    userId: string;
    sessionId: string;
    timestamp: number;
    ipAddress: string;
    userAgent: string;
    metadata?: Record<string, any>;
}

/**
 * API call event for audit logging
 * Validates: Requirements 11.3
 */
export interface APICallEvent {
    service: ServiceType;
    operation: string;
    requestId: string;
    userId: string;
    timestamp: number;
    duration: number;
    statusCode: number;
    tokenCount?: number;
}

/**
 * Document operation event for audit logging
 * Validates: Requirements 11.2
 */
export interface DocumentOperationEvent {
    operation: DocumentOperationType;
    documentId: string;
    documentName: string;
    userId: string;
    timestamp: number;
    fileSize?: number;
    status: OperationStatus;
    errorMessage?: string;
}

/**
 * Configuration for audit logger
 */
export interface AuditLoggerConfig {
    /**
     * AWS region for CloudWatch Logs
     */
    region?: string;

    /**
     * Log group prefix (default: '/aws/lambda/chatbot')
     */
    logGroupPrefix?: string;

    /**
     * Whether to also log to console (default: true)
     */
    consoleLogging?: boolean;
}

/**
 * Log group names for different event types
 */
export const LOG_GROUPS = {
    USER_ACTIONS: '/aws/lambda/chatbot/audit/user-actions',
    API_CALLS: '/aws/lambda/chatbot/audit/api-calls',
    DOCUMENT_OPERATIONS: '/aws/lambda/chatbot/audit/document-operations',
} as const;
