# Document List Lambda Function

This Lambda function handles GET /documents requests to retrieve a paginated list of documents uploaded by the authenticated user.

## Features

- Query DocumentMetadata table by uploadedBy using GSI
- Return paginated list with documentId, filename, uploadedAt, pageCount, status
- Support nextToken for pagination
- Default limit: 50 documents per page
- Maximum limit: 100 documents per page

## Environment Variables

- `DOCUMENT_METADATA_TABLE`: Name of the DocumentMetadata DynamoDB table

## API

### GET /documents

Query parameters:
- `limit` (optional): Number of documents to return (default: 50, max: 100)
- `nextToken` (optional): Pagination token from previous response

Response:
```json
{
  "documents": [
    {
      "documentId": "uuid",
      "filename": "document.pdf",
      "uploadedAt": 1234567890,
      "pageCount": 10,
      "status": "completed"
    }
  ],
  "nextToken": "base64-encoded-token"
}
```

## Build

```bash
npm install
npm run build
```

## Test

```bash
npm test
```
