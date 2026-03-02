import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

const dynamoMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);

// Import handler after setting up mocks
import { handler } from './index.js';

describe('Document Upload Handler', () => {
    beforeEach(() => {
        dynamoMock.reset();
        s3Mock.reset();
        process.env.DOCUMENT_METADATA_TABLE = 'DocumentMetadata';
        process.env.DOCUMENTS_BUCKET = 'test-bucket';
    });

    const createEvent = (body: any, userId: string = 'user-123'): APIGatewayProxyEvent => ({
        body: JSON.stringify(body),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/documents/upload',
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {
            accountId: '123456789012',
            apiId: 'api-id',
            authorizer: { userId },
            protocol: 'HTTP/1.1',
            httpMethod: 'POST',
            identity: {
                accessKey: null,
                accountId: null,
                apiKey: null,
                apiKeyId: null,
                caller: null,
                clientCert: null,
                cognitoAuthenticationProvider: null,
                cognitoAuthenticationType: null,
                cognitoIdentityId: null,
                cognitoIdentityPoolId: null,
                principalOrgId: null,
                sourceIp: '1.2.3.4',
                user: null,
                userAgent: 'test-agent',
                userArn: null,
            },
            path: '/documents/upload',
            stage: 'test',
            requestId: 'test-request-id',
            requestTimeEpoch: Date.now(),
            resourceId: 'resource-id',
            resourcePath: '/documents/upload',
        },
        resource: '/documents/upload',
    });

    const createContext = (): Context => ({
        callbackWaitsForEmptyEventLoop: false,
        functionName: 'document-upload',
        functionVersion: '1',
        invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:document-upload',
        memoryLimitInMB: '1024',
        awsRequestId: 'test-request-id',
        logGroupName: '/aws/lambda/document-upload',
        logStreamName: '2024/01/01/[$LATEST]test',
        getRemainingTimeInMillis: () => 30000,
        done: () => { },
        fail: () => { },
        succeed: () => { },
    });

    describe('Validation', () => {
        it('should return 400 when request body is missing', async () => {
            const event = createEvent(null);
            event.body = null;
            const context = createContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body).error).toBe('Request body is required');
        });

        it('should return 400 when filename is missing', async () => {
            const event = createEvent({
                fileSize: 1024,
                contentType: 'application/pdf',
            });
            const context = createContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body).error).toContain('Filename is required');
        });

        it('should return 400 when fileSize exceeds 100MB', async () => {
            const event = createEvent({
                filename: 'test.pdf',
                fileSize: 101 * 1024 * 1024, // 101MB
                contentType: 'application/pdf',
            });
            const context = createContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body).error).toContain('exceeds maximum allowed size');
        });

        it('should return 400 when contentType is not application/pdf', async () => {
            const event = createEvent({
                filename: 'test.txt',
                fileSize: 1024,
                contentType: 'text/plain',
            });
            const context = createContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body).error).toContain('Only PDF files are supported');
        });
    });

    describe('Successful Upload', () => {
        it('should generate presigned URL and store metadata for valid request', async () => {
            dynamoMock.on(PutCommand).resolves({});

            const event = createEvent({
                filename: 'test-document.pdf',
                fileSize: 5 * 1024 * 1024, // 5MB
                contentType: 'application/pdf',
            });
            const context = createContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(200);

            const response = JSON.parse(result.body);
            expect(response.uploadUrl).toBeDefined();
            expect(response.documentId).toBeDefined();
            expect(response.expiresAt).toBeDefined();

            // Verify DynamoDB PutCommand was called
            const putCalls = dynamoMock.commandCalls(PutCommand);
            expect(putCalls.length).toBe(1);

            const putCall = putCalls[0];
            expect(putCall.args[0].input.TableName).toBe('DocumentMetadata');
            expect(putCall.args[0].input.Item).toMatchObject({
                documentId: response.documentId,
                filename: 'test-document.pdf',
                uploadedBy: 'user-123',
                fileSize: 5 * 1024 * 1024,
                processingStatus: 'pending',
            });
        });

        it('should generate unique documentId for each request', async () => {
            dynamoMock.on(PutCommand).resolves({});

            const event1 = createEvent({
                filename: 'doc1.pdf',
                fileSize: 1024,
                contentType: 'application/pdf',
            });
            const event2 = createEvent({
                filename: 'doc2.pdf',
                fileSize: 2048,
                contentType: 'application/pdf',
            });
            const context = createContext();

            const result1 = await handler(event1, context);
            const result2 = await handler(event2, context);

            const response1 = JSON.parse(result1.body);
            const response2 = JSON.parse(result2.body);

            expect(response1.documentId).not.toBe(response2.documentId);
        });
    });

    describe('Error Handling', () => {
        it('should return 500 when DynamoDB operation fails', async () => {
            dynamoMock.on(PutCommand).rejects(new Error('DynamoDB error'));

            const event = createEvent({
                filename: 'test.pdf',
                fileSize: 1024,
                contentType: 'application/pdf',
            });
            const context = createContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body).error).toBe('Internal server error');
        });
    });
});
