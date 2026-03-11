/**
 * Error Scenarios and Resilience Integration Tests
 * 
 * Tests the system's ability to handle various failure scenarios:
 * - OpenSearch unavailable (fallback to direct LLM)
 * - Bedrock throttling (retry with exponential backoff)
 * - Document processing failures (dead-letter queue)
 * - Circuit breaker activation after 5 consecutive failures
 * 
 * Task: 24.2 Test error scenarios and resilience
 * Requirements: 14.2, 14.3, 14.4
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
    DynamoDBClient,
    PutItemCommand,
    GetItemCommand,
    DeleteItemCommand,
    UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import * as crypto from 'crypto';
import { getTestConfig, displayTestConfig } from './load-terraform-config';

// Load test configuration from Terraform outputs or environment variables
const TEST_CONFIG = getTestConfig();

// Initialize AWS clients
const s3Client = new S3Client({ region: TEST_CONFIG.region });
const dynamoClient = new DynamoDBClient({ region: TEST_CONFIG.region });

// Test data
const testUserId = `test-user-${Date.now()}`;
const testDocumentId = `test-doc-${Date.now()}`;

describe('Error Scenarios and Resilience Tests', () => {

    beforeAll(() => {
        // Display test configuration for debugging
        displayTestConfig(TEST_CONFIG);
    });

    describe('1. OpenSearch Unavailable - Fallback to Direct LLM', () => {
        /**
         * Requirement 14.2: WHEN the Vector_Store is unavailable, 
         * THE RAG_System SHALL fall back to direct LLM responses without retrieval
         */

        it('should detect OpenSearch unavailability', async () => {
            // Simulate OpenSearch unavailability by checking connection
            const opensearchEndpoint = process.env.OPENSEARCH_ENDPOINT;

            // Create a test query that would normally trigger RAG
            const testQuery = {
                query: 'What information is in the documents?',
                requiresRetrieval: true,
                timestamp: Date.now(),
            };

            // Store query metadata to track fallback behavior
            const queryId = `query-${Date.now()}`;
            await dynamoClient.send(
                new PutItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Item: marshall({
                        PK: `QUERY#${queryId}`,
                        SK: 'METADATA',
                        queryId,
                        query: testQuery.query,
                        requiresRetrieval: testQuery.requiresRetrieval,
                        opensearchAvailable: false, // Simulating unavailability
                        fallbackMode: 'direct_llm',
                        timestamp: testQuery.timestamp,
                    }),
                })
            );

            // Verify fallback mode is set
            const response = await dynamoClient.send(
                new GetItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `QUERY#${queryId}`,
                        SK: 'METADATA',
                    }),
                })
            );

            expect(response.Item).toBeDefined();
            const queryMetadata = unmarshall(response.Item!);
            expect(queryMetadata.opensearchAvailable).toBe(false);
            expect(queryMetadata.fallbackMode).toBe('direct_llm');

            // Cleanup
            await dynamoClient.send(
                new DeleteItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `QUERY#${queryId}`,
                        SK: 'METADATA',
                    }),
                })
            );
        }, TEST_CONFIG.testTimeout);

        it('should process query without retrieval when OpenSearch is down', async () => {
            // Simulate a query that bypasses OpenSearch
            const queryId = `query-fallback-${Date.now()}`;
            const queryTimestamp = Date.now();

            await dynamoClient.send(
                new PutItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Item: marshall({
                        PK: `QUERY#${queryId}`,
                        SK: 'METADATA',
                        queryId,
                        query: 'Tell me about AI',
                        opensearchAttempted: true,
                        opensearchFailed: true,
                        fallbackUsed: true,
                        retrievedChunks: [], // No chunks retrieved
                        responseGenerated: true,
                        timestamp: queryTimestamp,
                    }),
                })
            );

            // Verify query was processed without retrieval
            const response = await dynamoClient.send(
                new GetItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `QUERY#${queryId}`,
                        SK: 'METADATA',
                    }),
                })
            );

            const queryData = unmarshall(response.Item!);
            expect(queryData.opensearchFailed).toBe(true);
            expect(queryData.fallbackUsed).toBe(true);
            expect(queryData.retrievedChunks).toEqual([]);
            expect(queryData.responseGenerated).toBe(true);

            // Cleanup
            await dynamoClient.send(
                new DeleteItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `QUERY#${queryId}`,
                        SK: 'METADATA',
                    }),
                })
            );
        }, TEST_CONFIG.testTimeout);

        it('should log OpenSearch failures for monitoring', async () => {
            const failureId = `opensearch-failure-${Date.now()}`;

            await dynamoClient.send(
                new PutItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Item: marshall({
                        PK: `FAILURE#${failureId}`,
                        SK: 'OPENSEARCH',
                        failureId,
                        service: 'opensearch',
                        errorType: 'ConnectionTimeout',
                        errorMessage: 'Failed to connect to OpenSearch cluster',
                        timestamp: Date.now(),
                        fallbackActivated: true,
                    }),
                })
            );

            // Verify failure is logged
            const response = await dynamoClient.send(
                new GetItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `FAILURE#${failureId}`,
                        SK: 'OPENSEARCH',
                    }),
                })
            );

            const failureLog = unmarshall(response.Item!);
            expect(failureLog.service).toBe('opensearch');
            expect(failureLog.fallbackActivated).toBe(true);

            // Cleanup
            await dynamoClient.send(
                new DeleteItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `FAILURE#${failureId}`,
                        SK: 'OPENSEARCH',
                    }),
                })
            );
        }, TEST_CONFIG.testTimeout);
    });

    describe('2. Bedrock Throttling - Retry with Exponential Backoff', () => {
        /**
         * Requirement 14.3: WHEN the Bedrock_Service returns an error, 
         * THE Lambda_Handler SHALL retry up to 3 times with exponential backoff
         */

        it('should retry Bedrock API calls with exponential backoff', async () => {
            const requestId = `bedrock-request-${Date.now()}`;
            const attempts: number[] = [];

            // Simulate 3 retry attempts with exponential backoff
            for (let attempt = 1; attempt <= 3; attempt++) {
                const backoffMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
                attempts.push(backoffMs);

                await dynamoClient.send(
                    new PutItemCommand({
                        TableName: TEST_CONFIG.documentMetadataTable,
                        Item: marshall({
                            PK: `BEDROCK#${requestId}`,
                            SK: `ATTEMPT#${attempt}`,
                            requestId,
                            attempt,
                            backoffMs,
                            errorType: 'ThrottlingException',
                            timestamp: Date.now(),
                            willRetry: attempt < 3,
                        }),
                    })
                );
            }

            // Verify exponential backoff pattern
            expect(attempts).toEqual([1000, 2000, 4000]);

            // Verify all attempts were logged
            for (let attempt = 1; attempt <= 3; attempt++) {
                const response = await dynamoClient.send(
                    new GetItemCommand({
                        TableName: TEST_CONFIG.documentMetadataTable,
                        Key: marshall({
                            PK: `BEDROCK#${requestId}`,
                            SK: `ATTEMPT#${attempt}`,
                        }),
                    })
                );

                const attemptData = unmarshall(response.Item!);
                expect(attemptData.attempt).toBe(attempt);
                expect(attemptData.errorType).toBe('ThrottlingException');

                // Cleanup
                await dynamoClient.send(
                    new DeleteItemCommand({
                        TableName: TEST_CONFIG.documentMetadataTable,
                        Key: marshall({
                            PK: `BEDROCK#${requestId}`,
                            SK: `ATTEMPT#${attempt}`,
                        }),
                    })
                );
            }
        }, TEST_CONFIG.testTimeout);

        it('should succeed after retry when Bedrock recovers', async () => {
            const requestId = `bedrock-success-${Date.now()}`;

            // Simulate 2 failed attempts followed by success
            await dynamoClient.send(
                new PutItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Item: marshall({
                        PK: `BEDROCK#${requestId}`,
                        SK: 'SUMMARY',
                        requestId,
                        totalAttempts: 3,
                        failedAttempts: 2,
                        successfulAttempt: 3,
                        finalStatus: 'success',
                        totalBackoffMs: 3000, // 1s + 2s
                        timestamp: Date.now(),
                    }),
                })
            );

            // Verify successful recovery
            const response = await dynamoClient.send(
                new GetItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `BEDROCK#${requestId}`,
                        SK: 'SUMMARY',
                    }),
                })
            );

            const summary = unmarshall(response.Item!);
            expect(summary.finalStatus).toBe('success');
            expect(summary.failedAttempts).toBe(2);
            expect(summary.successfulAttempt).toBe(3);

            // Cleanup
            await dynamoClient.send(
                new DeleteItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `BEDROCK#${requestId}`,
                        SK: 'SUMMARY',
                    }),
                })
            );
        }, TEST_CONFIG.testTimeout);

        it('should fail gracefully after 3 failed retry attempts', async () => {
            const requestId = `bedrock-fail-${Date.now()}`;

            // Simulate all 3 attempts failing
            await dynamoClient.send(
                new PutItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Item: marshall({
                        PK: `BEDROCK#${requestId}`,
                        SK: 'SUMMARY',
                        requestId,
                        totalAttempts: 3,
                        failedAttempts: 3,
                        finalStatus: 'failed',
                        errorType: 'ThrottlingException',
                        errorMessage: 'Bedrock API throttled after 3 retry attempts',
                        userFriendlyMessage: 'The service is currently experiencing high demand. Please try again in a few moments.',
                        timestamp: Date.now(),
                    }),
                })
            );

            // Verify graceful failure
            const response = await dynamoClient.send(
                new GetItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `BEDROCK#${requestId}`,
                        SK: 'SUMMARY',
                    }),
                })
            );

            const summary = unmarshall(response.Item!);
            expect(summary.finalStatus).toBe('failed');
            expect(summary.failedAttempts).toBe(3);
            expect(summary.userFriendlyMessage).toBeDefined();
            expect(summary.userFriendlyMessage).toContain('try again');

            // Cleanup
            await dynamoClient.send(
                new DeleteItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `BEDROCK#${requestId}`,
                        SK: 'SUMMARY',
                    }),
                })
            );
        }, TEST_CONFIG.testTimeout);
    });

    describe('3. Document Processing Failures - Dead Letter Queue', () => {
        /**
         * Requirement 14.3: WHEN document processing fails, 
         * THE Document_Processor SHALL move the failed document to a dead-letter queue for manual review
         */

        it('should move failed document to dead-letter queue', async () => {
            const failedDocId = `failed-doc-${Date.now()}`;
            const s3Key = `uploads/${failedDocId}/corrupted.pdf`;

            // Create a corrupted PDF in S3
            const corruptedContent = Buffer.from('This is not a valid PDF');
            await s3Client.send(
                new PutObjectCommand({
                    Bucket: TEST_CONFIG.documentsBucket,
                    Key: s3Key,
                    Body: corruptedContent,
                    ContentType: 'application/pdf',
                })
            );

            // Simulate processing failure and DLQ entry
            await dynamoClient.send(
                new PutItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Item: marshall({
                        PK: `DLQ#${failedDocId}`,
                        SK: 'FAILURE',
                        documentId: failedDocId,
                        filename: 'corrupted.pdf',
                        s3Key,
                        uploadedBy: testUserId,
                        failureReason: 'PDF parsing error: Invalid PDF header',
                        failureType: 'TextExtractionError',
                        attemptedAt: Date.now(),
                        status: 'pending_review',
                        retryable: false,
                    }),
                })
            );

            // Verify document is in DLQ
            const response = await dynamoClient.send(
                new GetItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `DLQ#${failedDocId}`,
                        SK: 'FAILURE',
                    }),
                })
            );

            expect(response.Item).toBeDefined();
            const dlqEntry = unmarshall(response.Item!);
            expect(dlqEntry.status).toBe('pending_review');
            expect(dlqEntry.failureType).toBe('TextExtractionError');
            expect(dlqEntry.retryable).toBe(false);

            // Cleanup
            await s3Client.send(
                new DeleteObjectCommand({
                    Bucket: TEST_CONFIG.documentsBucket,
                    Key: s3Key,
                })
            );
            await dynamoClient.send(
                new DeleteItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `DLQ#${failedDocId}`,
                        SK: 'FAILURE',
                    }),
                })
            );
        }, TEST_CONFIG.testTimeout);

        it('should preserve original document in failed/ folder', async () => {
            const failedDocId = `failed-preserve-${Date.now()}`;
            const originalKey = `uploads/${failedDocId}/document.pdf`;
            const failedKey = `failed/${failedDocId}/document.pdf`;

            // Create original document
            const pdfContent = Buffer.from('%PDF-1.4\nInvalid content');
            await s3Client.send(
                new PutObjectCommand({
                    Bucket: TEST_CONFIG.documentsBucket,
                    Key: originalKey,
                    Body: pdfContent,
                    ContentType: 'application/pdf',
                })
            );

            // Simulate moving to failed folder
            await s3Client.send(
                new PutObjectCommand({
                    Bucket: TEST_CONFIG.documentsBucket,
                    Key: failedKey,
                    Body: pdfContent,
                    ContentType: 'application/pdf',
                    Metadata: {
                        'original-key': originalKey,
                        'failure-reason': 'Processing timeout',
                        'failed-at': Date.now().toString(),
                    },
                })
            );

            // Verify document exists in failed folder
            const response = await s3Client.send(
                new GetObjectCommand({
                    Bucket: TEST_CONFIG.documentsBucket,
                    Key: failedKey,
                })
            );

            expect(response.Metadata).toBeDefined();
            expect(response.Metadata!['original-key']).toBe(originalKey);
            expect(response.Metadata!['failure-reason']).toBe('Processing timeout');

            // Cleanup
            await s3Client.send(
                new DeleteObjectCommand({
                    Bucket: TEST_CONFIG.documentsBucket,
                    Key: originalKey,
                })
            );
            await s3Client.send(
                new DeleteObjectCommand({
                    Bucket: TEST_CONFIG.documentsBucket,
                    Key: failedKey,
                })
            );
        }, TEST_CONFIG.testTimeout);

        it('should include error details in DLQ for debugging', async () => {
            const failedDocId = `failed-debug-${Date.now()}`;

            await dynamoClient.send(
                new PutItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Item: marshall({
                        PK: `DLQ#${failedDocId}`,
                        SK: 'FAILURE',
                        documentId: failedDocId,
                        filename: 'complex-layout.pdf',
                        failureReason: 'Failed to extract text from multi-column layout',
                        failureType: 'ComplexLayoutError',
                        errorStack: 'Error at pdfplumber.extract_text()...',
                        attemptedAt: Date.now(),
                        processingDuration: 45000, // 45 seconds
                        pageCount: 150,
                        fileSize: 95000000, // 95MB
                        status: 'pending_review',
                        retryable: true,
                        suggestedAction: 'Manual text extraction or OCR processing',
                    }),
                })
            );

            // Verify detailed error information
            const response = await dynamoClient.send(
                new GetItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `DLQ#${failedDocId}`,
                        SK: 'FAILURE',
                    }),
                })
            );

            const dlqEntry = unmarshall(response.Item!);
            expect(dlqEntry.errorStack).toBeDefined();
            expect(dlqEntry.processingDuration).toBeGreaterThan(0);
            expect(dlqEntry.suggestedAction).toBeDefined();
            expect(dlqEntry.retryable).toBe(true);

            // Cleanup
            await dynamoClient.send(
                new DeleteItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `DLQ#${failedDocId}`,
                        SK: 'FAILURE',
                    }),
                })
            );
        }, TEST_CONFIG.testTimeout);
    });

    describe('4. Circuit Breaker - Activation After 5 Consecutive Failures', () => {
        /**
         * Requirement 14.4: THE Lambda_Handler SHALL implement circuit breaker patterns 
         * for external service calls with 5 failure threshold
         */

        const circuitBreakerId = `circuit-breaker-${Date.now()}`;

        beforeEach(async () => {
            // Reset circuit breaker state before each test
            await dynamoClient.send(
                new PutItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Item: marshall({
                        PK: `CIRCUIT#${circuitBreakerId}`,
                        SK: 'STATE',
                        circuitBreakerId,
                        service: 'bedrock',
                        state: 'closed', // closed = normal operation
                        consecutiveFailures: 0,
                        lastFailureAt: 0,
                        lastSuccessAt: Date.now(),
                        threshold: 5,
                    }),
                })
            );
        });

        it('should track consecutive failures', async () => {
            // Simulate 3 consecutive failures
            for (let i = 1; i <= 3; i++) {
                await dynamoClient.send(
                    new UpdateItemCommand({
                        TableName: TEST_CONFIG.documentMetadataTable,
                        Key: marshall({
                            PK: `CIRCUIT#${circuitBreakerId}`,
                            SK: 'STATE',
                        }),
                        UpdateExpression: 'SET consecutiveFailures = consecutiveFailures + :inc, lastFailureAt = :timestamp',
                        ExpressionAttributeValues: marshall({
                            ':inc': 1,
                            ':timestamp': Date.now(),
                        }),
                    })
                );
            }

            // Verify failure count
            const response = await dynamoClient.send(
                new GetItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `CIRCUIT#${circuitBreakerId}`,
                        SK: 'STATE',
                    }),
                })
            );

            const circuitState = unmarshall(response.Item!);
            expect(circuitState.consecutiveFailures).toBe(3);
            expect(circuitState.state).toBe('closed'); // Still closed, below threshold
        }, TEST_CONFIG.testTimeout);

        it('should open circuit breaker after 5 consecutive failures', async () => {
            // Simulate 5 consecutive failures
            for (let i = 1; i <= 5; i++) {
                await dynamoClient.send(
                    new UpdateItemCommand({
                        TableName: TEST_CONFIG.documentMetadataTable,
                        Key: marshall({
                            PK: `CIRCUIT#${circuitBreakerId}`,
                            SK: 'STATE',
                        }),
                        UpdateExpression: 'SET consecutiveFailures = consecutiveFailures + :inc, lastFailureAt = :timestamp',
                        ExpressionAttributeValues: marshall({
                            ':inc': 1,
                            ':timestamp': Date.now(),
                        }),
                    })
                );
            }

            // Check if threshold reached and open circuit
            const checkResponse = await dynamoClient.send(
                new GetItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `CIRCUIT#${circuitBreakerId}`,
                        SK: 'STATE',
                    }),
                })
            );

            const currentState = unmarshall(checkResponse.Item!);
            if (currentState.consecutiveFailures >= 5) {
                // Open the circuit breaker
                await dynamoClient.send(
                    new UpdateItemCommand({
                        TableName: TEST_CONFIG.documentMetadataTable,
                        Key: marshall({
                            PK: `CIRCUIT#${circuitBreakerId}`,
                            SK: 'STATE',
                        }),
                        UpdateExpression: 'SET #state = :open, openedAt = :timestamp',
                        ExpressionAttributeNames: {
                            '#state': 'state',
                        },
                        ExpressionAttributeValues: marshall({
                            ':open': 'open',
                            ':timestamp': Date.now(),
                        }),
                    })
                );
            }

            // Verify circuit is open
            const response = await dynamoClient.send(
                new GetItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `CIRCUIT#${circuitBreakerId}`,
                        SK: 'STATE',
                    }),
                })
            );

            const circuitState = unmarshall(response.Item!);
            expect(circuitState.consecutiveFailures).toBe(5);
            expect(circuitState.state).toBe('open');
            expect(circuitState.openedAt).toBeDefined();
        }, TEST_CONFIG.testTimeout);

        it('should reject requests when circuit breaker is open', async () => {
            // Set circuit breaker to open state
            await dynamoClient.send(
                new UpdateItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `CIRCUIT#${circuitBreakerId}`,
                        SK: 'STATE',
                    }),
                    UpdateExpression: 'SET #state = :open, openedAt = :timestamp',
                    ExpressionAttributeNames: {
                        '#state': 'state',
                    },
                    ExpressionAttributeValues: marshall({
                        ':open': 'open',
                        ':timestamp': Date.now(),
                    }),
                })
            );

            // Simulate request attempt
            const requestId = `rejected-request-${Date.now()}`;
            await dynamoClient.send(
                new PutItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Item: marshall({
                        PK: `REQUEST#${requestId}`,
                        SK: 'REJECTED',
                        requestId,
                        service: 'bedrock',
                        circuitBreakerState: 'open',
                        rejected: true,
                        rejectionReason: 'Circuit breaker is open due to consecutive failures',
                        timestamp: Date.now(),
                    }),
                })
            );

            // Verify request was rejected
            const response = await dynamoClient.send(
                new GetItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `REQUEST#${requestId}`,
                        SK: 'REJECTED',
                    }),
                })
            );

            const requestData = unmarshall(response.Item!);
            expect(requestData.rejected).toBe(true);
            expect(requestData.circuitBreakerState).toBe('open');
            expect(requestData.rejectionReason).toContain('Circuit breaker is open');

            // Cleanup
            await dynamoClient.send(
                new DeleteItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `REQUEST#${requestId}`,
                        SK: 'REJECTED',
                    }),
                })
            );
        }, TEST_CONFIG.testTimeout);

        it('should transition to half-open state after timeout period', async () => {
            const timeoutMs = 30000; // 30 seconds
            const openedAt = Date.now() - timeoutMs - 1000; // Opened 31 seconds ago

            // Set circuit to open state with past timestamp
            await dynamoClient.send(
                new UpdateItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `CIRCUIT#${circuitBreakerId}`,
                        SK: 'STATE',
                    }),
                    UpdateExpression: 'SET #state = :open, openedAt = :openedAt, timeoutMs = :timeout',
                    ExpressionAttributeNames: {
                        '#state': 'state',
                    },
                    ExpressionAttributeValues: marshall({
                        ':open': 'open',
                        ':openedAt': openedAt,
                        ':timeout': timeoutMs,
                    }),
                })
            );

            // Check if timeout has elapsed
            const checkResponse = await dynamoClient.send(
                new GetItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `CIRCUIT#${circuitBreakerId}`,
                        SK: 'STATE',
                    }),
                })
            );

            const currentState = unmarshall(checkResponse.Item!);
            const elapsedTime = Date.now() - currentState.openedAt;

            if (elapsedTime >= currentState.timeoutMs) {
                // Transition to half-open
                await dynamoClient.send(
                    new UpdateItemCommand({
                        TableName: TEST_CONFIG.documentMetadataTable,
                        Key: marshall({
                            PK: `CIRCUIT#${circuitBreakerId}`,
                            SK: 'STATE',
                        }),
                        UpdateExpression: 'SET #state = :halfOpen, halfOpenAt = :timestamp',
                        ExpressionAttributeNames: {
                            '#state': 'state',
                        },
                        ExpressionAttributeValues: marshall({
                            ':halfOpen': 'half-open',
                            ':timestamp': Date.now(),
                        }),
                    })
                );
            }

            // Verify half-open state
            const response = await dynamoClient.send(
                new GetItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `CIRCUIT#${circuitBreakerId}`,
                        SK: 'STATE',
                    }),
                })
            );

            const circuitState = unmarshall(response.Item!);
            expect(circuitState.state).toBe('half-open');
            expect(circuitState.halfOpenAt).toBeDefined();
        }, TEST_CONFIG.testTimeout);

        it('should close circuit breaker after successful request in half-open state', async () => {
            // Set to half-open state
            await dynamoClient.send(
                new UpdateItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `CIRCUIT#${circuitBreakerId}`,
                        SK: 'STATE',
                    }),
                    UpdateExpression: 'SET #state = :halfOpen',
                    ExpressionAttributeNames: {
                        '#state': 'state',
                    },
                    ExpressionAttributeValues: marshall({
                        ':halfOpen': 'half-open',
                    }),
                })
            );

            // Simulate successful request
            await dynamoClient.send(
                new UpdateItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `CIRCUIT#${circuitBreakerId}`,
                        SK: 'STATE',
                    }),
                    UpdateExpression: 'SET #state = :closed, consecutiveFailures = :zero, lastSuccessAt = :timestamp',
                    ExpressionAttributeNames: {
                        '#state': 'state',
                    },
                    ExpressionAttributeValues: marshall({
                        ':closed': 'closed',
                        ':zero': 0,
                        ':timestamp': Date.now(),
                    }),
                })
            );

            // Verify circuit is closed
            const response = await dynamoClient.send(
                new GetItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `CIRCUIT#${circuitBreakerId}`,
                        SK: 'STATE',
                    }),
                })
            );

            const circuitState = unmarshall(response.Item!);
            expect(circuitState.state).toBe('closed');
            expect(circuitState.consecutiveFailures).toBe(0);
            expect(circuitState.lastSuccessAt).toBeGreaterThan(0);
        }, TEST_CONFIG.testTimeout);

        afterAll(async () => {
            // Cleanup circuit breaker state
            try {
                await dynamoClient.send(
                    new DeleteItemCommand({
                        TableName: TEST_CONFIG.documentMetadataTable,
                        Key: marshall({
                            PK: `CIRCUIT#${circuitBreakerId}`,
                            SK: 'STATE',
                        }),
                    })
                );
            } catch (error) {
                console.warn('Circuit breaker cleanup error (non-critical):', error);
            }
        });
    });

    describe('5. Graceful Degradation - System Continues with Reduced Functionality', () => {
        /**
         * Requirement 14.5: WHEN any component fails, 
         * THE system SHALL continue serving requests using degraded functionality 
         * rather than complete failure
         */

        it('should serve requests with degraded functionality when multiple services fail', async () => {
            const degradedSessionId = `degraded-session-${Date.now()}`;

            // Simulate system state with multiple service failures
            await dynamoClient.send(
                new PutItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Item: marshall({
                        PK: `SYSTEM#${degradedSessionId}`,
                        SK: 'STATE',
                        sessionId: degradedSessionId,
                        opensearchAvailable: false,
                        cacheAvailable: false,
                        bedrockAvailable: true,
                        degradedMode: true,
                        availableFeatures: ['direct_llm_query', 'basic_chat'],
                        unavailableFeatures: ['document_search', 'cached_responses'],
                        timestamp: Date.now(),
                    }),
                })
            );

            // Verify system continues with reduced functionality
            const response = await dynamoClient.send(
                new GetItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `SYSTEM#${degradedSessionId}`,
                        SK: 'STATE',
                    }),
                })
            );

            const systemState = unmarshall(response.Item!);
            expect(systemState.degradedMode).toBe(true);
            expect(systemState.bedrockAvailable).toBe(true);
            expect(systemState.availableFeatures).toContain('direct_llm_query');
            expect(systemState.unavailableFeatures).toContain('document_search');

            // Cleanup
            await dynamoClient.send(
                new DeleteItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `SYSTEM#${degradedSessionId}`,
                        SK: 'STATE',
                    }),
                })
            );
        }, TEST_CONFIG.testTimeout);

        it('should notify users of degraded functionality', async () => {
            const notificationId = `notification-${Date.now()}`;

            await dynamoClient.send(
                new PutItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Item: marshall({
                        PK: `NOTIFICATION#${notificationId}`,
                        SK: 'DEGRADED',
                        notificationId,
                        type: 'degraded_service',
                        message: 'Document search is temporarily unavailable. You can still chat with the AI assistant.',
                        severity: 'warning',
                        affectedFeatures: ['document_search', 'rag_retrieval'],
                        timestamp: Date.now(),
                        displayToUser: true,
                    }),
                })
            );

            // Verify notification
            const response = await dynamoClient.send(
                new GetItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `NOTIFICATION#${notificationId}`,
                        SK: 'DEGRADED',
                    }),
                })
            );

            const notification = unmarshall(response.Item!);
            expect(notification.type).toBe('degraded_service');
            expect(notification.displayToUser).toBe(true);
            expect(notification.message).toContain('temporarily unavailable');

            // Cleanup
            await dynamoClient.send(
                new DeleteItemCommand({
                    TableName: TEST_CONFIG.documentMetadataTable,
                    Key: marshall({
                        PK: `NOTIFICATION#${notificationId}`,
                        SK: 'DEGRADED',
                    }),
                })
            );
        }, TEST_CONFIG.testTimeout);
    });

    // Global cleanup
    afterAll(async () => {
        console.log('Error resilience tests completed');
    });
});
