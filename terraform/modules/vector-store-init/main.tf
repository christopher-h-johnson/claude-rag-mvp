locals {
  lambda_runtime = "nodejs22.x"
  lambda_timeout = 60
  lambda_memory  = 512
}

# Archive Vector Store Init Index Lambda
data "archive_file" "init_index" {
  type        = "zip"
  source_dir  = "${path.module}/../../../lambda/vector-store/init-index/dist"
  output_path = "${path.module}/../../../lambda/vector-store/init-index/dist/index.zip"
}

# IAM Role for Vector Store Init Index Lambda
resource "aws_iam_role" "init_index_role" {
  name = "${var.environment}-vector-store-init-role"

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
    Name = "${var.environment}-vector-store-init-role"
  }
}

# IAM Policy for Vector Store Init Index Lambda
resource "aws_iam_role_policy" "init_index_policy" {
  name = "${var.environment}-vector-store-init-policy"
  role = aws_iam_role.init_index_role.id

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
          "es:ESHttpPut",
          "es:ESHttpGet",
          "es:ESHttpHead"
        ]
        Resource = "${var.opensearch_domain_arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
          "ec2:AssignPrivateIpAddresses",
          "ec2:UnassignPrivateIpAddresses"
        ]
        Resource = "*"
      }
    ]
  })
}

# Vector Store Init Index Lambda Function
resource "aws_lambda_function" "init_index" {
  filename         = data.archive_file.init_index.output_path
  source_code_hash = data.archive_file.init_index.output_base64sha256
  function_name    = "${var.environment}-vector-store-init-index"
  role             = aws_iam_role.init_index_role.arn
  handler          = "index.handler"
  runtime          = local.lambda_runtime
  timeout          = local.lambda_timeout
  memory_size      = local.lambda_memory

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = var.security_group_ids
  }

  environment {
    variables = {
      OPENSEARCH_ENDPOINT = var.opensearch_endpoint
    }
  }

  tags = {
    Name = "${var.environment}-vector-store-init-index"
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "init_index_logs" {
  name              = "/aws/lambda/${aws_lambda_function.init_index.function_name}"
  retention_in_days = 365

  tags = {
    Name = "${var.environment}-vector-store-init-index-logs"
  }
}
