# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.environment}-chatbot"
  retention_in_days = 365

  tags = {
    Name        = "${var.environment}-chatbot-api-gateway-logs"
    Environment = var.environment
  }
}

# CloudWatch Log Group for Lambda - Authentication
resource "aws_cloudwatch_log_group" "lambda_auth" {
  name              = "/aws/lambda/${var.environment}-chatbot-auth"
  retention_in_days = 365

  tags = {
    Name        = "${var.environment}-chatbot-lambda-auth-logs"
    Environment = var.environment
  }
}

# CloudWatch Log Group for Lambda - WebSocket Handler
resource "aws_cloudwatch_log_group" "lambda_websocket" {
  name              = "/aws/lambda/${var.environment}-chatbot-websocket"
  retention_in_days = 365

  tags = {
    Name        = "${var.environment}-chatbot-lambda-websocket-logs"
    Environment = var.environment
  }
}

# CloudWatch Log Group for Lambda - Chat Handler
resource "aws_cloudwatch_log_group" "lambda_chat" {
  name              = "/aws/lambda/${var.environment}-chatbot-chat"
  retention_in_days = 365

  tags = {
    Name        = "${var.environment}-chatbot-lambda-chat-logs"
    Environment = var.environment
  }
}

# CloudWatch Log Group for Lambda - Document Processor
resource "aws_cloudwatch_log_group" "lambda_document_processor" {
  name              = "/aws/lambda/${var.environment}-chatbot-document-processor"
  retention_in_days = 365

  tags = {
    Name        = "${var.environment}-chatbot-lambda-document-processor-logs"
    Environment = var.environment
  }
}

# CloudWatch Log Group for Lambda - Embedding Generator
resource "aws_cloudwatch_log_group" "lambda_embedding_generator" {
  name              = "/aws/lambda/${var.environment}-chatbot-embedding-generator"
  retention_in_days = 365

  tags = {
    Name        = "${var.environment}-chatbot-lambda-embedding-generator-logs"
    Environment = var.environment
  }
}

# CloudWatch Log Group for Lambda - Upload Handler
resource "aws_cloudwatch_log_group" "lambda_upload_handler" {
  name              = "/aws/lambda/${var.environment}-chatbot-upload-handler"
  retention_in_days = 365

  tags = {
    Name        = "${var.environment}-chatbot-lambda-upload-handler-logs"
    Environment = var.environment
  }
}

# CloudWatch Log Groups for Audit Logging
# Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5

# Audit Log Group - User Actions
resource "aws_cloudwatch_log_group" "audit_user_actions" {
  name              = "/aws/lambda/chatbot/audit/user-actions"
  retention_in_days = 365

  tags = {
    Name        = "${var.environment}-chatbot-audit-user-actions"
    Environment = var.environment
    LogType     = "audit"
    Category    = "user-actions"
  }
}

# Audit Log Group - API Calls
resource "aws_cloudwatch_log_group" "audit_api_calls" {
  name              = "/aws/lambda/chatbot/audit/api-calls"
  retention_in_days = 365

  tags = {
    Name        = "${var.environment}-chatbot-audit-api-calls"
    Environment = var.environment
    LogType     = "audit"
    Category    = "api-calls"
  }
}

# Audit Log Group - Document Operations
resource "aws_cloudwatch_log_group" "audit_document_operations" {
  name              = "/aws/lambda/chatbot/audit/document-operations"
  retention_in_days = 365

  tags = {
    Name        = "${var.environment}-chatbot-audit-document-operations"
    Environment = var.environment
    LogType     = "audit"
    Category    = "document-operations"
  }
}

# CloudWatch Log Group for Application Logs
resource "aws_cloudwatch_log_group" "application_logs" {
  name              = "/aws/chatbot/${var.environment}/application"
  retention_in_days = 365

  tags = {
    Name        = "${var.environment}-chatbot-application-logs"
    Environment = var.environment
  }
}

# CloudWatch Metric Alarm - Lambda Errors
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${var.environment}-chatbot-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "This metric monitors Lambda function errors"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = "${var.environment}-chatbot-*"
  }

  tags = {
    Name        = "${var.environment}-chatbot-lambda-errors-alarm"
    Environment = var.environment
  }
}

# CloudWatch Metric Alarm - API Gateway 5XX Errors
resource "aws_cloudwatch_metric_alarm" "api_gateway_5xx" {
  alarm_name          = "${var.environment}-chatbot-api-gateway-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "This metric monitors API Gateway 5XX errors"
  treat_missing_data  = "notBreaching"

  tags = {
    Name        = "${var.environment}-chatbot-api-gateway-5xx-alarm"
    Environment = var.environment
  }
}

# CloudWatch Metric Alarm - High Response Time
resource "aws_cloudwatch_metric_alarm" "high_latency" {
  alarm_name          = "${var.environment}-chatbot-high-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Average"
  threshold           = 2000
  alarm_description   = "This metric monitors Lambda function duration exceeding 2 seconds"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = "${var.environment}-chatbot-chat"
  }

  tags = {
    Name        = "${var.environment}-chatbot-high-latency-alarm"
    Environment = var.environment
  }
}
