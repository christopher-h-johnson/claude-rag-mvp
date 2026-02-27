/**
 * Example usage of the Audit Logger
 * 
 * This file demonstrates how to use the audit logger in Lambda functions
 */

import {
    logUserAction,
    logAPICall,
    logDocumentOperation,
    AuditLogger,
    UserActionEvent,
    APICallEvent,
    DocumentOperationEvent,
} from '../src/index';

/**
 * Example 1: Logging user login action
 */
async function exampleUserLogin() {
    const event: UserActionEvent = {
        eventType: 'login',
        userId: 'user-12345',
        sessionId: 'session-67890',
        timestamp: Date.now(),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        metadata: {
            loginMethod: 'password',
            mfaEnabled: true,
        },
    };

    await logUserAction(event);
    console.log('User login logged successfully');
}

/**
 * Example 2: Logging user query action
 */
async function exampleUserQuery() {
    const event: UserActionEvent = {
        eventType: 'query',
        userId: 'user-12345',
        sessionId: 'session-67890',
        timestamp: Date.now(),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        metadata: {
            queryText: 'What is the company policy on remote work?',
            queryLength: 45,
            ragEnabled: true,
        },
    };

    await logUserAction(event);
    console.log('User query logged successfully');
}

/**
 * Example 3: Logging Bedrock API call
 */
async function exampleBedrockAPICall() {
    const startTime = Date.now();

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1250));

    const event: APICallEvent = {
        service: 'bedrock',
        operation: 'InvokeModel',
        requestId: 'req-abc123',
        userId: 'user-12345',
        timestamp: startTime,
        duration: Date.now() - startTime,
        statusCode: 200,
        tokenCount: 150,
    };

    await logAPICall(event);
    console.log('Bedrock API call logged successfully');
}

/**
 * Example 4: Logging OpenSearch query
 */
async function exampleOpenSearchQuery() {
    const startTime = Date.now();

    // Simulate search
    await new Promise(resolve => setTimeout(resolve, 180));

    const event: APICallEvent = {
        service: 'opensearch',
        operation: 'search',
        requestId: 'req-def456',
        userId: 'user-12345',
        timestamp: startTime,
        duration: Date.now() - startTime,
        statusCode: 200,
    };

    await logAPICall(event);
    console.log('OpenSearch query logged successfully');
}

/**
 * Example 5: Logging document upload
 */
async function exampleDocumentUpload() {
    const event: DocumentOperationEvent = {
        operation: 'upload',
        documentId: 'doc-xyz789',
        documentName: 'company-handbook.pdf',
        userId: 'user-12345',
        timestamp: Date.now(),
        fileSize: 2048576, // 2MB
        status: 'success',
    };

    await logDocumentOperation(event);
    console.log('Document upload logged successfully');
}

/**
 * Example 6: Logging failed document processing
 */
async function exampleFailedDocumentProcessing() {
    const event: DocumentOperationEvent = {
        operation: 'process',
        documentId: 'doc-xyz789',
        documentName: 'corrupted-file.pdf',
        userId: 'user-12345',
        timestamp: Date.now(),
        fileSize: 5242880, // 5MB
        status: 'failed',
        errorMessage: 'PDF parsing error: Invalid PDF structure',
    };

    await logDocumentOperation(event);
    console.log('Failed document processing logged successfully');
}

/**
 * Example 7: Using AuditLogger class directly with custom configuration
 */
async function exampleCustomLogger() {
    const logger = new AuditLogger({
        region: 'us-west-2',
        logGroupPrefix: '/aws/lambda/my-custom-app',
        consoleLogging: true,
    });

    await logger.logUserAction({
        eventType: 'logout',
        userId: 'user-12345',
        sessionId: 'session-67890',
        timestamp: Date.now(),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    console.log('Custom logger used successfully');
}

/**
 * Example 8: Lambda handler with audit logging
 */
export const lambdaHandler = async (event: any, context: any) => {
    const userId = event.requestContext?.authorizer?.userId || 'anonymous';
    const sessionId = event.requestContext?.authorizer?.sessionId || 'no-session';
    const ipAddress = event.requestContext?.identity?.sourceIp || 'unknown';
    const userAgent = event.requestContext?.identity?.userAgent || 'unknown';

    try {
        // Log the incoming request
        await logUserAction({
            eventType: 'query',
            userId,
            sessionId,
            timestamp: Date.now(),
            ipAddress,
            userAgent,
            metadata: {
                requestId: context.requestId,
                path: event.path,
                method: event.httpMethod,
            },
        });

        // Process the request
        const result = await processRequest(event);

        // Log successful API call
        await logAPICall({
            service: 'bedrock',
            operation: 'InvokeModel',
            requestId: context.requestId,
            userId,
            timestamp: Date.now(),
            duration: 1200,
            statusCode: 200,
            tokenCount: result.tokenCount,
        });

        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    } catch (error: any) {
        // Log failed API call
        await logAPICall({
            service: 'bedrock',
            operation: 'InvokeModel',
            requestId: context.requestId,
            userId,
            timestamp: Date.now(),
            duration: 500,
            statusCode: 500,
        });

        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

async function processRequest(event: any): Promise<any> {
    // Simulate request processing
    return {
        message: 'Request processed successfully',
        tokenCount: 150,
    };
}

/**
 * Run all examples
 */
async function runAllExamples() {
    console.log('Running audit logger examples...\n');

    await exampleUserLogin();
    await exampleUserQuery();
    await exampleBedrockAPICall();
    await exampleOpenSearchQuery();
    await exampleDocumentUpload();
    await exampleFailedDocumentProcessing();
    await exampleCustomLogger();

    console.log('\nAll examples completed successfully!');
}

// Run examples if this file is executed directly
if (require.main === module) {
    runAllExamples().catch(console.error);
}
