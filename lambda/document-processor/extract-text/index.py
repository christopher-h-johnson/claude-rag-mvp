"""
PDF Text Extraction and Chunking Lambda Function

This Lambda function extracts text from PDF documents stored in S3 using pdfplumber,
then chunks the text into token-counted segments for embedding generation.

Features:
- Extracts text from PDFs with complex layouts (tables, multi-column text)
- Chunks text into 512 token segments with 50 token overlap
- Uses tiktoken (cl100k_base encoding) for accurate token counting
- Preserves page numbers and chunk indices in metadata
- Generates unique chunkId for each chunk
- Stores extracted text and chunks in S3 processed/ folder

Validates Requirements: 5.1, 5.2, 5.4
"""

import json
import logging
import os
import uuid
from datetime import datetime
from io import BytesIO
from typing import Dict, List, Any, Optional
from urllib.parse import unquote_plus

import boto3
import pdfplumber
import tiktoken

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
sns_client = boto3.client('sns')
lambda_client = boto3.client('lambda')

# Environment variables
DOCUMENT_METADATA_TABLE = os.environ.get('DOCUMENT_METADATA_TABLE', 'dev-chatbot-document-metadata')
FAILED_PROCESSING_SNS_TOPIC = os.environ.get('FAILED_PROCESSING_SNS_TOPIC', '')
EMBEDDING_GENERATOR_LAMBDA = os.environ.get('EMBEDDING_GENERATOR_LAMBDA', '')

# Initialize DynamoDB table
document_metadata_table = dynamodb.Table(DOCUMENT_METADATA_TABLE)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for S3 event-triggered PDF text extraction.
    
    Args:
        event: S3 event containing bucket and object information
        context: Lambda context object
        
    Returns:
        Response with processing status
    """
    logger.info(f"PDF text extraction triggered - RequestId: {context.aws_request_id}")
    
    processed_count = 0
    failed_count = 0
    
    for record in event.get('Records', []):
        bucket = None
        key = None
        document_id = None
        
        try:
            # Extract S3 bucket and key from event
            bucket = record['s3']['bucket']['name']
            key = unquote_plus(record['s3']['object']['key'])
            
            # Only process files in uploads/ folder
            if not key.startswith('uploads/'):
                logger.info(f"Skipping non-upload file: {key}")
                continue
            
            # Extract document ID from key (uploads/{documentId}/{filename}.pdf)
            key_parts = key.split('/')
            document_id = key_parts[1] if len(key_parts) > 1 else 'unknown'
            
            logger.info(f"Processing document: s3://{bucket}/{key} (documentId: {document_id})")
            
            # Update status to 'processing'
            update_document_status(document_id, 'processing', bucket, key)
            
            # Extract text from PDF
            result = extract_text(bucket, key)
            
            # Update status to 'completed'
            update_document_status(
                document_id, 
                'completed', 
                bucket, 
                key,
                chunk_count=result.get('chunkCount', 0),
                page_count=result.get('pageCount', 0)
            )
            
            logger.info(f"Document processed successfully: {key} - {result['pageCount']} pages, {result.get('chunkCount', 0)} chunks")
            processed_count += 1
            
        except Exception as error:
            error_message = f"Failed to process document {key}: {str(error)}"
            logger.error(error_message, exc_info=True)
            failed_count += 1
            
            # Handle the failure
            if bucket and key and document_id:
                try:
                    handle_processing_failure(bucket, key, document_id, error)
                except Exception as handle_error:
                    logger.error(f"Failed to handle processing failure for {key}: {str(handle_error)}", exc_info=True)
            
            # Continue processing other documents instead of failing completely
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'processed': processed_count,
            'failed': failed_count
        })
    }


def extract_text(bucket: str, key: str) -> Dict[str, Any]:
    """
    Extract text from PDF stored in S3.
    
    Args:
        bucket: S3 bucket name
        key: S3 object key
        
    Returns:
        Dictionary containing extracted text and metadata
        
    Raises:
        Exception: If PDF processing fails
    """
    # Download PDF from S3
    logger.info(f"Downloading PDF from s3://{bucket}/{key}")
    pdf_bytes = download_from_s3(bucket, key)
    
    # Extract document ID and filename from key
    # Expected format: uploads/{documentId}/{filename}.pdf
    key_parts = key.split('/')
    document_id = key_parts[1] if len(key_parts) > 1 else 'unknown'
    filename = key_parts[-1] if key_parts else 'unknown.pdf'
    
    # Extract text using pdfplumber
    logger.info(f"Extracting text from PDF: {filename}")
    pages_data = extract_text_from_pdf(pdf_bytes)
    
    # Combine all page text
    full_text = '\n\n'.join(page['text'] for page in pages_data)
    
    # Build metadata
    metadata = {
        'filename': filename,
        'uploadedBy': 'system',  # This should be populated from document metadata
        'uploadedAt': int(datetime.now().timestamp() * 1000),
        'fileSize': len(pdf_bytes),
        'pageCount': len(pages_data)
    }
    
    extracted_text = {
        'text': full_text,
        'pageCount': len(pages_data),
        'metadata': metadata
    }
    
    # Store extracted text in S3 processed/ folder
    store_extracted_text(bucket, document_id, extracted_text, pages_data)
    
    # Chunk the text with token counting
    logger.info(f"Chunking text for document: {document_id}")
    chunks = chunk_text(full_text, pages_data, document_id, metadata, chunk_size=512, overlap=50)
    
    # Store chunks in S3
    chunks_key = store_chunks(bucket, document_id, chunks)
    
    # Invoke Embedding Generator Lambda
    logger.info(f"Invoking Embedding Generator for document: {document_id}")
    invoke_embedding_generator(bucket, document_id, chunks_key)
    
    return {
        'text': extracted_text['text'],
        'pageCount': extracted_text['pageCount'],
        'metadata': extracted_text['metadata'],
        'chunkCount': len(chunks)
    }


def download_from_s3(bucket: str, key: str) -> bytes:
    """
    Download PDF file from S3.
    
    Args:
        bucket: S3 bucket name
        key: S3 object key
        
    Returns:
        PDF file content as bytes
    """
    response = s3_client.get_object(Bucket=bucket, Key=key)
    return response['Body'].read()


def extract_text_from_pdf(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Extract text from PDF using pdfplumber with support for complex layouts.
    
    This function handles:
    - Tables and structured data
    - Multi-column layouts
    - Page numbers and metadata
    
    Args:
        pdf_bytes: PDF file content as bytes
        
    Returns:
        List of dictionaries containing page number and extracted text
    """
    pages_data = []
    
    # Use pdfplumber to open and process the PDF
    # Wrap bytes in BytesIO to provide file-like interface
    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        logger.info(f"PDF opened successfully - {len(pdf.pages)} pages")
        
        for page_num, page in enumerate(pdf.pages, start=1):
            try:
                # Extract text with layout preservation
                # pdfplumber maintains spatial layout which helps with multi-column text
                text = page.extract_text(layout=True) or ''
                
                # Extract tables separately for better structure
                tables = page.extract_tables()
                
                # If tables exist, append them as formatted text
                if tables:
                    table_text = format_tables(tables)
                    if table_text:
                        text += '\n\n' + table_text
                
                pages_data.append({
                    'pageNumber': page_num,
                    'text': text.strip(),
                    'hasTable': len(tables) > 0,
                    'tableCount': len(tables)
                })
                
                logger.debug(f"Extracted page {page_num}: {len(text)} characters, {len(tables)} tables")
                
            except Exception as error:
                logger.error(f"Error extracting text from page {page_num}: {str(error)}")
                # Add empty page data to maintain page numbering
                pages_data.append({
                    'pageNumber': page_num,
                    'text': '',
                    'error': str(error)
                })
    
    return pages_data


def format_tables(tables: List[List[List[Optional[str]]]]) -> str:
    """
    Format extracted tables as readable text.
    
    Args:
        tables: List of tables, where each table is a list of rows
        
    Returns:
        Formatted table text
    """
    formatted_tables = []
    
    for table_idx, table in enumerate(tables, start=1):
        if not table:
            continue
        
        table_lines = [f"[Table {table_idx}]"]
        
        for row in table:
            # Filter out None values and join cells with | separator
            cells = [str(cell).strip() if cell else '' for cell in row]
            row_text = ' | '.join(cells)
            if row_text.strip():
                table_lines.append(row_text)
        
        formatted_tables.append('\n'.join(table_lines))
    
    return '\n\n'.join(formatted_tables)


def chunk_text(
    text: str,
    pages_data: List[Dict[str, Any]],
    document_id: str,
    metadata: Dict[str, Any],
    chunk_size: int = 512,
    overlap: int = 50
) -> List[Dict[str, Any]]:
    """
    Chunk text into segments with token counting and overlap.
    
    Uses tiktoken library for accurate token counting with cl100k_base encoding
    (same encoding used by Claude and GPT-4). Creates chunks of specified token
    size with overlap to preserve context across chunk boundaries.
    
    Args:
        text: Full text to chunk
        pages_data: Page-by-page text data with page numbers
        document_id: Unique document identifier
        metadata: Document metadata
        chunk_size: Target size of each chunk in tokens (default: 512)
        overlap: Number of overlapping tokens between chunks (default: 50)
        
    Returns:
        List of chunk dictionaries with text, metadata, and unique IDs
        
    Validates Requirements: 5.4
    """
    # Initialize tiktoken encoder with cl100k_base encoding
    # This is the encoding used by Claude and GPT-4 models
    try:
        encoding = tiktoken.get_encoding("cl100k_base")
    except Exception as error:
        logger.error(f"Failed to load tiktoken encoding: {str(error)}")
        raise
    
    # Build a mapping of character positions to page numbers
    page_map = build_page_map(pages_data)
    
    # Encode the full text to tokens
    tokens = encoding.encode(text)
    total_tokens = len(tokens)
    
    logger.info(f"Text encoded to {total_tokens} tokens, creating chunks of {chunk_size} with {overlap} overlap")
    
    chunks = []
    chunk_index = 0
    start_pos = 0
    
    while start_pos < total_tokens:
        # Calculate end position for this chunk
        end_pos = min(start_pos + chunk_size, total_tokens)
        
        # Extract tokens for this chunk
        chunk_tokens = tokens[start_pos:end_pos]
        
        # Decode tokens back to text
        chunk_text = encoding.decode(chunk_tokens)
        
        # Determine page number for this chunk
        # Use the character position in the original text to find the page
        char_pos = len(encoding.decode(tokens[:start_pos]))
        page_number = get_page_number_for_position(char_pos, page_map)
        
        # Generate unique chunk ID
        chunk_id = f"{document_id}#chunk#{chunk_index}"
        
        # Create chunk object
        chunk = {
            'chunkId': chunk_id,
            'documentId': document_id,
            'text': chunk_text,
            'chunkIndex': chunk_index,
            'pageNumber': page_number,
            'tokenCount': len(chunk_tokens),
            'startToken': start_pos,
            'endToken': end_pos,
            'metadata': {
                'filename': metadata.get('filename', 'unknown.pdf'),
                'uploadedBy': metadata.get('uploadedBy', 'system'),
                'uploadedAt': metadata.get('uploadedAt', 0),
                'pageCount': metadata.get('pageCount', 0)
            }
        }
        
        chunks.append(chunk)
        
        logger.debug(f"Created chunk {chunk_index}: {len(chunk_tokens)} tokens, page {page_number}")
        
        chunk_index += 1
        
        # Move start position forward by (chunk_size - overlap) to create overlap
        # If we're at the end, break to avoid infinite loop
        if end_pos >= total_tokens:
            break
        
        start_pos = start_pos + chunk_size - overlap
    
    logger.info(f"Created {len(chunks)} chunks from {total_tokens} tokens")
    
    return chunks


def build_page_map(pages_data: List[Dict[str, Any]]) -> List[Dict[str, int]]:
    """
    Build a mapping of character positions to page numbers.
    
    Args:
        pages_data: Page-by-page text data
        
    Returns:
        List of dictionaries with start_pos, end_pos, and page_number
    """
    page_map = []
    current_pos = 0
    
    for page in pages_data:
        page_text = page.get('text', '')
        page_number = page.get('pageNumber', 1)
        
        # Account for the '\n\n' separator between pages
        if current_pos > 0:
            current_pos += 2  # Length of '\n\n'
        
        start_pos = current_pos
        end_pos = current_pos + len(page_text)
        
        page_map.append({
            'start_pos': start_pos,
            'end_pos': end_pos,
            'page_number': page_number
        })
        
        current_pos = end_pos
    
    return page_map


def get_page_number_for_position(char_pos: int, page_map: List[Dict[str, int]]) -> int:
    """
    Find the page number for a given character position.
    
    Args:
        char_pos: Character position in the full text
        page_map: Mapping of character positions to page numbers
        
    Returns:
        Page number (1-indexed)
    """
    for page_info in page_map:
        if page_info['start_pos'] <= char_pos < page_info['end_pos']:
            return page_info['page_number']
    
    # If position is beyond all pages, return the last page number
    if page_map:
        return page_map[-1]['page_number']
    
    return 1  # Default to page 1


def store_chunks(bucket: str, document_id: str, chunks: List[Dict[str, Any]]) -> str:
    """
    Store text chunks in S3 processed/ folder as JSON.
    
    Args:
        bucket: S3 bucket name
        document_id: Unique document identifier
        chunks: List of text chunks with metadata
        
    Returns:
        S3 key where chunks were stored
    """
    chunks_key = f"processed/{document_id}/chunks.json"
    chunks_content = {
        'chunks': chunks,
        'totalChunks': len(chunks),
        'chunkedAt': int(datetime.now().timestamp() * 1000)
    }
    
    s3_client.put_object(
        Bucket=bucket,
        Key=chunks_key,
        Body=json.dumps(chunks_content, indent=2),
        ContentType='application/json'
    )
    
    logger.info(f"Stored {len(chunks)} chunks: s3://{bucket}/{chunks_key}")
    
    return chunks_key


def store_extracted_text(
    bucket: str,
    document_id: str,
    extracted_text: Dict[str, Any],
    pages_data: List[Dict[str, Any]]
) -> None:
    """
    Store extracted text in S3 processed/ folder as JSON.
    
    Args:
        bucket: S3 bucket name
        document_id: Unique document identifier
        extracted_text: Complete extracted text with metadata
        pages_data: Page-by-page text data
    """
    # Store full extracted text as JSON
    text_key = f"processed/{document_id}/text.json"
    text_content = {
        'text': extracted_text['text'],
        'pageCount': extracted_text['pageCount'],
        'metadata': extracted_text['metadata'],
        'extractedAt': int(datetime.now().timestamp() * 1000)
    }
    
    s3_client.put_object(
        Bucket=bucket,
        Key=text_key,
        Body=json.dumps(text_content, indent=2),
        ContentType='application/json'
    )
    
    logger.info(f"Stored extracted text: s3://{bucket}/{text_key}")
    
    # Store page-by-page text for reference
    pages_key = f"processed/{document_id}/pages.json"
    pages_content = {
        'pages': pages_data,
        'totalPages': len(pages_data)
    }
    
    s3_client.put_object(
        Bucket=bucket,
        Key=pages_key,
        Body=json.dumps(pages_content, indent=2),
        ContentType='application/json'
    )
    
    logger.info(f"Stored page data: s3://{bucket}/{pages_key}")


def update_document_status(
    document_id: str,
    status: str,
    bucket: str,
    s3_key: str,
    chunk_count: int = 0,
    page_count: int = 0,
    error_message: Optional[str] = None
) -> None:
    """
    Update document processing status in DynamoDB DocumentMetadata table.
    
    Args:
        document_id: Unique document identifier
        status: Processing status ('pending', 'processing', 'completed', 'failed')
        bucket: S3 bucket name
        s3_key: S3 object key
        chunk_count: Number of chunks created (for completed status)
        page_count: Number of pages in document (for completed status)
        error_message: Error message (for failed status)
        
    Validates Requirements: 5.3, 14.3
    """
    try:
        # Extract filename from S3 key
        filename = s3_key.split('/')[-1] if s3_key else 'unknown.pdf'
        
        # Build update expression and attribute values
        update_expression = "SET processingStatus = :status, updatedAt = :updated_at"
        expression_values = {
            ':status': status,
            ':updated_at': int(datetime.now().timestamp() * 1000)
        }
        
        # Add optional fields based on status
        if status == 'completed':
            update_expression += ", chunkCount = :chunk_count, pageCount = :page_count"
            expression_values[':chunk_count'] = chunk_count
            expression_values[':page_count'] = page_count
        elif status == 'failed' and error_message:
            update_expression += ", errorMessage = :error_message"
            expression_values[':error_message'] = error_message
        
        # Update DynamoDB record
        document_metadata_table.update_item(
            Key={
                'PK': f"DOC#{document_id}",
                'SK': 'METADATA'
            },
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values
        )
        
        logger.info(f"Updated document status: {document_id} -> {status}")
        
    except Exception as error:
        logger.error(f"Failed to update document status in DynamoDB: {str(error)}", exc_info=True)
        # Don't raise - this is a non-critical operation


def handle_processing_failure(
    bucket: str,
    s3_key: str,
    document_id: str,
    error: Exception
) -> None:
    """
    Handle document processing failure by moving to failed/ folder and notifying.
    
    This function implements the dead-letter queue pattern by:
    1. Moving the failed document to S3 failed/ folder
    2. Creating an error.json file with failure details
    3. Updating DocumentMetadata table with failed status
    4. Sending SNS notification to alert administrators
    
    Args:
        bucket: S3 bucket name
        s3_key: Original S3 object key (uploads/{documentId}/{filename}.pdf)
        document_id: Unique document identifier
        error: Exception that caused the failure
        
    Validates Requirements: 5.3, 14.3
    """
    try:
        filename = s3_key.split('/')[-1] if s3_key else 'unknown.pdf'
        
        logger.info(f"Handling processing failure for document: {document_id}")
        
        # 1. Move failed document to failed/ folder
        failed_key = f"failed/{document_id}/{filename}"
        
        try:
            # Copy document to failed/ folder
            s3_client.copy_object(
                Bucket=bucket,
                CopySource={'Bucket': bucket, 'Key': s3_key},
                Key=failed_key
            )
            logger.info(f"Copied failed document to: s3://{bucket}/{failed_key}")
            
            # Optionally delete from uploads/ folder (commented out for safety)
            # s3_client.delete_object(Bucket=bucket, Key=s3_key)
            
        except Exception as copy_error:
            logger.error(f"Failed to move document to failed/ folder: {str(copy_error)}", exc_info=True)
        
        # 2. Create error.json with failure details
        error_details = {
            'documentId': document_id,
            'filename': filename,
            'originalKey': s3_key,
            'failedKey': failed_key,
            'errorType': type(error).__name__,
            'errorMessage': str(error),
            'errorTraceback': format_exception_traceback(error),
            'failedAt': int(datetime.now().timestamp() * 1000),
            'timestamp': datetime.now().isoformat()
        }
        
        error_json_key = f"failed/{document_id}/error.json"
        
        try:
            s3_client.put_object(
                Bucket=bucket,
                Key=error_json_key,
                Body=json.dumps(error_details, indent=2),
                ContentType='application/json'
            )
            logger.info(f"Created error details file: s3://{bucket}/{error_json_key}")
            
        except Exception as error_json_error:
            logger.error(f"Failed to create error.json: {str(error_json_error)}", exc_info=True)
        
        # 3. Update DocumentMetadata table with failed status
        update_document_status(
            document_id=document_id,
            status='failed',
            bucket=bucket,
            s3_key=s3_key,
            error_message=str(error)
        )
        
        # 4. Send SNS notification to alert administrators
        if FAILED_PROCESSING_SNS_TOPIC:
            try:
                notification_message = {
                    'subject': f'Document Processing Failed: {filename}',
                    'documentId': document_id,
                    'filename': filename,
                    'errorType': type(error).__name__,
                    'errorMessage': str(error),
                    'failedAt': datetime.now().isoformat(),
                    's3Location': f"s3://{bucket}/{failed_key}",
                    'errorDetailsLocation': f"s3://{bucket}/{error_json_key}"
                }
                
                sns_client.publish(
                    TopicArn=FAILED_PROCESSING_SNS_TOPIC,
                    Subject=f'Document Processing Failed: {filename}',
                    Message=json.dumps(notification_message, indent=2)
                )
                
                logger.info(f"Sent SNS notification for failed document: {document_id}")
                
            except Exception as sns_error:
                logger.error(f"Failed to send SNS notification: {str(sns_error)}", exc_info=True)
        else:
            logger.warning("FAILED_PROCESSING_SNS_TOPIC not configured - skipping SNS notification")
        
        logger.info(f"Completed failure handling for document: {document_id}")
        
    except Exception as handle_error:
        logger.error(f"Error in handle_processing_failure: {str(handle_error)}", exc_info=True)
        # Don't raise - we've already logged the original error


def format_exception_traceback(error: Exception) -> str:
    """
    Format exception traceback as a string for logging.
    
    Args:
        error: Exception to format
        
    Returns:
        Formatted traceback string
    """
    import traceback
    return ''.join(traceback.format_exception(type(error), error, error.__traceback__))


def invoke_embedding_generator(bucket: str, document_id: str, chunks_key: str) -> None:
    """
    Invoke the Embedding Generator Lambda function to generate embeddings for document chunks.
    
    This function triggers the embedding generation process after text extraction and chunking
    are complete. The Embedding Generator Lambda will:
    1. Download the chunks from S3
    2. Generate embeddings using Amazon Bedrock Titan Embeddings
    3. Pass embeddings to the Vector Store for indexing (handled in task 11.2)
    
    Args:
        bucket: S3 bucket name
        document_id: Unique document identifier
        chunks_key: S3 key where chunks are stored
        
    Validates Requirements: 5.5, 6.1
    """
    if not EMBEDDING_GENERATOR_LAMBDA:
        logger.warning("EMBEDDING_GENERATOR_LAMBDA not configured - skipping embedding generation")
        return
    
    try:
        # Prepare payload for Embedding Generator Lambda
        payload = {
            'bucket': bucket,
            'documentId': document_id,
            'chunksKey': chunks_key
        }
        
        logger.info(f"Invoking Embedding Generator Lambda: {EMBEDDING_GENERATOR_LAMBDA}")
        
        # Invoke Lambda asynchronously (Event invocation type)
        # This allows the document processor to complete without waiting for embeddings
        response = lambda_client.invoke(
            FunctionName=EMBEDDING_GENERATOR_LAMBDA,
            InvocationType='Event',  # Asynchronous invocation
            Payload=json.dumps(payload)
        )
        
        logger.info(f"Embedding Generator invoked successfully - StatusCode: {response['StatusCode']}")
        
    except Exception as error:
        logger.error(f"Failed to invoke Embedding Generator Lambda: {str(error)}", exc_info=True)
        # Don't raise - embedding generation failure shouldn't fail document processing
        # The document is still searchable by text, just not by semantic similarity

