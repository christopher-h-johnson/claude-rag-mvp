"""
Unit tests for PDF text extraction Lambda function
"""

import json
import unittest
from unittest.mock import Mock, patch, MagicMock
from io import BytesIO

# Import the module to test
import index


class TestPDFTextExtraction(unittest.TestCase):
    """Test cases for PDF text extraction functionality"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.test_bucket = 'test-bucket'
        self.test_key = 'uploads/test-doc-id/sample.pdf'
        self.test_document_id = 'test-doc-id'
        
    def test_handler_processes_upload_files(self):
        """Test that handler processes files in uploads/ folder"""
        event = {
            'Records': [
                {
                    's3': {
                        'bucket': {'name': self.test_bucket},
                        'object': {'key': self.test_key}
                    }
                }
            ]
        }
        
        context = Mock()
        context.request_id = 'test-request-id'
        
        with patch.object(index, 'extract_text') as mock_extract:
            mock_extract.return_value = {
                'text': 'Sample text',
                'pageCount': 1,
                'metadata': {}
            }
            
            result = index.handler(event, context)
            
            self.assertEqual(result['statusCode'], 200)
            body = json.loads(result['body'])
            self.assertEqual(body['processed'], 1)
            self.assertEqual(body['failed'], 0)
            mock_extract.assert_called_once_with(self.test_bucket, self.test_key)
    
    def test_handler_skips_non_upload_files(self):
        """Test that handler skips files not in uploads/ folder"""
        event = {
            'Records': [
                {
                    's3': {
                        'bucket': {'name': self.test_bucket},
                        'object': {'key': 'processed/test-doc-id/text.json'}
                    }
                }
            ]
        }
        
        context = Mock()
        context.request_id = 'test-request-id'
        
        with patch.object(index, 'extract_text') as mock_extract:
            result = index.handler(event, context)
            
            self.assertEqual(result['statusCode'], 200)
            body = json.loads(result['body'])
            self.assertEqual(body['processed'], 0)
            mock_extract.assert_not_called()
    
    def test_handler_continues_on_error(self):
        """Test that handler continues processing after an error"""
        event = {
            'Records': [
                {
                    's3': {
                        'bucket': {'name': self.test_bucket},
                        'object': {'key': 'uploads/doc1/file1.pdf'}
                    }
                },
                {
                    's3': {
                        'bucket': {'name': self.test_bucket},
                        'object': {'key': 'uploads/doc2/file2.pdf'}
                    }
                }
            ]
        }
        
        context = Mock()
        context.request_id = 'test-request-id'
        
        with patch.object(index, 'extract_text') as mock_extract:
            # First call fails, second succeeds
            mock_extract.side_effect = [
                Exception('Processing failed'),
                {'text': 'Success', 'pageCount': 1, 'metadata': {}}
            ]
            
            result = index.handler(event, context)
            
            self.assertEqual(result['statusCode'], 200)
            body = json.loads(result['body'])
            self.assertEqual(body['processed'], 1)
            self.assertEqual(body['failed'], 1)
    
    @patch('index.s3_client')
    def test_download_from_s3(self, mock_s3):
        """Test downloading PDF from S3"""
        test_content = b'PDF content'
        mock_response = {
            'Body': BytesIO(test_content)
        }
        mock_s3.get_object.return_value = mock_response
        
        result = index.download_from_s3(self.test_bucket, self.test_key)
        
        self.assertEqual(result, test_content)
        mock_s3.get_object.assert_called_once_with(
            Bucket=self.test_bucket,
            Key=self.test_key
        )
    
    def test_format_tables_with_data(self):
        """Test formatting tables with data"""
        tables = [
            [
                ['Header 1', 'Header 2', 'Header 3'],
                ['Row 1 Col 1', 'Row 1 Col 2', 'Row 1 Col 3'],
                ['Row 2 Col 1', 'Row 2 Col 2', 'Row 2 Col 3']
            ],
            [
                ['Name', 'Value'],
                ['Item 1', '100'],
                ['Item 2', '200']
            ]
        ]
        
        result = index.format_tables(tables)
        
        self.assertIn('[Table 1]', result)
        self.assertIn('[Table 2]', result)
        self.assertIn('Header 1 | Header 2 | Header 3', result)
        self.assertIn('Name | Value', result)
    
    def test_format_tables_with_none_values(self):
        """Test formatting tables with None values"""
        tables = [
            [
                ['Header 1', None, 'Header 3'],
                ['Value 1', 'Value 2', None]
            ]
        ]
        
        result = index.format_tables(tables)
        
        self.assertIn('[Table 1]', result)
        self.assertIn('Header 1 |  | Header 3', result)
        self.assertIn('Value 1 | Value 2 | ', result)
    
    def test_format_tables_empty(self):
        """Test formatting empty tables"""
        result = index.format_tables([])
        self.assertEqual(result, '')
    
    @patch('index.s3_client')
    def test_store_extracted_text(self, mock_s3):
        """Test storing extracted text in S3"""
        extracted_text = {
            'text': 'Sample text',
            'pageCount': 2,
            'metadata': {
                'filename': 'test.pdf',
                'pageCount': 2
            }
        }
        
        pages_data = [
            {'pageNumber': 1, 'text': 'Page 1 text'},
            {'pageNumber': 2, 'text': 'Page 2 text'}
        ]
        
        index.store_extracted_text(
            self.test_bucket,
            self.test_document_id,
            extracted_text,
            pages_data
        )
        
        # Verify two S3 put_object calls were made
        self.assertEqual(mock_s3.put_object.call_count, 2)
        
        # Verify text.json was stored
        calls = mock_s3.put_object.call_args_list
        text_call = calls[0]
        self.assertEqual(text_call[1]['Bucket'], self.test_bucket)
        self.assertEqual(text_call[1]['Key'], f'processed/{self.test_document_id}/text.json')
        self.assertEqual(text_call[1]['ContentType'], 'application/json')
        
        # Verify pages.json was stored
        pages_call = calls[1]
        self.assertEqual(pages_call[1]['Bucket'], self.test_bucket)
        self.assertEqual(pages_call[1]['Key'], f'processed/{self.test_document_id}/pages.json')
        self.assertEqual(pages_call[1]['ContentType'], 'application/json')
    
    @patch('index.pdfplumber')
    def test_extract_text_from_pdf_with_tables(self, mock_pdfplumber):
        """Test extracting text from PDF with tables"""
        # Mock PDF with 2 pages
        mock_page1 = Mock()
        mock_page1.extract_text.return_value = 'Page 1 text'
        mock_page1.extract_tables.return_value = [
            [['Header 1', 'Header 2'], ['Value 1', 'Value 2']]
        ]
        
        mock_page2 = Mock()
        mock_page2.extract_text.return_value = 'Page 2 text'
        mock_page2.extract_tables.return_value = []
        
        mock_pdf = Mock()
        mock_pdf.pages = [mock_page1, mock_page2]
        mock_pdf.__enter__ = Mock(return_value=mock_pdf)
        mock_pdf.__exit__ = Mock(return_value=False)
        
        mock_pdfplumber.open.return_value = mock_pdf
        
        result = index.extract_text_from_pdf(b'PDF bytes')
        
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]['pageNumber'], 1)
        self.assertTrue(result[0]['hasTable'])
        self.assertEqual(result[0]['tableCount'], 1)
        self.assertIn('Page 1 text', result[0]['text'])
        self.assertIn('[Table 1]', result[0]['text'])
        
        self.assertEqual(result[1]['pageNumber'], 2)
        self.assertFalse(result[1]['hasTable'])
        self.assertEqual(result[1]['tableCount'], 0)
        self.assertIn('Page 2 text', result[1]['text'])
    
    @patch('index.pdfplumber')
    def test_extract_text_from_pdf_handles_page_errors(self, mock_pdfplumber):
        """Test that page extraction errors are handled gracefully"""
        mock_page1 = Mock()
        mock_page1.extract_text.side_effect = Exception('Page extraction failed')
        mock_page1.extract_tables.return_value = []
        
        mock_pdf = Mock()
        mock_pdf.pages = [mock_page1]
        mock_pdf.__enter__ = Mock(return_value=mock_pdf)
        mock_pdf.__exit__ = Mock(return_value=False)
        
        mock_pdfplumber.open.return_value = mock_pdf
        
        result = index.extract_text_from_pdf(b'PDF bytes')
        
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['pageNumber'], 1)
        self.assertEqual(result[0]['text'], '')
        self.assertIn('error', result[0])


class TestTextChunking(unittest.TestCase):
    """Test cases for text chunking functionality"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.test_document_id = 'test-doc-123'
        self.test_metadata = {
            'filename': 'test.pdf',
            'uploadedBy': 'test-user',
            'uploadedAt': 1234567890,
            'pageCount': 2
        }
    
    @patch('index.tiktoken')
    def test_chunk_text_basic(self, mock_tiktoken):
        """Test basic text chunking with token counting"""
        # Mock tiktoken encoding
        mock_encoding = Mock()
        mock_tiktoken.get_encoding.return_value = mock_encoding
        
        # Create a simple text
        text = "This is a test document. " * 10
        
        # Mock token encoding - simulate ~150 tokens
        mock_tokens = list(range(150))
        mock_encoding.encode.return_value = mock_tokens
        mock_encoding.decode.side_effect = lambda tokens: f"Chunk text {len(tokens)} tokens"
        
        pages_data = [
            {'pageNumber': 1, 'text': text}
        ]
        
        chunks = index.chunk_text(
            text,
            pages_data,
            self.test_document_id,
            self.test_metadata,
            chunk_size=50,
            overlap=10
        )
        
        # Verify chunks were created
        self.assertGreater(len(chunks), 1)
        
        # Verify first chunk structure
        first_chunk = chunks[0]
        self.assertIn('chunkId', first_chunk)
        self.assertIn('documentId', first_chunk)
        self.assertIn('text', first_chunk)
        self.assertIn('chunkIndex', first_chunk)
        self.assertIn('pageNumber', first_chunk)
        self.assertIn('tokenCount', first_chunk)
        self.assertIn('metadata', first_chunk)
        
        # Verify chunk IDs are unique
        chunk_ids = [chunk['chunkId'] for chunk in chunks]
        self.assertEqual(len(chunk_ids), len(set(chunk_ids)))
        
        # Verify chunk indices are sequential
        for i, chunk in enumerate(chunks):
            self.assertEqual(chunk['chunkIndex'], i)
        
        # Verify tiktoken was called with correct encoding
        mock_tiktoken.get_encoding.assert_called_once_with("cl100k_base")
    
    @patch('index.tiktoken')
    def test_chunk_text_preserves_page_numbers(self, mock_tiktoken):
        """Test that chunking preserves page numbers correctly"""
        # Mock tiktoken encoding
        mock_encoding = Mock()
        mock_tiktoken.get_encoding.return_value = mock_encoding
        
        page1_text = "This is page one content. " * 20
        page2_text = "This is page two content. " * 20
        
        pages_data = [
            {'pageNumber': 1, 'text': page1_text},
            {'pageNumber': 2, 'text': page2_text}
        ]
        
        full_text = page1_text + '\n\n' + page2_text
        
        # Mock token encoding
        mock_tokens = list(range(200))
        mock_encoding.encode.return_value = mock_tokens
        mock_encoding.decode.side_effect = lambda tokens: f"Chunk {len(tokens)}"
        
        chunks = index.chunk_text(
            full_text,
            pages_data,
            self.test_document_id,
            self.test_metadata,
            chunk_size=100,
            overlap=20
        )
        
        # Verify all chunks have valid page numbers
        for chunk in chunks:
            self.assertIn(chunk['pageNumber'], [1, 2])
    
    @patch('index.tiktoken')
    def test_chunk_text_respects_token_limits(self, mock_tiktoken):
        """Test that chunks respect token size limits"""
        # Mock tiktoken encoding
        mock_encoding = Mock()
        mock_tiktoken.get_encoding.return_value = mock_encoding
        
        text = "Word " * 200
        pages_data = [{'pageNumber': 1, 'text': text}]
        
        # Mock 500 tokens
        mock_tokens = list(range(500))
        mock_encoding.encode.return_value = mock_tokens
        mock_encoding.decode.side_effect = lambda tokens: f"Text {len(tokens)}"
        
        chunk_size = 100
        chunks = index.chunk_text(
            text,
            pages_data,
            self.test_document_id,
            self.test_metadata,
            chunk_size=chunk_size,
            overlap=10
        )
        
        # Verify each chunk (except possibly the last) has token count <= chunk_size
        for i, chunk in enumerate(chunks[:-1]):
            self.assertLessEqual(chunk['tokenCount'], chunk_size)
        
        # Last chunk may be smaller
        self.assertLessEqual(chunks[-1]['tokenCount'], chunk_size)
    
    @patch('index.tiktoken')
    def test_chunk_text_creates_overlap(self, mock_tiktoken):
        """Test that chunks have overlapping content"""
        # Mock tiktoken encoding
        mock_encoding = Mock()
        mock_tiktoken.get_encoding.return_value = mock_encoding
        
        text = "Token " * 100
        pages_data = [{'pageNumber': 1, 'text': text}]
        
        # Mock 200 tokens
        mock_tokens = list(range(200))
        mock_encoding.encode.return_value = mock_tokens
        mock_encoding.decode.side_effect = lambda tokens: f"Text {len(tokens)}"
        
        chunks = index.chunk_text(
            text,
            pages_data,
            self.test_document_id,
            self.test_metadata,
            chunk_size=50,
            overlap=10
        )
        
        # Verify we have multiple chunks
        self.assertGreater(len(chunks), 1)
        
        # Verify overlap exists by checking token positions
        for i in range(len(chunks) - 1):
            current_chunk = chunks[i]
            next_chunk = chunks[i + 1]
            
            # Next chunk should start before current chunk ends (overlap)
            overlap_tokens = current_chunk['endToken'] - next_chunk['startToken']
            self.assertGreater(overlap_tokens, 0)
    
    @patch('index.tiktoken')
    def test_chunk_text_includes_metadata(self, mock_tiktoken):
        """Test that chunks include document metadata"""
        # Mock tiktoken encoding
        mock_encoding = Mock()
        mock_tiktoken.get_encoding.return_value = mock_encoding
        
        text = "Test content"
        pages_data = [{'pageNumber': 1, 'text': text}]
        
        # Mock small number of tokens
        mock_tokens = list(range(10))
        mock_encoding.encode.return_value = mock_tokens
        mock_encoding.decode.return_value = text
        
        chunks = index.chunk_text(
            text,
            pages_data,
            self.test_document_id,
            self.test_metadata,
            chunk_size=512,
            overlap=50
        )
        
        self.assertGreater(len(chunks), 0)
        
        chunk = chunks[0]
        self.assertEqual(chunk['metadata']['filename'], 'test.pdf')
        self.assertEqual(chunk['metadata']['uploadedBy'], 'test-user')
        self.assertEqual(chunk['metadata']['uploadedAt'], 1234567890)
        self.assertEqual(chunk['metadata']['pageCount'], 2)
    
    def test_build_page_map(self):
        """Test building page position map"""
        pages_data = [
            {'pageNumber': 1, 'text': 'Page one'},
            {'pageNumber': 2, 'text': 'Page two'},
            {'pageNumber': 3, 'text': 'Page three'}
        ]
        
        page_map = index.build_page_map(pages_data)
        
        self.assertEqual(len(page_map), 3)
        
        # First page starts at 0
        self.assertEqual(page_map[0]['start_pos'], 0)
        self.assertEqual(page_map[0]['page_number'], 1)
        
        # Verify positions are sequential with '\n\n' separators
        self.assertEqual(page_map[1]['start_pos'], len('Page one') + 2)
        self.assertEqual(page_map[2]['start_pos'], len('Page one') + 2 + len('Page two') + 2)
    
    def test_get_page_number_for_position(self):
        """Test getting page number for character position"""
        page_map = [
            {'start_pos': 0, 'end_pos': 10, 'page_number': 1},
            {'start_pos': 12, 'end_pos': 25, 'page_number': 2},
            {'start_pos': 27, 'end_pos': 40, 'page_number': 3}
        ]
        
        # Test positions in each page
        self.assertEqual(index.get_page_number_for_position(5, page_map), 1)
        self.assertEqual(index.get_page_number_for_position(15, page_map), 2)
        self.assertEqual(index.get_page_number_for_position(30, page_map), 3)
        
        # Test position beyond all pages
        self.assertEqual(index.get_page_number_for_position(100, page_map), 3)
        
        # Test empty page map
        self.assertEqual(index.get_page_number_for_position(0, []), 1)
    
    @patch('index.s3_client')
    def test_store_chunks(self, mock_s3):
        """Test storing chunks in S3"""
        chunks = [
            {
                'chunkId': 'doc-1#chunk#0',
                'text': 'Chunk 1 text',
                'chunkIndex': 0,
                'tokenCount': 10
            },
            {
                'chunkId': 'doc-1#chunk#1',
                'text': 'Chunk 2 text',
                'chunkIndex': 1,
                'tokenCount': 12
            }
        ]
        
        index.store_chunks('test-bucket', 'doc-1', chunks)
        
        # Verify S3 put_object was called
        mock_s3.put_object.assert_called_once()
        
        call_args = mock_s3.put_object.call_args[1]
        self.assertEqual(call_args['Bucket'], 'test-bucket')
        self.assertEqual(call_args['Key'], 'processed/doc-1/chunks.json')
        self.assertEqual(call_args['ContentType'], 'application/json')
        
        # Verify content structure
        body = json.loads(call_args['Body'])
        self.assertEqual(body['totalChunks'], 2)
        self.assertEqual(len(body['chunks']), 2)
        self.assertIn('chunkedAt', body)


class TestPDFExtractionWithSampleDocuments(unittest.TestCase):
    """Test cases for PDF text extraction with various document types"""
    
    @patch('index.pdfplumber')
    def test_extract_simple_pdf(self, mock_pdfplumber):
        """Test extracting text from a simple single-page PDF"""
        mock_page = Mock()
        mock_page.extract_text.return_value = 'This is a simple PDF document with plain text.'
        mock_page.extract_tables.return_value = []
        
        mock_pdf = Mock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = Mock(return_value=mock_pdf)
        mock_pdf.__exit__ = Mock(return_value=False)
        
        mock_pdfplumber.open.return_value = mock_pdf
        
        result = index.extract_text_from_pdf(b'Simple PDF bytes')
        
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['pageNumber'], 1)
        self.assertEqual(result[0]['text'], 'This is a simple PDF document with plain text.')
        self.assertFalse(result[0]['hasTable'])
    
    @patch('index.pdfplumber')
    def test_extract_multi_page_pdf(self, mock_pdfplumber):
        """Test extracting text from a multi-page PDF"""
        pages = []
        for i in range(1, 6):
            mock_page = Mock()
            mock_page.extract_text.return_value = f'Content of page {i}. ' * 10
            mock_page.extract_tables.return_value = []
            pages.append(mock_page)
        
        mock_pdf = Mock()
        mock_pdf.pages = pages
        mock_pdf.__enter__ = Mock(return_value=mock_pdf)
        mock_pdf.__exit__ = Mock(return_value=False)
        
        mock_pdfplumber.open.return_value = mock_pdf
        
        result = index.extract_text_from_pdf(b'Multi-page PDF bytes')
        
        self.assertEqual(len(result), 5)
        for i, page_data in enumerate(result, start=1):
            self.assertEqual(page_data['pageNumber'], i)
            self.assertIn(f'Content of page {i}', page_data['text'])
    
    @patch('index.pdfplumber')
    def test_extract_pdf_with_complex_layout(self, mock_pdfplumber):
        """Test extracting text from PDF with multi-column layout"""
        mock_page = Mock()
        # Simulate multi-column text with layout=True
        mock_page.extract_text.return_value = '''Column 1 text here    Column 2 text here
More column 1 text    More column 2 text
Final column 1        Final column 2'''
        mock_page.extract_tables.return_value = []
        
        mock_pdf = Mock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = Mock(return_value=mock_pdf)
        mock_pdf.__exit__ = Mock(return_value=False)
        
        mock_pdfplumber.open.return_value = mock_pdf
        
        result = index.extract_text_from_pdf(b'Multi-column PDF bytes')
        
        self.assertEqual(len(result), 1)
        self.assertIn('Column 1 text here', result[0]['text'])
        self.assertIn('Column 2 text here', result[0]['text'])
    
    @patch('index.pdfplumber')
    def test_extract_pdf_with_large_table(self, mock_pdfplumber):
        """Test extracting text from PDF with large complex table"""
        mock_page = Mock()
        mock_page.extract_text.return_value = 'Document header text'
        
        # Create a large table with 10 rows and 5 columns
        large_table = [
            ['Header 1', 'Header 2', 'Header 3', 'Header 4', 'Header 5']
        ]
        for i in range(1, 10):
            large_table.append([f'Row {i} Col 1', f'Row {i} Col 2', f'Row {i} Col 3', 
                               f'Row {i} Col 4', f'Row {i} Col 5'])
        
        mock_page.extract_tables.return_value = [large_table]
        
        mock_pdf = Mock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = Mock(return_value=mock_pdf)
        mock_pdf.__exit__ = Mock(return_value=False)
        
        mock_pdfplumber.open.return_value = mock_pdf
        
        result = index.extract_text_from_pdf(b'PDF with large table')
        
        self.assertEqual(len(result), 1)
        self.assertTrue(result[0]['hasTable'])
        self.assertEqual(result[0]['tableCount'], 1)
        self.assertIn('[Table 1]', result[0]['text'])
        self.assertIn('Header 1 | Header 2', result[0]['text'])
        self.assertIn('Row 1 Col 1', result[0]['text'])
    
    @patch('index.pdfplumber')
    def test_extract_pdf_with_empty_pages(self, mock_pdfplumber):
        """Test extracting text from PDF with some empty pages"""
        mock_page1 = Mock()
        mock_page1.extract_text.return_value = 'Page 1 content'
        mock_page1.extract_tables.return_value = []
        
        mock_page2 = Mock()
        mock_page2.extract_text.return_value = ''  # Empty page
        mock_page2.extract_tables.return_value = []
        
        mock_page3 = Mock()
        mock_page3.extract_text.return_value = 'Page 3 content'
        mock_page3.extract_tables.return_value = []
        
        mock_pdf = Mock()
        mock_pdf.pages = [mock_page1, mock_page2, mock_page3]
        mock_pdf.__enter__ = Mock(return_value=mock_pdf)
        mock_pdf.__exit__ = Mock(return_value=False)
        
        mock_pdfplumber.open.return_value = mock_pdf
        
        result = index.extract_text_from_pdf(b'PDF with empty pages')
        
        self.assertEqual(len(result), 3)
        self.assertEqual(result[0]['text'], 'Page 1 content')
        self.assertEqual(result[1]['text'], '')  # Empty page preserved
        self.assertEqual(result[2]['text'], 'Page 3 content')
    
    @patch('index.pdfplumber')
    def test_extract_corrupted_pdf_open_failure(self, mock_pdfplumber):
        """Test handling of corrupted PDF that fails to open"""
        mock_pdfplumber.open.side_effect = Exception('PDF is corrupted or invalid')
        
        with self.assertRaises(Exception) as context:
            index.extract_text_from_pdf(b'Corrupted PDF bytes')
        
        self.assertIn('corrupted', str(context.exception).lower())
    
    @patch('index.pdfplumber')
    def test_extract_pdf_with_extraction_errors_on_some_pages(self, mock_pdfplumber):
        """Test handling PDF where some pages fail to extract"""
        mock_page1 = Mock()
        mock_page1.extract_text.return_value = 'Page 1 success'
        mock_page1.extract_tables.return_value = []
        
        mock_page2 = Mock()
        mock_page2.extract_text.side_effect = Exception('Page extraction failed')
        mock_page2.extract_tables.return_value = []
        
        mock_page3 = Mock()
        mock_page3.extract_text.return_value = 'Page 3 success'
        mock_page3.extract_tables.return_value = []
        
        mock_pdf = Mock()
        mock_pdf.pages = [mock_page1, mock_page2, mock_page3]
        mock_pdf.__enter__ = Mock(return_value=mock_pdf)
        mock_pdf.__exit__ = Mock(return_value=False)
        
        mock_pdfplumber.open.return_value = mock_pdf
        
        result = index.extract_text_from_pdf(b'PDF with page errors')
        
        # Should return all 3 pages, with page 2 having empty text and error
        self.assertEqual(len(result), 3)
        self.assertEqual(result[0]['text'], 'Page 1 success')
        self.assertEqual(result[1]['text'], '')
        self.assertIn('error', result[1])
        self.assertEqual(result[2]['text'], 'Page 3 success')


class TestChunkingWithVariousTextLengths(unittest.TestCase):
    """Test cases for text chunking with different text lengths"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.test_document_id = 'test-doc-chunking'
        self.test_metadata = {
            'filename': 'test.pdf',
            'uploadedBy': 'test-user',
            'uploadedAt': 1234567890,
            'pageCount': 1
        }
    
    @patch('index.tiktoken')
    def test_chunk_very_short_text(self, mock_tiktoken):
        """Test chunking text shorter than chunk size"""
        mock_encoding = Mock()
        mock_tiktoken.get_encoding.return_value = mock_encoding
        
        text = "This is a very short text."
        pages_data = [{'pageNumber': 1, 'text': text}]
        
        # Mock 10 tokens (less than chunk size of 512)
        mock_tokens = list(range(10))
        mock_encoding.encode.return_value = mock_tokens
        mock_encoding.decode.return_value = text
        
        chunks = index.chunk_text(
            text,
            pages_data,
            self.test_document_id,
            self.test_metadata,
            chunk_size=512,
            overlap=50
        )
        
        # Should create exactly 1 chunk
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0]['tokenCount'], 10)
        self.assertEqual(chunks[0]['chunkIndex'], 0)
    
    @patch('index.tiktoken')
    def test_chunk_exact_chunk_size(self, mock_tiktoken):
        """Test chunking text that is exactly chunk size"""
        mock_encoding = Mock()
        mock_tiktoken.get_encoding.return_value = mock_encoding
        
        text = "Word " * 100
        pages_data = [{'pageNumber': 1, 'text': text}]
        
        # Mock exactly 512 tokens
        mock_tokens = list(range(512))
        mock_encoding.encode.return_value = mock_tokens
        mock_encoding.decode.return_value = text
        
        chunks = index.chunk_text(
            text,
            pages_data,
            self.test_document_id,
            self.test_metadata,
            chunk_size=512,
            overlap=50
        )
        
        # Should create exactly 1 chunk
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0]['tokenCount'], 512)
    
    @patch('index.tiktoken')
    def test_chunk_slightly_over_chunk_size(self, mock_tiktoken):
        """Test chunking text slightly larger than chunk size"""
        mock_encoding = Mock()
        mock_tiktoken.get_encoding.return_value = mock_encoding
        
        text = "Word " * 110
        pages_data = [{'pageNumber': 1, 'text': text}]
        
        # Mock 550 tokens (512 + 38)
        mock_tokens = list(range(550))
        mock_encoding.encode.return_value = mock_tokens
        mock_encoding.decode.side_effect = lambda tokens: f"Text {len(tokens)}"
        
        chunks = index.chunk_text(
            text,
            pages_data,
            self.test_document_id,
            self.test_metadata,
            chunk_size=512,
            overlap=50
        )
        
        # Should create 2 chunks with overlap
        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[0]['tokenCount'], 512)
        self.assertLessEqual(chunks[1]['tokenCount'], 512)
    
    @patch('index.tiktoken')
    def test_chunk_very_long_text(self, mock_tiktoken):
        """Test chunking very long text (10000+ tokens)"""
        mock_encoding = Mock()
        mock_tiktoken.get_encoding.return_value = mock_encoding
        
        text = "Word " * 2000
        pages_data = [{'pageNumber': 1, 'text': text}]
        
        # Mock 10000 tokens
        mock_tokens = list(range(10000))
        mock_encoding.encode.return_value = mock_tokens
        mock_encoding.decode.side_effect = lambda tokens: f"Text {len(tokens)}"
        
        chunks = index.chunk_text(
            text,
            pages_data,
            self.test_document_id,
            self.test_metadata,
            chunk_size=512,
            overlap=50
        )
        
        # Calculate expected number of chunks
        # With 512 chunk size and 50 overlap, step size is 462
        # Expected chunks: ceil((10000 - 512) / 462) + 1 ≈ 21-22 chunks
        self.assertGreater(len(chunks), 20)
        self.assertLess(len(chunks), 25)
        
        # Verify all chunks except last have full size
        for chunk in chunks[:-1]:
            self.assertEqual(chunk['tokenCount'], 512)
    
    @patch('index.tiktoken')
    def test_chunk_empty_text(self, mock_tiktoken):
        """Test chunking empty text"""
        mock_encoding = Mock()
        mock_tiktoken.get_encoding.return_value = mock_encoding
        
        text = ""
        pages_data = [{'pageNumber': 1, 'text': text}]
        
        # Mock 0 tokens
        mock_tokens = []
        mock_encoding.encode.return_value = mock_tokens
        mock_encoding.decode.return_value = text
        
        chunks = index.chunk_text(
            text,
            pages_data,
            self.test_document_id,
            self.test_metadata,
            chunk_size=512,
            overlap=50
        )
        
        # Should create no chunks for empty text
        self.assertEqual(len(chunks), 0)
    
    @patch('index.tiktoken')
    def test_chunk_with_different_overlap_sizes(self, mock_tiktoken):
        """Test chunking with various overlap sizes"""
        mock_encoding = Mock()
        mock_tiktoken.get_encoding.return_value = mock_encoding
        
        text = "Word " * 200
        pages_data = [{'pageNumber': 1, 'text': text}]
        
        # Mock 1000 tokens
        mock_tokens = list(range(1000))
        mock_encoding.encode.return_value = mock_tokens
        mock_encoding.decode.side_effect = lambda tokens: f"Text {len(tokens)}"
        
        # Test with no overlap
        chunks_no_overlap = index.chunk_text(
            text, pages_data, self.test_document_id, self.test_metadata,
            chunk_size=512, overlap=0
        )
        
        # Test with small overlap
        chunks_small_overlap = index.chunk_text(
            text, pages_data, self.test_document_id, self.test_metadata,
            chunk_size=512, overlap=25
        )
        
        # Test with large overlap
        chunks_large_overlap = index.chunk_text(
            text, pages_data, self.test_document_id, self.test_metadata,
            chunk_size=512, overlap=100
        )
        
        # More overlap should create more chunks (or at least same number)
        self.assertLess(len(chunks_no_overlap), len(chunks_small_overlap))
        self.assertLessEqual(len(chunks_small_overlap), len(chunks_large_overlap))
    
    @patch('index.tiktoken')
    def test_chunk_multi_page_document(self, mock_tiktoken):
        """Test chunking text from multi-page document"""
        mock_encoding = Mock()
        mock_tiktoken.get_encoding.return_value = mock_encoding
        
        page1_text = "Page 1 content. " * 50
        page2_text = "Page 2 content. " * 50
        page3_text = "Page 3 content. " * 50
        
        pages_data = [
            {'pageNumber': 1, 'text': page1_text},
            {'pageNumber': 2, 'text': page2_text},
            {'pageNumber': 3, 'text': page3_text}
        ]
        
        full_text = page1_text + '\n\n' + page2_text + '\n\n' + page3_text
        
        # Mock 1500 tokens
        mock_tokens = list(range(1500))
        mock_encoding.encode.return_value = mock_tokens
        mock_encoding.decode.side_effect = lambda tokens: f"Text {len(tokens)}"
        
        chunks = index.chunk_text(
            full_text,
            pages_data,
            self.test_document_id,
            self.test_metadata,
            chunk_size=512,
            overlap=50
        )
        
        # Verify we have multiple chunks
        self.assertGreater(len(chunks), 1)
        
        # Verify all chunks have valid page numbers
        for chunk in chunks:
            self.assertIn(chunk['pageNumber'], [1, 2, 3])
        
        # Verify chunks are created correctly
        self.assertGreater(len(chunks), 2)


class TestCorruptedPDFHandling(unittest.TestCase):
    """Test cases specifically for corrupted PDF error handling"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.test_bucket = 'test-bucket'
        self.test_key = 'uploads/test-doc-id/corrupted.pdf'
        self.test_document_id = 'test-doc-id'
    
    @patch('index.handle_processing_failure')
    @patch('index.update_document_status')
    @patch('index.pdfplumber')
    @patch('index.download_from_s3')
    def test_extract_text_handles_corrupted_pdf(self, mock_download, mock_pdfplumber, 
                                                 mock_update_status, mock_handle_failure):
        """Test that extract_text raises exception for corrupted PDF"""
        mock_download.return_value = b'Corrupted PDF bytes'
        mock_pdfplumber.open.side_effect = Exception('PDF is corrupted')
        
        with self.assertRaises(Exception) as context:
            index.extract_text(self.test_bucket, self.test_key)
        
        self.assertIn('corrupted', str(context.exception).lower())
    
    @patch('index.handle_processing_failure')
    @patch('index.update_document_status')
    @patch('index.extract_text')
    def test_handler_handles_corrupted_pdf_gracefully(self, mock_extract, 
                                                       mock_update_status, mock_handle_failure):
        """Test that handler handles corrupted PDF without crashing"""
        mock_extract.side_effect = Exception('PDF is corrupted')
        
        event = {
            'Records': [
                {
                    's3': {
                        'bucket': {'name': self.test_bucket},
                        'object': {'key': self.test_key}
                    }
                }
            ]
        }
        
        context = Mock()
        context.request_id = 'test-request-id'
        
        result = index.handler(event, context)
        
        # Handler should return success status even with failure
        self.assertEqual(result['statusCode'], 200)
        body = json.loads(result['body'])
        self.assertEqual(body['failed'], 1)
        self.assertEqual(body['processed'], 0)
        
        # Verify error handling was called
        mock_handle_failure.assert_called_once()
    
    @patch('index.pdfplumber')
    def test_extract_text_from_pdf_with_invalid_structure(self, mock_pdfplumber):
        """Test handling PDF with invalid internal structure"""
        mock_pdf = Mock()
        mock_pdf.pages = None  # Invalid structure
        mock_pdf.__enter__ = Mock(return_value=mock_pdf)
        mock_pdf.__exit__ = Mock(return_value=False)
        
        mock_pdfplumber.open.return_value = mock_pdf
        
        with self.assertRaises(Exception):
            index.extract_text_from_pdf(b'Invalid PDF structure')
    
    @patch('index.pdfplumber')
    def test_extract_text_from_password_protected_pdf(self, mock_pdfplumber):
        """Test handling password-protected PDF"""
        mock_pdfplumber.open.side_effect = Exception('PDF is password protected')
        
        with self.assertRaises(Exception) as context:
            index.extract_text_from_pdf(b'Password protected PDF')
        
        self.assertIn('password', str(context.exception).lower())
    
    @patch('index.pdfplumber')
    def test_extract_text_from_zero_byte_pdf(self, mock_pdfplumber):
        """Test handling zero-byte (empty) PDF file"""
        mock_pdfplumber.open.side_effect = Exception('PDF file is empty or invalid')
        
        with self.assertRaises(Exception):
            index.extract_text_from_pdf(b'')


if __name__ == '__main__':
    unittest.main()



class TestErrorHandling(unittest.TestCase):
    """Test cases for error handling and dead-letter queue functionality"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.test_bucket = 'test-bucket'
        self.test_key = 'uploads/test-doc-id/sample.pdf'
        self.test_document_id = 'test-doc-id'
        self.test_error = Exception('Test processing error')
    
    @patch('index.document_metadata_table')
    def test_update_document_status_processing(self, mock_table):
        """Test updating document status to processing"""
        index.update_document_status(
            document_id=self.test_document_id,
            status='processing',
            bucket=self.test_bucket,
            s3_key=self.test_key
        )
        
        mock_table.update_item.assert_called_once()
        call_args = mock_table.update_item.call_args[1]
        
        self.assertEqual(call_args['Key']['PK'], f'DOC#{self.test_document_id}')
        self.assertEqual(call_args['Key']['SK'], 'METADATA')
        self.assertIn('processingStatus = :status', call_args['UpdateExpression'])
        self.assertEqual(call_args['ExpressionAttributeValues'][':status'], 'processing')
    
    @patch('index.document_metadata_table')
    def test_update_document_status_completed(self, mock_table):
        """Test updating document status to completed with chunk and page counts"""
        index.update_document_status(
            document_id=self.test_document_id,
            status='completed',
            bucket=self.test_bucket,
            s3_key=self.test_key,
            chunk_count=10,
            page_count=5
        )
        
        mock_table.update_item.assert_called_once()
        call_args = mock_table.update_item.call_args[1]
        
        self.assertIn('chunkCount = :chunk_count', call_args['UpdateExpression'])
        self.assertIn('pageCount = :page_count', call_args['UpdateExpression'])
        self.assertEqual(call_args['ExpressionAttributeValues'][':chunk_count'], 10)
        self.assertEqual(call_args['ExpressionAttributeValues'][':page_count'], 5)
    
    @patch('index.document_metadata_table')
    def test_update_document_status_failed(self, mock_table):
        """Test updating document status to failed with error message"""
        error_msg = 'Processing failed due to invalid PDF'
        
        index.update_document_status(
            document_id=self.test_document_id,
            status='failed',
            bucket=self.test_bucket,
            s3_key=self.test_key,
            error_message=error_msg
        )
        
        mock_table.update_item.assert_called_once()
        call_args = mock_table.update_item.call_args[1]
        
        self.assertIn('errorMessage = :error_message', call_args['UpdateExpression'])
        self.assertEqual(call_args['ExpressionAttributeValues'][':error_message'], error_msg)
    
    @patch('index.document_metadata_table')
    def test_update_document_status_handles_errors(self, mock_table):
        """Test that update_document_status handles DynamoDB errors gracefully"""
        mock_table.update_item.side_effect = Exception('DynamoDB error')
        
        # Should not raise exception
        try:
            index.update_document_status(
                document_id=self.test_document_id,
                status='processing',
                bucket=self.test_bucket,
                s3_key=self.test_key
            )
        except Exception:
            self.fail("update_document_status should not raise exceptions")
    
    @patch('index.sns_client')
    @patch('index.s3_client')
    @patch('index.update_document_status')
    @patch('index.FAILED_PROCESSING_SNS_TOPIC', 'arn:aws:sns:us-east-1:123456789012:test-topic')
    def test_handle_processing_failure_complete_flow(self, mock_update_status, mock_s3, mock_sns):
        """Test complete failure handling flow"""
        index.handle_processing_failure(
            bucket=self.test_bucket,
            s3_key=self.test_key,
            document_id=self.test_document_id,
            error=self.test_error
        )
        
        # Verify document was copied to failed/ folder
        mock_s3.copy_object.assert_called_once()
        copy_args = mock_s3.copy_object.call_args[1]
        self.assertEqual(copy_args['Bucket'], self.test_bucket)
        self.assertEqual(copy_args['Key'], f'failed/{self.test_document_id}/sample.pdf')
        self.assertEqual(copy_args['CopySource']['Bucket'], self.test_bucket)
        self.assertEqual(copy_args['CopySource']['Key'], self.test_key)
        
        # Verify error.json was created
        put_calls = [call for call in mock_s3.put_object.call_args_list]
        self.assertEqual(len(put_calls), 1)
        error_json_call = put_calls[0][1]
        self.assertEqual(error_json_call['Key'], f'failed/{self.test_document_id}/error.json')
        self.assertEqual(error_json_call['ContentType'], 'application/json')
        
        # Verify error details structure
        error_details = json.loads(error_json_call['Body'])
        self.assertEqual(error_details['documentId'], self.test_document_id)
        self.assertEqual(error_details['filename'], 'sample.pdf')
        self.assertEqual(error_details['errorType'], 'Exception')
        self.assertEqual(error_details['errorMessage'], 'Test processing error')
        self.assertIn('failedAt', error_details)
        self.assertIn('errorTraceback', error_details)
        
        # Verify DocumentMetadata was updated
        mock_update_status.assert_called_once()
        update_args = mock_update_status.call_args[1]
        self.assertEqual(update_args['document_id'], self.test_document_id)
        self.assertEqual(update_args['status'], 'failed')
        self.assertEqual(update_args['error_message'], 'Test processing error')
        
        # Verify SNS notification was sent
        mock_sns.publish.assert_called_once()
        sns_args = mock_sns.publish.call_args[1]
        self.assertEqual(sns_args['TopicArn'], 'arn:aws:sns:us-east-1:123456789012:test-topic')
        self.assertIn('Document Processing Failed', sns_args['Subject'])
        
        # Verify notification message structure
        notification = json.loads(sns_args['Message'])
        self.assertEqual(notification['documentId'], self.test_document_id)
        self.assertEqual(notification['filename'], 'sample.pdf')
        self.assertEqual(notification['errorType'], 'Exception')
        self.assertIn('s3Location', notification)
        self.assertIn('errorDetailsLocation', notification)
    
    @patch('index.sns_client')
    @patch('index.s3_client')
    @patch('index.update_document_status')
    @patch('index.FAILED_PROCESSING_SNS_TOPIC', '')
    def test_handle_processing_failure_without_sns_topic(self, mock_update_status, mock_s3, mock_sns):
        """Test failure handling when SNS topic is not configured"""
        index.handle_processing_failure(
            bucket=self.test_bucket,
            s3_key=self.test_key,
            document_id=self.test_document_id,
            error=self.test_error
        )
        
        # Verify S3 operations still happened
        mock_s3.copy_object.assert_called_once()
        mock_s3.put_object.assert_called_once()
        
        # Verify status update still happened
        mock_update_status.assert_called_once()
        
        # Verify SNS was NOT called
        mock_sns.publish.assert_not_called()
    
    @patch('index.sns_client')
    @patch('index.s3_client')
    @patch('index.update_document_status')
    @patch('index.FAILED_PROCESSING_SNS_TOPIC', 'arn:aws:sns:us-east-1:123456789012:test-topic')
    def test_handle_processing_failure_s3_copy_error(self, mock_update_status, mock_s3, mock_sns):
        """Test failure handling continues even if S3 copy fails"""
        mock_s3.copy_object.side_effect = Exception('S3 copy failed')
        
        # Should not raise exception
        try:
            index.handle_processing_failure(
                bucket=self.test_bucket,
                s3_key=self.test_key,
                document_id=self.test_document_id,
                error=self.test_error
            )
        except Exception:
            self.fail("handle_processing_failure should not raise exceptions")
        
        # Verify other operations still happened
        mock_s3.put_object.assert_called_once()  # error.json
        mock_update_status.assert_called_once()
        mock_sns.publish.assert_called_once()
    
    @patch('index.sns_client')
    @patch('index.s3_client')
    @patch('index.update_document_status')
    @patch('index.FAILED_PROCESSING_SNS_TOPIC', 'arn:aws:sns:us-east-1:123456789012:test-topic')
    def test_handle_processing_failure_sns_error(self, mock_update_status, mock_s3, mock_sns):
        """Test failure handling continues even if SNS publish fails"""
        mock_sns.publish.side_effect = Exception('SNS publish failed')
        
        # Should not raise exception
        try:
            index.handle_processing_failure(
                bucket=self.test_bucket,
                s3_key=self.test_key,
                document_id=self.test_document_id,
                error=self.test_error
            )
        except Exception:
            self.fail("handle_processing_failure should not raise exceptions")
        
        # Verify other operations still happened
        mock_s3.copy_object.assert_called_once()
        mock_s3.put_object.assert_called_once()
        mock_update_status.assert_called_once()
    
    def test_format_exception_traceback(self):
        """Test formatting exception traceback"""
        try:
            raise ValueError('Test error message')
        except ValueError as e:
            traceback_str = index.format_exception_traceback(e)
            
            self.assertIn('ValueError', traceback_str)
            self.assertIn('Test error message', traceback_str)
            self.assertIn('Traceback', traceback_str)
    
    @patch('index.handle_processing_failure')
    @patch('index.update_document_status')
    @patch('index.extract_text')
    def test_handler_calls_error_handling_on_failure(self, mock_extract, mock_update_status, mock_handle_failure):
        """Test that handler calls error handling when processing fails"""
        mock_extract.side_effect = Exception('Processing failed')
        
        event = {
            'Records': [
                {
                    's3': {
                        'bucket': {'name': self.test_bucket},
                        'object': {'key': self.test_key}
                    }
                }
            ]
        }
        
        context = Mock()
        context.request_id = 'test-request-id'
        
        result = index.handler(event, context)
        
        # Verify error handling was called
        mock_handle_failure.assert_called_once()
        call_args = mock_handle_failure.call_args[0]
        self.assertEqual(call_args[0], self.test_bucket)
        self.assertEqual(call_args[1], self.test_key)
        self.assertEqual(call_args[2], self.test_document_id)
        
        # Verify response indicates failure
        body = json.loads(result['body'])
        self.assertEqual(body['failed'], 1)
        self.assertEqual(body['processed'], 0)
    
    @patch('index.update_document_status')
    @patch('index.extract_text')
    def test_handler_updates_status_on_success(self, mock_extract, mock_update_status):
        """Test that handler updates status correctly on successful processing"""
        mock_extract.return_value = {
            'text': 'Sample text',
            'pageCount': 5,
            'chunkCount': 10,
            'metadata': {}
        }
        
        event = {
            'Records': [
                {
                    's3': {
                        'bucket': {'name': self.test_bucket},
                        'object': {'key': self.test_key}
                    }
                }
            ]
        }
        
        context = Mock()
        context.request_id = 'test-request-id'
        
        result = index.handler(event, context)
        
        # Verify status was updated twice: processing and completed
        self.assertEqual(mock_update_status.call_count, 2)
        
        # First call: processing (positional arguments)
        first_call = mock_update_status.call_args_list[0]
        self.assertEqual(first_call[0][0], self.test_document_id)  # document_id
        self.assertEqual(first_call[0][1], 'processing')  # status
        
        # Second call: completed (keyword arguments)
        second_call = mock_update_status.call_args_list[1]
        self.assertEqual(second_call[0][0], self.test_document_id)  # document_id
        self.assertEqual(second_call[0][1], 'completed')  # status
        self.assertEqual(second_call[1]['chunk_count'], 10)
        self.assertEqual(second_call[1]['page_count'], 5)
