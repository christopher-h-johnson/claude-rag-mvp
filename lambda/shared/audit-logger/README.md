# Audit Logger

Structured audit logging utility for CloudWatch Logs. Provides comprehensive audit trail for compliance requirements.

## Features

- **Structured JSON Logging**: Consistent schema for all audit events
- **Separate Log Groups**: Different event types stored in dedicated log groups
- **CloudWatch Integration**: Seamless integration with AWS CloudWatch Logs
- **Tamper-Evident Storage**: Logs stored in CloudWatch with 365-day retention
- **Type-Safe**: Full TypeScript support with strict typing

## Requirements Validation

- **11.1**: Records user ID, action type, timestamp, and IP address for all user actions
- **11.2**: Logs all document uploads with file metadata and user identity
- **11.3**: Logs all Bedrock API calls with request and response metadata
- **11.4**: Stores logs in tamper-evident format using AWS CloudWatch Logs
- **11.5**: Retains logs for 365 days for compliance requirements

## Installation

```bash
npm install
npm run build
```

## Usage

### Basic Usage

```typescript
import { logUserAction, logAPICall, logDocumentOperation } from './audit-logger';

// Log user action
await logUserAction({
  eventType: 'login',
  userId: 'user-123',
  sessionId: 'session-456',
  timestamp: Date.now(),
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  metadata: { loginMethod: 'password' }
});

// Log API call
await logAPICall({
  service: 'bedrock',
  operation: 'InvokeModel',
  requestId: 'req-789',
  userId: 'user-123',
  timestamp: Date.now(),
  duration: 1250,
  statusCode: 200,
  tokenCount: 150
});

// Log document operation
await logDocumentOperation({
  operation: 'upload',
  documentId: 'doc-abc',
  documentName: 'report.pdf',
  userId: 'user-123',
  timestamp: Date.now(),
  fileSize: 1024000,
  status: 'success'
});
```

### Using the AuditLogger Class

```typescript
import { AuditLogger } from './audit-logger';

const logger = new AuditLogger({
  region: 'us-east-1',
  logGroupPrefix: '/aws/lambda/chatbot',
  consoleLogging: true
});

await logger.logUserAction({
  eventType: 'query',
  userId: 'user-123',
  sessionId: 'session-456',
  timestamp: Date.now(),
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
});
```

## Log Groups

The audit logger creates separate log groups for different event types:

- `/aws/lambda/chatbot/audit/user-actions` - User authentication and actions
- `/aws/lambda/chatbot/audit/api-calls` - API calls to external services
- `/aws/lambda/chatbot/audit/document-operations` - Document upload/delete/process operations

## CloudWatch Logs Insights Queries

### Query 1: User Login Activity

Find all login attempts for a specific user:

```
fields @timestamp, userId, ipAddress, userAgent, metadata
| filter eventType = "login"
| filter userId = "user-123"
| sort @timestamp desc
| limit 100
```

### Query 2: Failed Document Operations

Find all failed document operations:

```
fields @timestamp, operation, documentId, documentName, userId, errorMessage
| filter status = "failed"
| sort @timestamp desc
| limit 50
```

### Query 3: Bedrock API Usage by User

Calculate total Bedrock API calls and token usage per user:

```
fields userId, tokenCount
| filter service = "bedrock"
| stats count() as apiCalls, sum(tokenCount) as totalTokens by userId
| sort totalTokens desc
```

### Query 4: High-Latency API Calls

Find API calls that took longer than 2 seconds:

```
fields @timestamp, service, operation, userId, duration, statusCode
| filter duration > 2000
| sort duration desc
| limit 100
```

### Query 5: User Activity Timeline

Get a timeline of all actions for a specific user:

```
fields @timestamp, eventType, ipAddress, metadata
| filter userId = "user-123"
| sort @timestamp desc
| limit 200
```

### Query 6: Document Upload Volume

Calculate document upload volume by user:

```
fields userId, fileSize
| filter operation = "upload"
| stats count() as uploadCount, sum(fileSize) as totalBytes by userId
| sort totalBytes desc
```

### Query 7: Error Rate by Service

Calculate error rate for each service:

```
fields service, statusCode
| stats count() as total, 
        sum(statusCode >= 400) as errors 
        by service
| fields service, total, errors, (errors / total * 100) as errorRate
| sort errorRate desc
```

### Query 8: Recent User Actions

Get the most recent actions across all users:

```
fields @timestamp, eventType, userId, ipAddress
| sort @timestamp desc
| limit 50
```

### Query 9: Document Processing Success Rate

Calculate success rate for document processing:

```
fields operation, status
| filter operation = "process"
| stats count() as total,
        sum(status = "success") as successful
        by operation
| fields operation, total, successful, (successful / total * 100) as successRate
```

### Query 10: API Performance by Operation

Calculate average latency for each API operation:

```
fields service, operation, duration
| stats avg(duration) as avgLatency,
        max(duration) as maxLatency,
        min(duration) as minLatency,
        count() as callCount
        by service, operation
| sort avgLatency desc
```

## Log Retention

All log groups are configured with 365-day retention to meet compliance requirements (Requirement 11.5).

## Error Handling

The audit logger is designed to fail gracefully. If CloudWatch logging fails, the error is logged to console but does not throw an exception. This ensures that audit logging failures do not break application functionality.

## Testing

```bash
npm test
```

## Building

```bash
npm run build
```

The compiled JavaScript will be output to the `dist/` directory.

## Integration with Lambda Functions

In your Lambda function:

```typescript
import { logUserAction } from 'audit-logger';

export const handler = async (event: any) => {
  // Log the user action
  await logUserAction({
    eventType: 'query',
    userId: event.requestContext.authorizer.userId,
    sessionId: event.requestContext.authorizer.sessionId,
    timestamp: Date.now(),
    ipAddress: event.requestContext.identity.sourceIp,
    userAgent: event.requestContext.identity.userAgent
  });
  
  // Your handler logic...
};
```

## IAM Permissions Required

The Lambda execution role needs the following CloudWatch Logs permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": [
        "arn:aws:logs:*:*:log-group:/aws/lambda/chatbot/audit/*"
      ]
    }
  ]
}
```

## Terraform Configuration

Example Terraform configuration for log groups:

```hcl
resource "aws_cloudwatch_log_group" "user_actions" {
  name              = "/aws/lambda/chatbot/audit/user-actions"
  retention_in_days = 365

  tags = {
    Environment = "production"
    Purpose     = "audit-logging"
  }
}

resource "aws_cloudwatch_log_group" "api_calls" {
  name              = "/aws/lambda/chatbot/audit/api-calls"
  retention_in_days = 365

  tags = {
    Environment = "production"
    Purpose     = "audit-logging"
  }
}

resource "aws_cloudwatch_log_group" "document_operations" {
  name              = "/aws/lambda/chatbot/audit/document-operations"
  retention_in_days = 365

  tags = {
    Environment = "production"
    Purpose     = "audit-logging"
  }
}
```
