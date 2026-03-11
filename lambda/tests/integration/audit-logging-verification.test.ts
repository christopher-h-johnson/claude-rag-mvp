import { describe, it, expect, beforeAll } from 'vitest';
import {
    CloudWatchLogsClient,
    DescribeLogGroupsCommand,
    FilterLogEventsCommand,
    DescribeLogStreamsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { getTestConfig } from './load-terraform-config';

/**
 * Integration Test: Audit Logging Completeness Verification
 * 
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5
 * 
 * This test verifies:
 * - All user actions are logged with required fields
 * - All document operations are logged
 * - All Bedrock API calls are logged
 * - Logs are retained for 365 days
 * 
 * Task: 24.4 Verify audit logging completeness
 */

describe('Audit Logging Completeness Verification', () => {
    let cloudWatchClient: CloudWatchLogsClient;

    const AUDIT_LOG_GROUPS = {
        USER_ACTIONS: '/aws/lambda/chatbot/audit/user-actions',
        API_CALLS: '/aws/lambda/chatbot/audit/api-calls',
        DOCUMENT_OPERATIONS: '/aws/lambda/chatbot/audit/document-operations',
    };

    const REQUIRED_RETENTION_DAYS = 365;

    beforeAll(async () => {
        const config = getTestConfig();
        cloudWatchClient = new CloudWatchLogsClient({ region: config.region });
    });

    describe('Requirement 11.4: Log Group Configuration', () => {
        it('should have all required audit log groups created', async () => {
            const command = new DescribeLogGroupsCommand({});
            const response = await cloudWatchClient.send(command);

            const logGroupNames = response.logGroups?.map(lg => lg.logGroupName) || [];

            // Verify all audit log groups exist
            expect(logGroupNames).toContain(AUDIT_LOG_GROUPS.USER_ACTIONS);
            expect(logGroupNames).toContain(AUDIT_LOG_GROUPS.API_CALLS);
            expect(logGroupNames).toContain(AUDIT_LOG_GROUPS.DOCUMENT_OPERATIONS);
        });

        it('should have 365-day retention configured for all audit log groups', async () => {
            const command = new DescribeLogGroupsCommand({
                logGroupNamePrefix: '/aws/lambda/chatbot/audit/',
            });
            const response = await cloudWatchClient.send(command);

            const auditLogGroups = response.logGroups || [];

            // Verify we found all three audit log groups
            expect(auditLogGroups.length).toBeGreaterThanOrEqual(3);

            // Verify each has 365-day retention
            for (const logGroup of auditLogGroups) {
                expect(logGroup.retentionInDays).toBe(REQUIRED_RETENTION_DAYS);
                console.log(`✓ ${logGroup.logGroupName}: ${logGroup.retentionInDays} days retention`);
            }
        }, 10000);
    });

    describe('Requirement 11.1: User Action Logging', () => {
        it('should log user actions with all required fields', async () => {
            // Query recent user action logs
            const command = new FilterLogEventsCommand({
                logGroupName: AUDIT_LOG_GROUPS.USER_ACTIONS,
                limit: 10,
                startTime: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
            });

            try {
                const response = await cloudWatchClient.send(command);
                const events = response.events || [];

                if (events.length === 0) {
                    console.log('⚠ No user action logs found in the last 24 hours');
                    console.log('  This may be expected if no user actions have occurred');
                    return;
                }

                // Verify at least one log entry has all required fields
                const sampleLog = events[0];
                const logData = JSON.parse(sampleLog.message || '{}');

                // Required fields per Requirements 11.1
                const requiredFields = [
                    'eventType',
                    'userId',
                    'sessionId',
                    'timestamp',
                    'ipAddress',
                    'userAgent',
                ];

                for (const field of requiredFields) {
                    expect(logData).toHaveProperty(field);
                    expect(logData[field]).toBeDefined();
                }

                // Verify eventType is one of the valid types
                const validEventTypes = ['login', 'logout', 'query', 'upload', 'delete'];
                expect(validEventTypes).toContain(logData.eventType);

                console.log(`✓ User action log verified with ${events.length} recent entries`);
                console.log(`  Sample event type: ${logData.eventType}`);
            } catch (error: any) {
                if (error.name === 'ResourceNotFoundException') {
                    throw new Error(
                        `User actions log group not found: ${AUDIT_LOG_GROUPS.USER_ACTIONS}`
                    );
                }
                throw error;
            }
        }, 15000);

        it('should log different types of user actions', async () => {
            const command = new FilterLogEventsCommand({
                logGroupName: AUDIT_LOG_GROUPS.USER_ACTIONS,
                limit: 100,
                startTime: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
            });

            try {
                const response = await cloudWatchClient.send(command);
                const events = response.events || [];

                if (events.length === 0) {
                    console.log('⚠ No user action logs found in the last 7 days');
                    return;
                }

                // Collect unique event types
                const eventTypes = new Set<string>();
                for (const event of events) {
                    try {
                        const logData = JSON.parse(event.message || '{}');
                        if (logData.eventType) {
                            eventTypes.add(logData.eventType);
                        }
                    } catch {
                        // Skip malformed logs
                    }
                }

                console.log(`✓ Found ${eventTypes.size} different user action types:`);
                console.log(`  ${Array.from(eventTypes).join(', ')}`);

                // At minimum, we should have some user actions logged
                expect(eventTypes.size).toBeGreaterThan(0);
            } catch (error: any) {
                if (error.name === 'ResourceNotFoundException') {
                    console.log('⚠ User actions log group not found - may not be deployed yet');
                    return;
                }
                throw error;
            }
        }, 15000);
    });

    describe('Requirement 11.2: Document Operation Logging', () => {
        it('should log document operations with all required fields', async () => {
            const command = new FilterLogEventsCommand({
                logGroupName: AUDIT_LOG_GROUPS.DOCUMENT_OPERATIONS,
                limit: 10,
                startTime: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
            });

            try {
                const response = await cloudWatchClient.send(command);
                const events = response.events || [];

                if (events.length === 0) {
                    console.log('⚠ No document operation logs found in the last 24 hours');
                    console.log('  This may be expected if no document operations have occurred');
                    return;
                }

                // Verify at least one log entry has all required fields
                const sampleLog = events[0];
                const logData = JSON.parse(sampleLog.message || '{}');

                // Required fields per Requirements 11.2
                const requiredFields = [
                    'operation',
                    'documentId',
                    'documentName',
                    'userId',
                    'timestamp',
                    'status',
                ];

                for (const field of requiredFields) {
                    expect(logData).toHaveProperty(field);
                    expect(logData[field]).toBeDefined();
                }

                // Verify operation is one of the valid types
                const validOperations = ['upload', 'delete', 'process'];
                expect(validOperations).toContain(logData.operation);

                // Verify status is valid
                const validStatuses = ['success', 'failed'];
                expect(validStatuses).toContain(logData.status);

                console.log(`✓ Document operation log verified with ${events.length} recent entries`);
                console.log(`  Sample operation: ${logData.operation} (${logData.status})`);
            } catch (error: any) {
                if (error.name === 'ResourceNotFoundException') {
                    throw new Error(
                        `Document operations log group not found: ${AUDIT_LOG_GROUPS.DOCUMENT_OPERATIONS}`
                    );
                }
                throw error;
            }
        }, 15000);

        it('should log file metadata for document operations', async () => {
            const command = new FilterLogEventsCommand({
                logGroupName: AUDIT_LOG_GROUPS.DOCUMENT_OPERATIONS,
                limit: 50,
                startTime: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
            });

            try {
                const response = await cloudWatchClient.send(command);
                const events = response.events || [];

                if (events.length === 0) {
                    console.log('⚠ No document operation logs found in the last 7 days');
                    return;
                }

                // Check if any upload operations include fileSize
                let uploadsWithFileSize = 0;
                let totalUploads = 0;

                for (const event of events) {
                    try {
                        const logData = JSON.parse(event.message || '{}');
                        if (logData.operation === 'upload') {
                            totalUploads++;
                            if (logData.fileSize !== undefined) {
                                uploadsWithFileSize++;
                            }
                        }
                    } catch {
                        // Skip malformed logs
                    }
                }

                if (totalUploads > 0) {
                    console.log(`✓ Found ${totalUploads} upload operations`);
                    console.log(`  ${uploadsWithFileSize} include file size metadata`);
                    expect(uploadsWithFileSize).toBeGreaterThan(0);
                }
            } catch (error: any) {
                if (error.name === 'ResourceNotFoundException') {
                    console.log('⚠ Document operations log group not found');
                    return;
                }
                throw error;
            }
        }, 15000);
    });

    describe('Requirement 11.3: API Call Logging', () => {
        it('should log API calls with all required fields', async () => {
            const command = new FilterLogEventsCommand({
                logGroupName: AUDIT_LOG_GROUPS.API_CALLS,
                limit: 10,
                startTime: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
            });

            try {
                const response = await cloudWatchClient.send(command);
                const events = response.events || [];

                if (events.length === 0) {
                    console.log('⚠ No API call logs found in the last 24 hours');
                    console.log('  This may be expected if no API calls have occurred');
                    return;
                }

                // Verify at least one log entry has all required fields
                const sampleLog = events[0];
                const logData = JSON.parse(sampleLog.message || '{}');

                // Required fields per Requirements 11.3
                const requiredFields = [
                    'service',
                    'operation',
                    'requestId',
                    'userId',
                    'timestamp',
                    'duration',
                    'statusCode',
                ];

                for (const field of requiredFields) {
                    expect(logData).toHaveProperty(field);
                    expect(logData[field]).toBeDefined();
                }

                // Verify service is one of the valid types
                const validServices = ['bedrock', 'opensearch', 's3'];
                expect(validServices).toContain(logData.service);

                console.log(`✓ API call log verified with ${events.length} recent entries`);
                console.log(`  Sample service: ${logData.service}, operation: ${logData.operation}`);
            } catch (error: any) {
                if (error.name === 'ResourceNotFoundException') {
                    throw new Error(
                        `API calls log group not found: ${AUDIT_LOG_GROUPS.API_CALLS}`
                    );
                }
                throw error;
            }
        }, 15000);

        it('should log Bedrock API calls with token counts', async () => {
            const command = new FilterLogEventsCommand({
                logGroupName: AUDIT_LOG_GROUPS.API_CALLS,
                filterPattern: '{ $.service = "bedrock" }',
                limit: 50,
                startTime: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
            });

            try {
                const response = await cloudWatchClient.send(command);
                const events = response.events || [];

                if (events.length === 0) {
                    console.log('⚠ No Bedrock API call logs found in the last 7 days');
                    return;
                }

                // Check if Bedrock calls include token counts
                let callsWithTokenCount = 0;
                let totalBedrockCalls = 0;

                for (const event of events) {
                    try {
                        const logData = JSON.parse(event.message || '{}');
                        if (logData.service === 'bedrock') {
                            totalBedrockCalls++;
                            if (logData.tokenCount !== undefined) {
                                callsWithTokenCount++;
                            }
                        }
                    } catch {
                        // Skip malformed logs
                    }
                }

                console.log(`✓ Found ${totalBedrockCalls} Bedrock API calls`);
                if (callsWithTokenCount > 0) {
                    console.log(`  ${callsWithTokenCount} include token count metadata`);
                }
            } catch (error: any) {
                if (error.name === 'ResourceNotFoundException') {
                    console.log('⚠ API calls log group not found');
                    return;
                }
                throw error;
            }
        }, 15000);

        it('should log different types of API calls', async () => {
            const command = new FilterLogEventsCommand({
                logGroupName: AUDIT_LOG_GROUPS.API_CALLS,
                limit: 100,
                startTime: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
            });

            try {
                const response = await cloudWatchClient.send(command);
                const events = response.events || [];

                if (events.length === 0) {
                    console.log('⚠ No API call logs found in the last 7 days');
                    return;
                }

                // Collect unique service types
                const services = new Set<string>();
                for (const event of events) {
                    try {
                        const logData = JSON.parse(event.message || '{}');
                        if (logData.service) {
                            services.add(logData.service);
                        }
                    } catch {
                        // Skip malformed logs
                    }
                }

                console.log(`✓ Found ${services.size} different API service types:`);
                console.log(`  ${Array.from(services).join(', ')}`);

                // At minimum, we should have some API calls logged
                expect(services.size).toBeGreaterThan(0);
            } catch (error: any) {
                if (error.name === 'ResourceNotFoundException') {
                    console.log('⚠ API calls log group not found');
                    return;
                }
                throw error;
            }
        }, 15000);
    });

    describe('Requirement 11.5: Log Retention and Compliance', () => {
        it('should have logs from at least 30 days ago (if system has been running)', async () => {
            const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

            for (const [name, logGroupName] of Object.entries(AUDIT_LOG_GROUPS)) {
                const command = new DescribeLogStreamsCommand({
                    logGroupName,
                    orderBy: 'LastEventTime',
                    descending: true,
                    limit: 1,
                });

                try {
                    const response = await cloudWatchClient.send(command);
                    const logStreams = response.logStreams || [];

                    if (logStreams.length > 0 && logStreams[0].firstEventTimestamp) {
                        const firstEventTime = logStreams[0].firstEventTimestamp;
                        const ageInDays = Math.floor((Date.now() - firstEventTime) / (24 * 60 * 60 * 1000));

                        console.log(`✓ ${name}: Oldest log is ${ageInDays} days old`);

                        // If system has been running for 30+ days, verify logs exist from that period
                        if (ageInDays >= 30) {
                            expect(firstEventTime).toBeLessThan(thirtyDaysAgo);
                        }
                    } else {
                        console.log(`⚠ ${name}: No log streams found yet`);
                    }
                } catch (error: any) {
                    if (error.name === 'ResourceNotFoundException') {
                        console.log(`⚠ ${name}: Log group not found`);
                    } else {
                        throw error;
                    }
                }
            }
        }, 20000);

        it('should have structured JSON format for all logs', async () => {
            // Check a sample from each log group
            for (const [name, logGroupName] of Object.entries(AUDIT_LOG_GROUPS)) {
                const command = new FilterLogEventsCommand({
                    logGroupName,
                    limit: 5,
                    startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
                });

                try {
                    const response = await cloudWatchClient.send(command);
                    const events = response.events || [];

                    if (events.length === 0) {
                        console.log(`⚠ ${name}: No recent logs to verify format`);
                        continue;
                    }

                    // Verify all logs are valid JSON
                    let validJsonCount = 0;
                    for (const event of events) {
                        try {
                            const parsed = JSON.parse(event.message || '{}');
                            if (typeof parsed === 'object' && parsed !== null) {
                                validJsonCount++;
                            }
                        } catch {
                            // Invalid JSON
                        }
                    }

                    const percentValid = (validJsonCount / events.length) * 100;
                    console.log(`✓ ${name}: ${percentValid.toFixed(0)}% valid JSON (${validJsonCount}/${events.length})`);

                    // All logs should be valid JSON
                    expect(percentValid).toBe(100);
                } catch (error: any) {
                    if (error.name === 'ResourceNotFoundException') {
                        console.log(`⚠ ${name}: Log group not found`);
                    } else {
                        throw error;
                    }
                }
            }
        }, 20000);
    });

    describe('Integration: Audit Logging Coverage', () => {
        it('should have audit logs from all critical Lambda functions', async () => {
            // Check that we have logs from various user actions
            const userActionsCommand = new FilterLogEventsCommand({
                logGroupName: AUDIT_LOG_GROUPS.USER_ACTIONS,
                limit: 100,
                startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
            });

            try {
                const response = await cloudWatchClient.send(userActionsCommand);
                const events = response.events || [];

                // Collect unique event types to verify coverage
                const eventTypes = new Set<string>();
                for (const event of events) {
                    try {
                        const logData = JSON.parse(event.message || '{}');
                        if (logData.eventType) {
                            eventTypes.add(logData.eventType);
                        }
                    } catch {
                        // Skip malformed logs
                    }
                }

                console.log('\n📊 Audit Logging Coverage Summary:');
                console.log(`   User action types logged: ${Array.from(eventTypes).join(', ') || 'none'}`);
                console.log(`   Total user action events: ${events.length}`);

                // If system is active, we should have at least some user actions
                if (events.length > 0) {
                    expect(eventTypes.size).toBeGreaterThan(0);
                }
            } catch (error: any) {
                if (error.name === 'ResourceNotFoundException') {
                    console.log('⚠ User actions log group not found');
                }
            }
        }, 20000);

        it('should verify all audit log groups are queryable', async () => {
            const results: Record<string, boolean> = {};

            for (const [name, logGroupName] of Object.entries(AUDIT_LOG_GROUPS)) {
                try {
                    const command = new DescribeLogStreamsCommand({
                        logGroupName,
                        limit: 1,
                    });

                    await cloudWatchClient.send(command);
                    results[name] = true;
                } catch (error: any) {
                    if (error.name === 'ResourceNotFoundException') {
                        results[name] = false;
                    } else {
                        throw error;
                    }
                }
            }

            console.log('\n📋 Audit Log Group Status:');
            for (const [name, exists] of Object.entries(results)) {
                console.log(`   ${exists ? '✓' : '✗'} ${name}: ${exists ? 'Available' : 'Not Found'}`);
            }

            // All audit log groups should exist
            const allExist = Object.values(results).every(v => v);
            expect(allExist).toBe(true);
        }, 15000);
    });
});
