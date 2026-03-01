# PDF Text Extraction and Chunking Lambda Function

This Lambda function extracts text from PDF documents stored in S3 using the `pdfplumber` library, then chunks the text into token-counted segments for embedding generation. It handles complex layouts including tables and multi-column text, and stores the extracted text, chunks, and metadata in JSON format.

## Deployment Architecture

This function uses a **Lambda Layer** architecture for optimal deployment:

- **Lambda Function** (~50KB): Contains only application code (`index.py`)
- **Lambda Layer** (~45MB): Contains all Python dependencies (pdfplumber, tiktoken, boto3)

**Benefits**:
- Faster deployments (only code changes)
- Smaller package size
- Reusable dependencies
- Better cold start performance

**Important**: The layer must be built using Docker due to `tiktoken` requiring Rust compilation for Amazon Linux 2.

**Quick Start**:
```bash
# 1. Build the layer (required first step)
cd lambda/document-processor/extract-text
./build_layer_docker.sh  # Linux/Mac/Git Bash
# or
.\build_layer_docker.ps1  # Windows PowerShell

# 2. Deploy with Terraform
cd terraform
terraform apply
```

See [BUILD_INSTRUCTIONS.md](./BUILD_INSTRUCTIONS.md) for detailed build instructions and [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment guide.

## Features

- **Complex Layout Support**: Handles tables, multi-column text, and structured data
- **Page-by-Page Extraction**: Maintains page numbers for accurate citations
- **Table Detection**: Extracts and formats tables as readable text
- **Token-Based Chunking**: Splits text into 512 token chunks with 50 token overlap
- **Accurate Token Counting**: Uses tiktoken library with cl100k_base encoding (same as Claude/GPT-4)
- **Metadata Preservation**: Stores document metadata including filename, page count, and file size
- **Unique Chunk IDs**: Generates unique identifiers for each chunk
- **S3 Integration**: Automatically triggered by S3 events and stores results in S3

## Requirements Validation

- **Requirement 5.1**: Extracts text content within 30 seconds for documents under 10MB
- **Requirement 5.2**: Handles documents with complex layouts including tables and multi-column text
- **Requirement 5.4**: Chunks extracted text into segments of 512 tokens with 50 token overlap

## Architecture

```
S3 uploads/{documentId}/{filename}.pdf
    ↓ (S3 Event Trigger)
Lambda: extract-text
    ↓ (Downloads PDF)
pdfplumber Processing
    ↓ (Extracts text + tables)
tiktoken Chunking
    ↓ (512 tokens, 50 overlap)
S3 processed/{documentId}/
    ├── text.json (full text + metadata)
    ├── pages.json (page-by-page data)
    └── chunks.json (token-counted chunks)
```

## Input

The Lambda function is triggered by S3 events when a PDF is uploaded to the `uploads/` folder:

```json
{
  "Records": [
    {
      "s3": {
        "bucket": {
          "name": "chatbot-documents-{account-id}"
        },
        "object": {
          "key": "uploads/{documentId}/{filename}.pdf"
        }
      }
    }
  ]
}
```

## Output

### text.json

Stored at `processed/{documentId}/text.json`:

```json
{
  "text": "Full extracted text from all pages...",
  "pageCount": 10,
  "metadata": {
    "filename": "document.pdf",
    "uploadedBy": "system",
    "uploadedAt": 1234567890000,
    "fileSize": 1048576,
    "pageCount": 10
  },
  "extractedAt": 1234567890000
}
```

### pages.json

Stored at `processed/{documentId}/pages.json`:

```json
{
  "pages": [
    {
      "pageNumber": 1,
      "text": "Text from page 1...",
      "hasTable": true,
      "tableCount": 2
    },
    {
      "pageNumber": 2,
      "text": "Text from page 2...",
      "hasTable": false,
      "tableCount": 0
    }
  ],
  "totalPages": 2
}
```

### chunks.json

Stored at `processed/{documentId}/chunks.json`:

```json
{
  "chunks": [
    {
      "chunkId": "doc-123#chunk#0",
      "documentId": "doc-123",
      "text": "First chunk of text with approximately 512 tokens...",
      "chunkIndex": 0,
      "pageNumber": 1,
      "tokenCount": 512,
      "startToken": 0,
      "endToken": 512,
      "metadata": {
        "filename": "document.pdf",
        "uploadedBy": "system",
        "uploadedAt": 1234567890000,
        "pageCount": 10
      }
    },
    {
      "chunkId": "doc-123#chunk#1",
      "documentId": "doc-123",
      "text": "Second chunk with 50 token overlap from previous chunk...",
      "chunkIndex": 1,
      "pageNumber": 1,
      "tokenCount": 512,
      "startToken": 462,
      "endToken": 974,
      "metadata": {
        "filename": "document.pdf",
        "uploadedBy": "system",
        "uploadedAt": 1234567890000,
        "pageCount": 10
      }
    }
  ],
  "totalChunks": 15,
  "chunkedAt": 1234567890000
}
```

## Dependencies

- **pdfplumber**: PDF text extraction with layout support
- **boto3**: AWS SDK for S3 operations
- **tiktoken**: Token counting library for accurate chunking (cl100k_base encoding)

See `requirements.txt` for specific versions.

## Configuration

### Environment Variables

None required - the function uses IAM role permissions to access S3.

### IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::chatbot-documents-*/uploads/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::chatbot-documents-*/processed/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

### Lambda Configuration

- **Runtime**: Python 3.11 or later
- **Memory**: 1024 MB (recommended for processing large PDFs)
- **Timeout**: 300 seconds (5 minutes)
- **Handler**: index.handler

## Deployment

### Prerequisites

**Docker is required** to build the Lambda layer. The `tiktoken` package requires Rust compilation and must be built on Amazon Linux 2.

Install Docker Desktop:
- Windows: https://www.docker.com/products/docker-desktop
- Mac: https://www.docker.com/products/docker-desktop
- Linux: https://docs.docker.com/engine/install/

### Step 1: Build Lambda Layer

```bash
cd lambda/document-processor/extract-text

# Linux/Mac/Git Bash
./build_layer_docker.sh

# Windows PowerShell
.\build_layer_docker.ps1
```

This creates a `layer/` directory with all dependencies compiled for AWS Lambda.

Build time: 5-10 minutes (installs gcc, Rust, and compiles tiktoken)

### Step 2: Deploy with Terraform

```bash
cd terraform
terraform apply
```

Terraform will package the pre-built layer and deploy both the layer and function.

### Manual Deployment (Not Recommended)

If you need to deploy without Terraform:

1. Build the layer (see Step 1 above)

2. Package and upload the layer:
   ```bash
   cd lambda/document-processor/extract-text
   zip -r layer.zip layer/
   
   aws lambda publish-layer-version \
     --layer-name chatbot-document-processor-deps \
     --zip-file fileb://layer.zip \
     --compatible-runtimes python3.11
   ```

3. Package and deploy the function:
   ```bash
   zip function.zip index.py
   
   aws lambda update-function-code \
     --function-name extract-text \
     --zip-file fileb://function.zip
   
   aws lambda update-function-configuration \
     --function-name extract-text \
     --layers LAYER_ARN_FROM_STEP_2
   ```

See [BUILD_INSTRUCTIONS.md](./BUILD_INSTRUCTIONS.md) for detailed build instructions and troubleshooting.

## Testing

### Local Testing

Create a test event file `test-event.json`:

```json
{
  "Records": [
    {
      "s3": {
        "bucket": {
          "name": "your-test-bucket"
        },
        "object": {
          "key": "uploads/test-doc-id/sample.pdf"
        }
      }
    }
  ]
}
```

Run locally (requires AWS credentials):

```bash
python -c "
import json
from index import handler

with open('test-event.json') as f:
    event = json.load(f)

class Context:
    request_id = 'test-request-id'

result = handler(event, Context())
print(json.dumps(result, indent=2))
"
```

## Error Handling

The function includes comprehensive error handling:

- **Download Errors**: Logs error and continues to next document
- **PDF Parsing Errors**: Logs error for specific page, continues with remaining pages
- **S3 Upload Errors**: Logs error and raises exception
- **Invalid PDF Format**: Logs error and continues to next document

Failed documents should be monitored via CloudWatch Logs.

## Performance

- **Small PDFs (< 1MB)**: ~2-5 seconds
- **Medium PDFs (1-10MB)**: ~5-20 seconds
- **Large PDFs (10-100MB)**: ~20-60 seconds

Performance depends on:
- PDF complexity (number of images, tables, fonts)
- Page count
- Lambda memory allocation

## Monitoring

### CloudWatch Metrics

- **Invocations**: Number of times function is triggered
- **Duration**: Execution time per invocation
- **Errors**: Failed invocations
- **Throttles**: Rate-limited invocations

### CloudWatch Logs

All processing details are logged:
- Document processing start/completion
- Page extraction progress
- Table detection
- Storage operations
- Errors and exceptions

### Custom Metrics

Consider adding custom metrics for:
- Pages processed per invocation
- Average processing time per page
- Table detection rate
- Error rate by error type

## Troubleshooting

### Common Issues

**Issue**: Lambda timeout
- **Solution**: Increase timeout or memory allocation

**Issue**: Out of memory error
- **Solution**: Increase Lambda memory (try 2048 MB or 3008 MB)

**Issue**: PDF parsing fails
- **Solution**: Check PDF format - some encrypted or corrupted PDFs cannot be processed

**Issue**: Missing text in output
- **Solution**: Some PDFs use images instead of text - consider adding OCR support

## Future Enhancements

- [ ] Add OCR support for scanned PDFs (using Textract)
- [ ] Implement parallel page processing for large documents
- [ ] Add support for password-protected PDFs
- [ ] Extract and preserve document structure (headings, lists)
- [ ] Add image extraction and description
- [ ] Implement progress tracking for long-running extractions
