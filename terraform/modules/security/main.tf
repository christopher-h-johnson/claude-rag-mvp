# KMS Key for Encryption
resource "aws_kms_key" "main" {
  description             = "${var.environment} Chatbot Encryption Key"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name        = "${var.environment}-chatbot-kms-key"
    Environment = var.environment
  }
}

resource "aws_kms_alias" "main" {
  name          = "alias/${var.environment}-chatbot"
  target_key_id = aws_kms_key.main.key_id
}

# Security Group for OpenSearch
resource "aws_security_group" "opensearch" {
  name_prefix = "${var.environment}-opensearch-"
  description = "Security group for OpenSearch cluster"
  vpc_id      = var.vpc_id

  ingress {
    description     = "HTTPS from Lambda"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-chatbot-opensearch-sg"
    Environment = var.environment
  }
}

# Security Group for Lambda Functions
resource "aws_security_group" "lambda" {
  name_prefix = "${var.environment}-lambda-"
  description = "Security group for Lambda functions"
  vpc_id      = var.vpc_id

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-chatbot-lambda-sg"
    Environment = var.environment
  }
}

# IAM Role for Lambda Execution
resource "aws_iam_role" "lambda_execution" {
  name_prefix = "${var.environment}-lambda-execution-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-chatbot-lambda-execution-role"
    Environment = var.environment
  }
}

# IAM Policy for Lambda Basic Execution
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# IAM Policy for Lambda VPC Execution
resource "aws_iam_role_policy_attachment" "lambda_vpc_execution" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# IAM Policy for Lambda to access DynamoDB
resource "aws_iam_policy" "lambda_dynamodb" {
  name_prefix = "${var.environment}-lambda-dynamodb-"
  description = "Policy for Lambda to access DynamoDB tables"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          "arn:aws:dynamodb:*:${var.account_id}:table/${var.environment}-chatbot-*"
        ]
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-chatbot-lambda-dynamodb-policy"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.lambda_dynamodb.arn
}

# IAM Policy for Lambda to access S3
resource "aws_iam_policy" "lambda_s3" {
  name_prefix = "${var.environment}-lambda-s3-"
  description = "Policy for Lambda to access S3 buckets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.environment}-chatbot-documents-${var.account_id}",
          "arn:aws:s3:::${var.environment}-chatbot-documents-${var.account_id}/*"
        ]
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-chatbot-lambda-s3-policy"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "lambda_s3" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.lambda_s3.arn
}

# IAM Policy for Lambda to access Bedrock
resource "aws_iam_policy" "lambda_bedrock" {
  name_prefix = "${var.environment}-lambda-bedrock-"
  description = "Policy for Lambda to access Amazon Bedrock"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = [
          "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0",
          "arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v1"
        ]
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-chatbot-lambda-bedrock-policy"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "lambda_bedrock" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.lambda_bedrock.arn
}

# IAM Policy for Lambda to access OpenSearch
resource "aws_iam_policy" "lambda_opensearch" {
  name_prefix = "${var.environment}-lambda-opensearch-"
  description = "Policy for Lambda to access OpenSearch"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "es:ESHttpGet",
          "es:ESHttpPut",
          "es:ESHttpPost",
          "es:ESHttpDelete",
          "es:ESHttpHead"
        ]
        Resource = "arn:aws:es:*:${var.account_id}:domain/${var.environment}-chatbot-opensearch/*"
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-chatbot-lambda-opensearch-policy"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "lambda_opensearch" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.lambda_opensearch.arn
}

# IAM Policy for Lambda to use KMS
resource "aws_iam_policy" "lambda_kms" {
  name_prefix = "${var.environment}-lambda-kms-"
  description = "Policy for Lambda to use KMS for encryption/decryption"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = aws_kms_key.main.arn
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-chatbot-lambda-kms-policy"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "lambda_kms" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.lambda_kms.arn
}

# IAM Role for API Gateway to invoke Lambda
resource "aws_iam_role" "api_gateway" {
  name_prefix = "${var.environment}-api-gateway-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-chatbot-api-gateway-role"
    Environment = var.environment
  }
}

# IAM Policy for API Gateway to invoke Lambda
resource "aws_iam_policy" "api_gateway_lambda" {
  name_prefix = "${var.environment}-api-gateway-lambda-"
  description = "Policy for API Gateway to invoke Lambda functions"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = "arn:aws:lambda:*:${var.account_id}:function:${var.environment}-chatbot-*"
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-chatbot-api-gateway-lambda-policy"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "api_gateway_lambda" {
  role       = aws_iam_role.api_gateway.name
  policy_arn = aws_iam_policy.api_gateway_lambda.arn
}

# IAM Policy for API Gateway CloudWatch Logs
resource "aws_iam_role_policy_attachment" "api_gateway_cloudwatch" {
  role       = aws_iam_role.api_gateway.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}
