import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuditLogger, getAuditLogger, logUserAction, logAPICall, logDocumentOperation } from './audit-logger';
import { UserActionEvent, APICallEvent, DocumentOperationEvent, LOG_GROUPS } from './types';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';

// Mock AWS SDK
vi.mock('@aws-sdk/client-cloudwatch-logs', () => {
    const mockSend = vi.fn();
    return {
        CloudWatchLogsClient: vi.fn(() => ({
            send: mockSend,
        })),
        PutLogEventsCommand: vi.fn((input) => ({ constructor: { name: 'PutLogEventsCommand' }, input })),
        DescribeLogStreamsCommand: vi.fn((input) => ({ constructor: { name: 'DescribeLogStreamsCommand' }, input })),
        CreateLogStreamCommand: vi.fn((input) => ({ constructor: { name: 'CreateLogStreamCommand' }, input })),
    };
});

describe('AuditLogger', () => {
    let logger: AuditLogger;
    let mockSend: any;
    let consoleLogSpy: any;
    let consoleErrorSpy: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Get the mock send function
        const client = new CloudWatchLogsClient({});
        mockSend = client.send as any;

        // Mock console methods
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        // Create logger instance
        logger = new AuditLogger({ consoleLogging: true });
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    describe('JSON Structure Validation', () => {
        it('should log user action with valid JSON structure', async () => {
            const event: UserActionEvent = {
                eventType: 'login',
                userId: 'user-123',
                sessionId: 'session-456',
                timestamp: Date.now(),
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
                metadata: { source: 'web' },
            };

            await logger.logUserAction(event);

            // Verify console.log was called with valid JSON
            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
            const loggedData = consoleLogSpy.mock.calls[0][0];

            // Should be valid JSON string
            expect(() => JSON.parse(loggedData)).not.toThrow();

            // Parse and verify structure
            const parsed = JSON.parse(loggedData);
            expect(parsed).toHaveProperty('eventType', 'login');
            expect(parsed).toHaveProperty('userId', 'user-123');
            expect(parsed).toHaveProperty('sessionId', 'session-456');
            expect(parsed).toHaveProperty('timestamp');
            expect(parsed).toHaveProperty('ipAddress', '192.168.1.1');
            expect(parsed).toHaveProperty('userAgent', 'Mozilla/5.0');
            expect(parsed).toHaveProperty('metadata');
        });

        it('should log API call with valid JSON structure', async () => {
            const event: APICallEvent = {
                service: 'bedrock',
                operation: 'InvokeModel',
                requestId: 'req-789',
                userId: 'user-123',
                timestamp: Date.now(),
                duration: 1500,
                statusCode: 200,
                tokenCount: 150,
            };

            await logger.logAPICall(event);

            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
            const loggedData = consoleLogSpy.mock.calls[0][0];

            expect(() => JSON.parse(loggedData)).not.toThrow();

            const parsed = JSON.parse(loggedData);
            expect(parsed).toHaveProperty('service', 'bedrock');
            expect(parsed).toHaveProperty('operation', 'InvokeModel');
            expect(parsed).toHaveProperty('requestId', 'req-789');
            expect(parsed).toHaveProperty('userId', 'user-123');
            expect(parsed).toHaveProperty('timestamp');
            expect(parsed).toHaveProperty('duration', 1500);
            expect(parsed).toHaveProperty('statusCode', 200);
            expect(parsed).toHaveProperty('tokenCount', 150);
        });

        it('should log document operation with valid JSON structure', async () => {
            const event: DocumentOperationEvent = {
                operation: 'upload',
                documentId: 'doc-001',
                documentName: 'test.pdf',
                userId: 'user-123',
                timestamp: Date.now(),
                fileSize: 1024000,
                status: 'success',
            };

            await logger.logDocumentOperation(event);

            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
            const loggedData = consoleLogSpy.mock.calls[0][0];

            expect(() => JSON.parse(loggedData)).not.toThrow();

            const parsed = JSON.parse(loggedData);
            expect(parsed).toHaveProperty('operation', 'upload');
            expect(parsed).toHaveProperty('documentId', 'doc-001');
            expect(parsed).toHaveProperty('documentName', 'test.pdf');
            expect(parsed).toHaveProperty('userId', 'user-123');
            expect(parsed).toHaveProperty('timestamp');
            expect(parsed).toHaveProperty('fileSize', 1024000);
            expect(parsed).toHaveProperty('status', 'success');
        });

        it('should handle optional fields correctly in JSON structure', async () => {
            const event: DocumentOperationEvent = {
                operation: 'delete',
                documentId: 'doc-002',
                documentName: 'old.pdf',
                userId: 'user-456',
                timestamp: Date.now(),
                status: 'failed',
                errorMessage: 'File not found',
            };

            await logger.logDocumentOperation(event);

            const loggedData = consoleLogSpy.mock.calls[0][0];
            const parsed = JSON.parse(loggedData);

            expect(parsed).toHaveProperty('errorMessage', 'File not found');
            expect(parsed.fileSize).toBeUndefined();
        });

        it('should handle metadata object in JSON structure', async () => {
            const event: UserActionEvent = {
                eventType: 'query',
                userId: 'user-789',
                sessionId: 'session-999',
                timestamp: Date.now(),
                ipAddress: '10.0.0.1',
                userAgent: 'Chrome/90.0',
                metadata: {
                    queryText: 'What is RAG?',
                    responseTime: 1200,
                    cached: false,
                },
            };

            await logger.logUserAction(event);

            const loggedData = consoleLogSpy.mock.calls[0][0];
            const parsed = JSON.parse(loggedData);

            expect(parsed.metadata).toEqual({
                queryText: 'What is RAG?',
                responseTime: 1200,
                cached: false,
            });
        });
    });

    describe('Log Group Routing', () => {
        let capturedCommands: any[] = [];

        beforeEach(() => {
            capturedCommands = [];

            // Mock successful CloudWatch responses and capture commands
            mockSend.mockImplementation((command: any) => {
                capturedCommands.push(command);

                if (command.constructor.name === 'DescribeLogStreamsCommand') {
                    return Promise.resolve({ logStreams: [] });
                }
                if (command.constructor.name === 'CreateLogStreamCommand') {
                    return Promise.resolve({});
                }
                if (command.constructor.name === 'PutLogEventsCommand') {
                    return Promise.resolve({ nextSequenceToken: 'token-123' });
                }
                return Promise.resolve({});
            });
        });

        it('should route user action events to USER_ACTIONS log group', async () => {
            const event: UserActionEvent = {
                eventType: 'login',
                userId: 'user-123',
                sessionId: 'session-456',
                timestamp: Date.now(),
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
            };

            await logger.logUserAction(event);

            // Find the PutLogEventsCommand
            const putLogCommand = capturedCommands.find(
                (cmd: any) => cmd.constructor.name === 'PutLogEventsCommand'
            );

            expect(putLogCommand).toBeDefined();
            expect(putLogCommand.input.logGroupName).toBe(LOG_GROUPS.USER_ACTIONS);
        });

        it('should route API call events to API_CALLS log group', async () => {
            const event: APICallEvent = {
                service: 'opensearch',
                operation: 'search',
                requestId: 'req-123',
                userId: 'user-456',
                timestamp: Date.now(),
                duration: 200,
                statusCode: 200,
            };

            await logger.logAPICall(event);

            const putLogCommand = capturedCommands.find(
                (cmd: any) => cmd.constructor.name === 'PutLogEventsCommand'
            );

            expect(putLogCommand).toBeDefined();
            expect(putLogCommand.input.logGroupName).toBe(LOG_GROUPS.API_CALLS);
        });

        it('should route document operation events to DOCUMENT_OPERATIONS log group', async () => {
            const event: DocumentOperationEvent = {
                operation: 'process',
                documentId: 'doc-789',
                documentName: 'report.pdf',
                userId: 'user-789',
                timestamp: Date.now(),
                status: 'success',
            };

            await logger.logDocumentOperation(event);

            const putLogCommand = capturedCommands.find(
                (cmd: any) => cmd.constructor.name === 'PutLogEventsCommand'
            );

            expect(putLogCommand).toBeDefined();
            expect(putLogCommand.input.logGroupName).toBe(LOG_GROUPS.DOCUMENT_OPERATIONS);
        });

        it('should route different event types to different log groups', async () => {
            const userEvent: UserActionEvent = {
                eventType: 'logout',
                userId: 'user-1',
                sessionId: 'session-1',
                timestamp: Date.now(),
                ipAddress: '1.1.1.1',
                userAgent: 'Safari',
            };

            const apiEvent: APICallEvent = {
                service: 's3',
                operation: 'PutObject',
                requestId: 'req-1',
                userId: 'user-1',
                timestamp: Date.now(),
                duration: 500,
                statusCode: 200,
            };

            await logger.logUserAction(userEvent);

            const firstPutLog = capturedCommands.find(
                (cmd: any) => cmd.constructor.name === 'PutLogEventsCommand'
            );
            expect(firstPutLog.input.logGroupName).toBe(LOG_GROUPS.USER_ACTIONS);

            capturedCommands = []; // Reset for second call
            await logger.logAPICall(apiEvent);

            const secondPutLog = capturedCommands.find(
                (cmd: any) => cmd.constructor.name === 'PutLogEventsCommand'
            );
            expect(secondPutLog.input.logGroupName).toBe(LOG_GROUPS.API_CALLS);
        });
    });

    describe('Required Field Presence', () => {
        it('should include all required fields for user action events', async () => {
            const event: UserActionEvent = {
                eventType: 'upload',
                userId: 'user-required',
                sessionId: 'session-required',
                timestamp: 1234567890,
                ipAddress: '127.0.0.1',
                userAgent: 'TestAgent/1.0',
            };

            await logger.logUserAction(event);

            const loggedData = consoleLogSpy.mock.calls[0][0];
            const parsed = JSON.parse(loggedData);

            // Verify all required fields are present
            expect(parsed.eventType).toBeDefined();
            expect(parsed.userId).toBeDefined();
            expect(parsed.sessionId).toBeDefined();
            expect(parsed.timestamp).toBeDefined();
            expect(parsed.ipAddress).toBeDefined();
            expect(parsed.userAgent).toBeDefined();

            // Verify field values
            expect(parsed.eventType).toBe('upload');
            expect(parsed.userId).toBe('user-required');
            expect(parsed.sessionId).toBe('session-required');
            expect(parsed.timestamp).toBe(1234567890);
            expect(parsed.ipAddress).toBe('127.0.0.1');
            expect(parsed.userAgent).toBe('TestAgent/1.0');
        });

        it('should include all required fields for API call events', async () => {
            const event: APICallEvent = {
                service: 'bedrock',
                operation: 'InvokeModelWithResponseStream',
                requestId: 'req-required',
                userId: 'user-required',
                timestamp: 9876543210,
                duration: 2500,
                statusCode: 200,
            };

            await logger.logAPICall(event);

            const loggedData = consoleLogSpy.mock.calls[0][0];
            const parsed = JSON.parse(loggedData);

            // Verify all required fields are present
            expect(parsed.service).toBeDefined();
            expect(parsed.operation).toBeDefined();
            expect(parsed.requestId).toBeDefined();
            expect(parsed.userId).toBeDefined();
            expect(parsed.timestamp).toBeDefined();
            expect(parsed.duration).toBeDefined();
            expect(parsed.statusCode).toBeDefined();

            // Verify field values
            expect(parsed.service).toBe('bedrock');
            expect(parsed.operation).toBe('InvokeModelWithResponseStream');
            expect(parsed.requestId).toBe('req-required');
            expect(parsed.userId).toBe('user-required');
            expect(parsed.timestamp).toBe(9876543210);
            expect(parsed.duration).toBe(2500);
            expect(parsed.statusCode).toBe(200);
        });

        it('should include all required fields for document operation events', async () => {
            const event: DocumentOperationEvent = {
                operation: 'delete',
                documentId: 'doc-required',
                documentName: 'required.pdf',
                userId: 'user-required',
                timestamp: 1111111111,
                status: 'success',
            };

            await logger.logDocumentOperation(event);

            const loggedData = consoleLogSpy.mock.calls[0][0];
            const parsed = JSON.parse(loggedData);

            // Verify all required fields are present
            expect(parsed.operation).toBeDefined();
            expect(parsed.documentId).toBeDefined();
            expect(parsed.documentName).toBeDefined();
            expect(parsed.userId).toBeDefined();
            expect(parsed.timestamp).toBeDefined();
            expect(parsed.status).toBeDefined();

            // Verify field values
            expect(parsed.operation).toBe('delete');
            expect(parsed.documentId).toBe('doc-required');
            expect(parsed.documentName).toBe('required.pdf');
            expect(parsed.userId).toBe('user-required');
            expect(parsed.timestamp).toBe(1111111111);
            expect(parsed.status).toBe('success');
        });

        it('should not include undefined optional fields in JSON output', async () => {
            const event: APICallEvent = {
                service: 'opensearch',
                operation: 'search',
                requestId: 'req-no-token',
                userId: 'user-123',
                timestamp: Date.now(),
                duration: 150,
                statusCode: 200,
                // tokenCount is intentionally omitted
            };

            await logger.logAPICall(event);

            const loggedData = consoleLogSpy.mock.calls[0][0];
            const parsed = JSON.parse(loggedData);

            // tokenCount should be undefined
            expect(parsed.tokenCount).toBeUndefined();
        });

        it('should preserve field types in logged data', async () => {
            const event: APICallEvent = {
                service: 'bedrock',
                operation: 'test',
                requestId: 'req-types',
                userId: 'user-types',
                timestamp: 1234567890,
                duration: 1500,
                statusCode: 200,
                tokenCount: 250,
            };

            await logger.logAPICall(event);

            const loggedData = consoleLogSpy.mock.calls[0][0];
            const parsed = JSON.parse(loggedData);

            // Verify types are preserved
            expect(typeof parsed.service).toBe('string');
            expect(typeof parsed.operation).toBe('string');
            expect(typeof parsed.requestId).toBe('string');
            expect(typeof parsed.userId).toBe('string');
            expect(typeof parsed.timestamp).toBe('number');
            expect(typeof parsed.duration).toBe('number');
            expect(typeof parsed.statusCode).toBe('number');
            expect(typeof parsed.tokenCount).toBe('number');
        });
    });

    describe('Console Logging Configuration', () => {
        it('should log to console when consoleLogging is enabled', async () => {
            const loggerWithConsole = new AuditLogger({ consoleLogging: true });
            const event: UserActionEvent = {
                eventType: 'login',
                userId: 'user-123',
                sessionId: 'session-456',
                timestamp: Date.now(),
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
            };

            await loggerWithConsole.logUserAction(event);

            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        });

        it('should not log to console when consoleLogging is disabled', async () => {
            const loggerWithoutConsole = new AuditLogger({ consoleLogging: false });
            const event: UserActionEvent = {
                eventType: 'login',
                userId: 'user-123',
                sessionId: 'session-456',
                timestamp: Date.now(),
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
            };

            // Mock CloudWatch to avoid errors
            mockSend.mockResolvedValue({ nextSequenceToken: 'token' });

            await loggerWithoutConsole.logUserAction(event);

            expect(consoleLogSpy).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should not throw error when CloudWatch write fails', async () => {
            mockSend.mockRejectedValue(new Error('CloudWatch error'));

            const event: UserActionEvent = {
                eventType: 'login',
                userId: 'user-123',
                sessionId: 'session-456',
                timestamp: Date.now(),
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
            };

            // Should not throw
            await expect(logger.logUserAction(event)).resolves.not.toThrow();

            // Should log error to console
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('Convenience Functions', () => {
        it('should provide singleton logger via getAuditLogger', () => {
            const logger1 = getAuditLogger();
            const logger2 = getAuditLogger();

            expect(logger1).toBe(logger2);
        });

        it('should log user action via convenience function', async () => {
            const event: UserActionEvent = {
                eventType: 'query',
                userId: 'user-convenience',
                sessionId: 'session-convenience',
                timestamp: Date.now(),
                ipAddress: '10.0.0.1',
                userAgent: 'TestAgent',
            };

            await logUserAction(event);

            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should log API call via convenience function', async () => {
            const event: APICallEvent = {
                service: 'bedrock',
                operation: 'test',
                requestId: 'req-convenience',
                userId: 'user-convenience',
                timestamp: Date.now(),
                duration: 100,
                statusCode: 200,
            };

            await logAPICall(event);

            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should log document operation via convenience function', async () => {
            const event: DocumentOperationEvent = {
                operation: 'upload',
                documentId: 'doc-convenience',
                documentName: 'test.pdf',
                userId: 'user-convenience',
                timestamp: Date.now(),
                status: 'success',
            };

            await logDocumentOperation(event);

            expect(consoleLogSpy).toHaveBeenCalled();
        });
    });
});
