# S3 Bucket for Documents
resource "aws_s3_bucket" "documents" {
  bucket = "${var.environment}-chatbot-documents-${var.account_id}"

  tags = {
    Name        = "${var.environment}-chatbot-documents"
    Environment = var.environment
  }
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id

  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

# S3 Bucket Public Access Block
resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 Bucket Lifecycle Configuration
resource "aws_s3_bucket_lifecycle_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    id     = "transition-old-documents"
    status = "Enabled"

    filter {}

    transition {
      days          = 90
      storage_class = "INTELLIGENT_TIERING"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }

  rule {
    id     = "delete-failed-uploads"
    status = "Enabled"

    filter {
      prefix = "failed/"
    }

    expiration {
      days = 30
    }
  }
}

# S3 Bucket Policy - Enforce TLS 1.2+
resource "aws_s3_bucket_policy" "documents" {
  bucket = aws_s3_bucket.documents.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceTLS"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.documents.arn,
          "${aws_s3_bucket.documents.arn}/*"
        ]
        Condition = {
          NumericLessThan = {
            "s3:TlsVersion" = "1.2"
          }
        }
      },
      {
        Sid       = "EnforceSSLOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.documents.arn,
          "${aws_s3_bucket.documents.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# S3 Bucket Notification Configuration is managed by the document-processor module
# to avoid circular dependencies and ensure proper ordering

# Create folder structure using S3 objects
resource "aws_s3_object" "uploads_folder" {
  bucket  = aws_s3_bucket.documents.id
  key     = "uploads/"
  content = ""

  tags = {
    Name        = "Uploads Folder"
    Environment = var.environment
  }
}

resource "aws_s3_object" "processed_folder" {
  bucket  = aws_s3_bucket.documents.id
  key     = "processed/"
  content = ""

  tags = {
    Name        = "Processed Folder"
    Environment = var.environment
  }
}

resource "aws_s3_object" "failed_folder" {
  bucket  = aws_s3_bucket.documents.id
  key     = "failed/"
  content = ""

  tags = {
    Name        = "Failed Folder"
    Environment = var.environment
  }
}
