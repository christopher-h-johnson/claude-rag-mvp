import { CloudWatchLogsClient, PutLogEventsCommand, CreateLogStreamCommand, DescribeLogStreamsCommand, } from '@aws-sdk/client-cloudwatch-logs';
import { LOG_GROUPS, } from './types';
/**
 * Audit Logger for CloudWatch Logs
 *
 * Provides structured JSON logging for compliance and audit requirements.
 * Logs are stored in separate CloudWatch log groups by event type.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5
 */
export class AuditLogger {
    client;
    config;
    sequenceTokens = new Map();
    constructor(config = {}) {
        this.config = {
            region: config.region || process.env.AWS_REGION || 'us-east-1',
            logGroupPrefix: config.logGroupPrefix || '/aws/lambda/chatbot',
            consoleLogging: config.consoleLogging ?? true,
        };
        this.client = new CloudWatchLogsClient({ region: this.config.region });
    }
    /**
     * Log user action event
     * Validates: Requirements 11.1
     *
     * @param event User action event containing userId, action type, timestamp, and IP address
     */
    async logUserAction(event) {
        const logEntry = {
            eventType: event.eventType,
            userId: event.userId,
            sessionId: event.sessionId,
            timestamp: event.timestamp,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            metadata: event.metadata,
        };
        await this.writeLog(LOG_GROUPS.USER_ACTIONS, logEntry);
    }
    /**
     * Log API call event
     * Validates: Requirements 11.3
     *
     * @param event API call event with request and response metadata
     */
    async logAPICall(event) {
        const logEntry = {
            service: event.service,
            operation: event.operation,
            requestId: event.requestId,
            userId: event.userId,
            timestamp: event.timestamp,
            duration: event.duration,
            statusCode: event.statusCode,
            tokenCount: event.tokenCount,
        };
        await this.writeLog(LOG_GROUPS.API_CALLS, logEntry);
    }
    /**
     * Log document operation event
     * Validates: Requirements 11.2
     *
     * @param event Document operation event with file metadata and user identity
     */
    async logDocumentOperation(event) {
        const logEntry = {
            operation: event.operation,
            documentId: event.documentId,
            documentName: event.documentName,
            userId: event.userId,
            timestamp: event.timestamp,
            fileSize: event.fileSize,
            status: event.status,
            errorMessage: event.errorMessage,
        };
        await this.writeLog(LOG_GROUPS.DOCUMENT_OPERATIONS, logEntry);
    }
    /**
     * Write structured log entry to CloudWatch Logs
     * Validates: Requirements 11.4
     *
     * @param logGroupName CloudWatch log group name
     * @param logEntry Structured log entry object
     */
    async writeLog(logGroupName, logEntry) {
        // Console logging for local development and Lambda CloudWatch integration
        if (this.config.consoleLogging) {
            console.log(JSON.stringify(logEntry));
        }
        // In Lambda environment, console.log automatically goes to CloudWatch
        // This method provides additional functionality for custom log groups
        try {
            const logStreamName = this.generateLogStreamName();
            // Ensure log stream exists
            await this.ensureLogStream(logGroupName, logStreamName);
            // Get sequence token for the log stream
            const sequenceToken = this.sequenceTokens.get(`${logGroupName}/${logStreamName}`);
            // Put log event
            const command = new PutLogEventsCommand({
                logGroupName,
                logStreamName,
                logEvents: [
                    {
                        message: JSON.stringify(logEntry),
                        timestamp: logEntry.timestamp || Date.now(),
                    },
                ],
                sequenceToken,
            });
            const response = await this.client.send(command);
            // Update sequence token for next write
            if (response.nextSequenceToken) {
                this.sequenceTokens.set(`${logGroupName}/${logStreamName}`, response.nextSequenceToken);
            }
        }
        catch (error) {
            // Log error but don't throw - audit logging should not break application flow
            console.error('Failed to write audit log to CloudWatch:', error);
        }
    }
    /**
     * Ensure log stream exists in the log group
     *
     * @param logGroupName CloudWatch log group name
     * @param logStreamName CloudWatch log stream name
     */
    async ensureLogStream(logGroupName, logStreamName) {
        try {
            // Check if log stream exists
            const describeCommand = new DescribeLogStreamsCommand({
                logGroupName,
                logStreamNamePrefix: logStreamName,
            });
            const response = await this.client.send(describeCommand);
            if (response.logStreams && response.logStreams.length > 0) {
                // Log stream exists, get the upload sequence token
                const logStream = response.logStreams[0];
                if (logStream.uploadSequenceToken) {
                    this.sequenceTokens.set(`${logGroupName}/${logStreamName}`, logStream.uploadSequenceToken);
                }
                return;
            }
            // Create log stream if it doesn't exist
            const createCommand = new CreateLogStreamCommand({
                logGroupName,
                logStreamName,
            });
            await this.client.send(createCommand);
        }
        catch (error) {
            // Ignore ResourceAlreadyExistsException - stream was created by another invocation
            if (error.name !== 'ResourceAlreadyExistsException') {
                throw error;
            }
        }
    }
    /**
     * Generate log stream name based on date and Lambda request ID
     * Format: YYYY/MM/DD/[request-id]
     *
     * @returns Log stream name
     */
    generateLogStreamName() {
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const day = String(now.getUTCDate()).padStart(2, '0');
        const requestId = process.env.AWS_REQUEST_ID || 'local';
        return `${year}/${month}/${day}/${requestId}`;
    }
}
/**
 * Singleton instance for convenience
 */
let defaultLogger = null;
/**
 * Get or create default audit logger instance
 *
 * @param config Optional configuration for the logger
 * @returns AuditLogger instance
 */
export function getAuditLogger(config) {
    if (!defaultLogger) {
        defaultLogger = new AuditLogger(config);
    }
    return defaultLogger;
}
/**
 * Convenience function to log user action
 * Validates: Requirements 11.1
 */
export async function logUserAction(event) {
    const logger = getAuditLogger();
    await logger.logUserAction(event);
}
/**
 * Convenience function to log API call
 * Validates: Requirements 11.3
 */
export async function logAPICall(event) {
    const logger = getAuditLogger();
    await logger.logAPICall(event);
}
/**
 * Convenience function to log document operation
 * Validates: Requirements 11.2
 */
export async function logDocumentOperation(event) {
    const logger = getAuditLogger();
    await logger.logDocumentOperation(event);
}
