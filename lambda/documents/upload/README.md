# Document Upload Handler

Lambda function that handles document upload requests by generating S3 presigned URLs for direct browser-to-S3 uploads.

## Overview

This Lambda function implements the `POST /documents/upload` endpoint. Instead of uploading files through the Lambda function (which has payload size limits), it generates presigned S3 URLs that allow clients to upload files directly to S3.

## Features

- **Request Validation**: Validates filename, file size (max 100MB), and content type (PDF only)
- **Presigned URL Generation**: Creates S3 presigned URLs with 15-minute expiration
- **Metadata Storage**: Stores document metadata in DynamoDB with `pending` status
- **Audit Logging**: Logs all upload operations for compliance
- **CORS Support**: Includes CORS headers for browser access

## API Specification

### Request

```http
POST /documents/upload
Content-Type: application/json
Authorization: Bearer <token>

{
  "filename": "document.pdf",
  "fileSize": 5242880,
  "contentType": "application/pdf"
}
```

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "uploadUrl": "https://s3.amazonaws.com/bucket/uploads/doc-id/document.pdf?...",
  "documentId": "550e8400-e29b-41d4-a716-446655440000",
  "expiresAt": 1704067200000
}
```

### Error Responses

- `400 Bad Request`: Invalid request (missing fields, wrong content type, file too large)
- `401 Unauthorized`: Missing or invalid authentication
- `500 Internal Server Error`: Server-side error

## Environment Variables

- `DOCUMENT_METADATA_TABLE`: DynamoDB table name for document metadata (default: `DocumentMetadata`)
- `DOCUMENTS_BUCKET`: S3 bucket name for document storage (required)

## Validation Rules

1. **Filename**: Required, non-empty string
2. **File Size**: Required, positive number, max 100MB (104,857,600 bytes)
3. **Content Type**: Must be `application/pdf`
4. **Authentication**: User ID must be present in authorizer context

## S3 Key Structure

Documents are stored with the following key pattern:
```
uploads/{documentId}/{filename}
```

Example: `uploads/550e8400-e29b-41d4-a716-446655440000/document.pdf`

## DynamoDB Schema

The function creates records in the `DocumentMetadata` table:

```typescript
{
  PK: "DOC#<documentId>",
  SK: "METADATA",
  documentId: string,
  filename: string,
  s3Key: string,
  uploadedBy: string,
  uploadedAt: number,
  fileSize: number,
  pageCount: 0,
  chunkCount: 0,
  processingStatus: "pending"
}
```

## Client Upload Flow

1. Client calls `POST /documents/upload` with file metadata
2. Server validates request and generates presigned URL
3. Server stores metadata in DynamoDB with `pending` status
4. Server returns presigned URL to client
5. Client uploads file directly to S3 using presigned URL
6. S3 event triggers document processing pipeline

## Building

```bash
npm install
npm run build
```

## Testing

```bash
npm test
```

## Deployment

The Lambda function is deployed via Terraform. See `terraform/modules/rest-api/` for infrastructure configuration.

## Requirements Satisfied

- **Requirement 4.1**: Document upload with S3 storage and encryption
- **Requirement 4.2**: File size validation (max 100MB)

## Related Components

- **Document Processor**: Triggered by S3 events after upload completes
- **Audit Logger**: Logs document operations
- **API Gateway**: Routes requests to this handler
- **Lambda Authorizer**: Validates authentication before invocation
