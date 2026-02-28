locals {
  lambda_runtime = "nodejs22.x"
  lambda_timeout = 60
  lambda_memory  = 512
}

# Archive Configure Access Lambda
data "archive_file" "configure_access" {
  type        = "zip"
  source_dir  = "${path.module}/../../../lambda/vector-store/configure-access/dist"
  output_path = "${path.module}/../../../lambda/vector-store/configure-access/dist/configure-access.zip"
}

# IAM Role for Configure Access Lambda
resource "aws_iam_role" "configure_access_role" {
  name = "${var.environment}-opensearch-configure-access-role"

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
    Name = "${var.environment}-opensearch-configure-access-role"
  }
}

# IAM Policy for Configure Access Lambda
resource "aws_iam_role_policy" "configure_access_policy" {
  name = "${var.environment}-opensearch-configure-access-policy"
  role = aws_iam_role.configure_access_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      # {
      #   Effect = "Allow"
      #   Action = [
      #     "secretsmanager:GetSecretValue"
      #   ]
      #   Resource = var.master_password_secret_arn
      # },
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

# Configure Access Lambda Function
resource "aws_lambda_function" "configure_access" {
  filename         = data.archive_file.configure_access.output_path
  source_code_hash = data.archive_file.configure_access.output_base64sha256
  function_name    = "${var.environment}-opensearch-configure-access"
  role             = aws_iam_role.configure_access_role.arn
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
      OPENSEARCH_ENDPOINT        = var.opensearch_endpoint
      OPENSEARCH_MASTER_USER     = var.master_user_name
      OPENSEARCH_MASTER_PASSWORD = var.master_user_password
    }
  }

  tags = {
    Name = "${var.environment}-opensearch-configure-access"
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "configure_access_logs" {
  name              = "/aws/lambda/${aws_lambda_function.configure_access.function_name}"
  retention_in_days = 30

  tags = {
    Name = "${var.environment}-opensearch-configure-access-logs"
  }
}
