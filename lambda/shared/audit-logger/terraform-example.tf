# Example Terraform configuration for CloudWatch Log Groups
# This file demonstrates how to set up the required log groups for the audit logger

# Log group for user actions
resource "aws_cloudwatch_log_group" "user_actions" {
  name              = "/aws/lambda/chatbot/audit/user-actions"
  retention_in_days = 365

  tags = {
    Environment = "production"
    Purpose     = "audit-logging"
    Compliance  = "required"
  }
}

# Log group for API calls
resource "aws_cloudwatch_log_group" "api_calls" {
  name              = "/aws/lambda/chatbot/audit/api-calls"
  retention_in_days = 365

  tags = {
    Environment = "production"
    Purpose     = "audit-logging"
    Compliance  = "required"
  }
}

# Log group for document operations
resource "aws_cloudwatch_log_group" "document_operations" {
  name              = "/aws/lambda/chatbot/audit/document-operations"
  retention_in_days = 365

  tags = {
    Environment = "production"
    Purpose     = "audit-logging"
    Compliance  = "required"
  }
}

# IAM policy for Lambda functions to write to audit log groups
resource "aws_iam_policy" "audit_logging" {
  name        = "chatbot-audit-logging-policy"
  description = "Allow Lambda functions to write audit logs to CloudWatch"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = [
          "${aws_cloudwatch_log_group.user_actions.arn}:*",
          "${aws_cloudwatch_log_group.api_calls.arn}:*",
          "${aws_cloudwatch_log_group.document_operations.arn}:*"
        ]
      }
    ]
  })
}

# Attach the policy to Lambda execution roles
# Example for a chat handler Lambda function
resource "aws_iam_role_policy_attachment" "chat_handler_audit_logging" {
  role       = aws_iam_role.chat_handler.name
  policy_arn = aws_iam_policy.audit_logging.arn
}

# CloudWatch Logs Insights saved queries for common audit scenarios

# Query 1: User login activity
resource "aws_cloudwatch_query_definition" "user_login_activity" {
  name = "Audit - User Login Activity"

  log_group_names = [
    aws_cloudwatch_log_group.user_actions.name
  ]

  query_string = <<-EOT
    fields @timestamp, userId, ipAddress, userAgent, metadata
    | filter eventType = "login"
    | sort @timestamp desc
    | limit 100
  EOT
}

# Query 2: Failed operations
resource "aws_cloudwatch_query_definition" "failed_operations" {
  name = "Audit - Failed Operations"

  log_group_names = [
    aws_cloudwatch_log_group.document_operations.name
  ]

  query_string = <<-EOT
    fields @timestamp, operation, documentId, documentName, userId, errorMessage
    | filter status = "failed"
    | sort @timestamp desc
    | limit 50
  EOT
}

# Query 3: Bedrock API usage
resource "aws_cloudwatch_query_definition" "bedrock_usage" {
  name = "Audit - Bedrock API Usage by User"

  log_group_names = [
    aws_cloudwatch_log_group.api_calls.name
  ]

  query_string = <<-EOT
    fields userId, tokenCount
    | filter service = "bedrock"
    | stats count() as apiCalls, sum(tokenCount) as totalTokens by userId
    | sort totalTokens desc
  EOT
}

# Query 4: High latency API calls
resource "aws_cloudwatch_query_definition" "high_latency_calls" {
  name = "Audit - High Latency API Calls"

  log_group_names = [
    aws_cloudwatch_log_group.api_calls.name
  ]

  query_string = <<-EOT
    fields @timestamp, service, operation, userId, duration, statusCode
    | filter duration > 2000
    | sort duration desc
    | limit 100
  EOT
}

# Query 5: Document upload volume
resource "aws_cloudwatch_query_definition" "document_upload_volume" {
  name = "Audit - Document Upload Volume"

  log_group_names = [
    aws_cloudwatch_log_group.document_operations.name
  ]

  query_string = <<-EOT
    fields userId, fileSize
    | filter operation = "upload"
    | stats count() as uploadCount, sum(fileSize) as totalBytes by userId
    | sort totalBytes desc
  EOT
}

# CloudWatch metric filter for failed document operations
resource "aws_cloudwatch_log_metric_filter" "failed_document_operations" {
  name           = "FailedDocumentOperations"
  log_group_name = aws_cloudwatch_log_group.document_operations.name
  pattern        = "{ $.status = \"failed\" }"

  metric_transformation {
    name      = "FailedDocumentOperations"
    namespace = "Chatbot/Audit"
    value     = "1"
    unit      = "Count"
  }
}

# CloudWatch alarm for high rate of failed operations
resource "aws_cloudwatch_metric_alarm" "high_failure_rate" {
  alarm_name          = "chatbot-high-document-failure-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "FailedDocumentOperations"
  namespace           = "Chatbot/Audit"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "Alert when document operation failure rate is high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  treat_missing_data = "notBreaching"
}

# SNS topic for alerts (example)
resource "aws_sns_topic" "alerts" {
  name = "chatbot-audit-alerts"
}

# Outputs
output "user_actions_log_group_name" {
  value       = aws_cloudwatch_log_group.user_actions.name
  description = "CloudWatch log group name for user actions"
}

output "api_calls_log_group_name" {
  value       = aws_cloudwatch_log_group.api_calls.name
  description = "CloudWatch log group name for API calls"
}

output "document_operations_log_group_name" {
  value       = aws_cloudwatch_log_group.document_operations.name
  description = "CloudWatch log group name for document operations"
}

output "audit_logging_policy_arn" {
  value       = aws_iam_policy.audit_logging.arn
  description = "IAM policy ARN for audit logging permissions"
}
