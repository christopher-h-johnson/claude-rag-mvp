# Document Delete Endpoint Lambda

This Lambda function handles document deletion requests via the REST API.

## Endpoint

**DELETE /documents/{documentId}**

## Functionality

The handler performs the following operations:

1. **Validates the documentId** from the path parameter (must be a valid UUID)
2. **Verifies user permission** - checks that the uploadedBy field matches the requesting userId
3. **Deletes document files from S3** - removes files from both `uploads/` and `processed/` folders
4. **Deletes embeddings from OpenSearch** - removes all chunks associated with the documentId
5. **Deletes DocumentMetadata record** from DynamoDB
6. **Logs the deletion operation** to the audit log

## Requirements

Validates: Requirements 4.1, 11.2

## Environment Variables

- `DOCUMENT_METADATA_TABLE` - DynamoDB table name for document metadata (default: 'DocumentMetadata')
- `DOCUMENTS_BUCKET` - S3 bucket name for document storage
- `OPENSEARCH_ENDPOINT` - OpenSearch domain endpoint (without https://)
- `OPENSEARCH_INDEX` - OpenSearch index name (default: 'documents')
- `AWS_REGION` - AWS region for service clients

## Request

Path parameter:
- `documentId` - UUID of the document to delete

Authorization:
- Requires valid session token via Lambda Authorizer
- User must be the owner of the document (uploadedBy must match userId)

## Response

### Success (200)
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

### Errors

**400 Bad Request** - Invalid or missing documentId
```json
{
  "error": "Document ID is required"
}
```

**401 Unauthorized** - Missing or invalid authentication
```json
{
  "error": "Unauthorized"
}
```

**403 Forbidden** - User does not own the document
```json
{
  "error": "Permission denied: You can only delete your own documents"
}
```

**404 Not Found** - Document does not exist
```json
{
  "error": "Document not found"
}
```

**500 Internal Server Error** - Server error during deletion
```json
{
  "error": "Internal server error"
}
```

## Dependencies

- `@aws-sdk/client-dynamodb` - DynamoDB operations
- `@aws-sdk/lib-dynamodb` - DynamoDB Document Client
- `@aws-sdk/client-s3` - S3 operations
- `@opensearch-project/opensearch` - OpenSearch operations
- Shared modules:
  - `audit-logger` - Audit logging functionality
  - `vector-store` - OpenSearch vector store client

## Build

```bash
npm run build
```

This compiles TypeScript to JavaScript and prepares the deployment package in the `dist/` directory.

## Test

```bash
npm test
```

Runs the Jest test suite.

## Deployment

The Lambda function should be deployed with:
- Appropriate IAM role with permissions for:
  - DynamoDB GetItem and DeleteItem on DocumentMetadata table
  - S3 ListObjects and DeleteObject on documents bucket
  - OpenSearch delete operations
  - CloudWatch Logs write permissions
- VPC configuration for OpenSearch access (if in VPC)
- Environment variables configured
- API Gateway integration with DELETE method on `/documents/{documentId}` route
- Lambda Authorizer for authentication

## Security

- Validates user ownership before deletion (uploadedBy must match userId)
- Validates documentId format (UUID)
- Logs all deletion attempts (success and failure) to audit log
- Uses least privilege IAM permissions
- CORS headers configured for browser access
