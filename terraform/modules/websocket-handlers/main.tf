locals {
  lambda_runtime = "nodejs22.x"
  lambda_timeout = 30
}

# Archive WebSocket Connect Handler
data "archive_file" "connect" {
  type        = "zip"
  source_dir  = "${path.module}/../../../lambda/websocket/connect/dist"
  output_path = "${path.module}/../../../lambda/websocket/connect/dist/index.zip"
}

# Archive WebSocket Disconnect Handler
data "archive_file" "disconnect" {
  type        = "zip"
  source_dir  = "${path.module}/../../../lambda/websocket/disconnect/dist"
  output_path = "${path.module}/../../../lambda/websocket/disconnect/dist/index.zip"
}

# Archive WebSocket Message Handler
data "archive_file" "message" {
  type        = "zip"
  source_dir  = "${path.module}/../../../lambda/websocket/message/dist"
  output_path = "${path.module}/../../../lambda/websocket/message/dist/index.zip"
}

# IAM Role for WebSocket Connect Handler
resource "aws_iam_role" "connect_role" {
  name = "${var.environment}-websocket-connect-role"

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
    Name = "${var.environment}-websocket-connect-role"
  }
}

resource "aws_iam_role_policy" "connect_policy" {
  name = "${var.environment}-websocket-connect-policy"
  role = aws_iam_role.connect_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem"
        ]
        Resource = var.connections_table_arn
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = var.kms_key_arn
      }
    ]
  })
}

# WebSocket Connect Lambda
resource "aws_lambda_function" "connect" {
  filename         = data.archive_file.connect.output_path
  source_code_hash = data.archive_file.connect.output_base64sha256
  function_name    = "${var.environment}-websocket-connect"
  role             = aws_iam_role.connect_role.arn
  handler          = "index.handler"
  runtime          = local.lambda_runtime
  timeout          = local.lambda_timeout
  memory_size      = 256

  environment {
    variables = {
      CONNECTIONS_TABLE = var.connections_table_name
    }
  }

  tags = {
    Name = "${var.environment}-websocket-connect"
  }
}

resource "aws_cloudwatch_log_group" "connect_logs" {
  name              = "/aws/lambda/${aws_lambda_function.connect.function_name}"
  retention_in_days = 365

  tags = {
    Name = "${var.environment}-websocket-connect-logs"
  }
}

# IAM Role for WebSocket Disconnect Handler
resource "aws_iam_role" "disconnect_role" {
  name = "${var.environment}-websocket-disconnect-role"

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
    Name = "${var.environment}-websocket-disconnect-role"
  }
}

resource "aws_iam_role_policy" "disconnect_policy" {
  name = "${var.environment}-websocket-disconnect-policy"
  role = aws_iam_role.disconnect_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:DeleteItem",
          "dynamodb:GetItem"
        ]
        Resource = var.connections_table_arn
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = var.kms_key_arn
      }
    ]
  })
}

# WebSocket Disconnect Lambda
resource "aws_lambda_function" "disconnect" {
  filename         = data.archive_file.disconnect.output_path
  source_code_hash = data.archive_file.disconnect.output_base64sha256
  function_name    = "${var.environment}-websocket-disconnect"
  role             = aws_iam_role.disconnect_role.arn
  handler          = "index.handler"
  runtime          = local.lambda_runtime
  timeout          = local.lambda_timeout
  memory_size      = 256

  environment {
    variables = {
      CONNECTIONS_TABLE = var.connections_table_name
    }
  }

  tags = {
    Name = "${var.environment}-websocket-disconnect"
  }
}

resource "aws_cloudwatch_log_group" "disconnect_logs" {
  name              = "/aws/lambda/${aws_lambda_function.disconnect.function_name}"
  retention_in_days = 365

  tags = {
    Name = "${var.environment}-websocket-disconnect-logs"
  }
}

# IAM Role for WebSocket Message Handler (placeholder for future implementation)
resource "aws_iam_role" "message_role" {
  name = "${var.environment}-websocket-message-role"

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
    Name = "${var.environment}-websocket-message-role"
  }
}

resource "aws_iam_role_policy" "message_policy" {
  name = "${var.environment}-websocket-message-policy"
  role = aws_iam_role.message_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query"
        ]
        Resource = var.connections_table_arn
      },
      {
        Effect = "Allow"
        Action = [
          "execute-api:ManageConnections"
        ]
        Resource = "${var.websocket_api_execution_arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = var.kms_key_arn
      }
    ]
  })
}

# WebSocket Message Lambda (placeholder)
resource "aws_lambda_function" "message" {
  filename         = data.archive_file.message.output_path
  source_code_hash = data.archive_file.message.output_base64sha256
  function_name    = "${var.environment}-websocket-message"
  role             = aws_iam_role.message_role.arn
  handler          = "index.handler"
  runtime          = local.lambda_runtime
  timeout          = local.lambda_timeout
  memory_size      = 512

  environment {
    variables = {
      CONNECTIONS_TABLE = var.connections_table_name
      WEBSOCKET_API_ID  = var.websocket_api_id
    }
  }

  tags = {
    Name = "${var.environment}-websocket-message"
  }
}

resource "aws_cloudwatch_log_group" "message_logs" {
  name              = "/aws/lambda/${aws_lambda_function.message.function_name}"
  retention_in_days = 365

  tags = {
    Name = "${var.environment}-websocket-message-logs"
  }
}
