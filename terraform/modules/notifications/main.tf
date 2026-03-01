# Notifications Module
# This module creates SNS topics for system notifications including
# failed document processing, system alerts, and operational notifications.

# SNS Topic for Failed Document Processing
# Validates: Requirements 5.3, 14.3
resource "aws_sns_topic" "failed_processing" {
  name              = "${var.environment}-chatbot-failed-processing"
  display_name      = "Chatbot Failed Document Processing Notifications"
  kms_master_key_id = var.kms_key_id

  tags = {
    Name        = "${var.environment}-chatbot-failed-processing-topic"
    Environment = var.environment
    Purpose     = "document-processing-failures"
  }
}

# SNS Topic Policy for Failed Processing
resource "aws_sns_topic_policy" "failed_processing" {
  arn = aws_sns_topic.failed_processing.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaPublish"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = [
          "SNS:Publish"
        ]
        Resource = aws_sns_topic.failed_processing.arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      },
      {
        Sid    = "AllowAccountOwnerAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "SNS:GetTopicAttributes",
          "SNS:SetTopicAttributes",
          "SNS:AddPermission",
          "SNS:RemovePermission",
          "SNS:DeleteTopic",
          "SNS:Subscribe",
          "SNS:ListSubscriptionsByTopic",
          "SNS:Publish"
        ]
        Resource = aws_sns_topic.failed_processing.arn
      }
    ]
  })
}

# Email Subscription for Failed Processing (if email provided)
resource "aws_sns_topic_subscription" "failed_processing_email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.failed_processing.arn
  protocol  = "email"
  endpoint  = var.alert_email

  # Note: Email subscriptions require manual confirmation
  # The subscriber will receive a confirmation email from AWS
}

# SNS Topic for System Alerts
resource "aws_sns_topic" "system_alerts" {
  name              = "${var.environment}-chatbot-system-alerts"
  display_name      = "Chatbot System Alerts"
  kms_master_key_id = var.kms_key_id

  tags = {
    Name        = "${var.environment}-chatbot-system-alerts-topic"
    Environment = var.environment
    Purpose     = "system-alerts"
  }
}

# SNS Topic Policy for System Alerts
resource "aws_sns_topic_policy" "system_alerts" {
  arn = aws_sns_topic.system_alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudWatchPublish"
        Effect = "Allow"
        Principal = {
          Service = "cloudwatch.amazonaws.com"
        }
        Action = [
          "SNS:Publish"
        ]
        Resource = aws_sns_topic.system_alerts.arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      },
      {
        Sid    = "AllowAccountOwnerAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "SNS:GetTopicAttributes",
          "SNS:SetTopicAttributes",
          "SNS:AddPermission",
          "SNS:RemovePermission",
          "SNS:DeleteTopic",
          "SNS:Subscribe",
          "SNS:ListSubscriptionsByTopic",
          "SNS:Publish"
        ]
        Resource = aws_sns_topic.system_alerts.arn
      }
    ]
  })
}

# Email Subscription for System Alerts (if email provided)
resource "aws_sns_topic_subscription" "system_alerts_email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.system_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# SNS Topic for Operational Notifications
resource "aws_sns_topic" "operational_notifications" {
  name              = "${var.environment}-chatbot-operational-notifications"
  display_name      = "Chatbot Operational Notifications"
  kms_master_key_id = var.kms_key_id

  tags = {
    Name        = "${var.environment}-chatbot-operational-notifications-topic"
    Environment = var.environment
    Purpose     = "operational-notifications"
  }
}

# SNS Topic Policy for Operational Notifications
resource "aws_sns_topic_policy" "operational_notifications" {
  arn = aws_sns_topic.operational_notifications.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowServicesPublish"
        Effect = "Allow"
        Principal = {
          Service = [
            "lambda.amazonaws.com",
            "events.amazonaws.com",
            "s3.amazonaws.com"
          ]
        }
        Action = [
          "SNS:Publish"
        ]
        Resource = aws_sns_topic.operational_notifications.arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      },
      {
        Sid    = "AllowAccountOwnerAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "SNS:GetTopicAttributes",
          "SNS:SetTopicAttributes",
          "SNS:AddPermission",
          "SNS:RemovePermission",
          "SNS:DeleteTopic",
          "SNS:Subscribe",
          "SNS:ListSubscriptionsByTopic",
          "SNS:Publish"
        ]
        Resource = aws_sns_topic.operational_notifications.arn
      }
    ]
  })
}

# Email Subscription for Operational Notifications (if email provided)
resource "aws_sns_topic_subscription" "operational_notifications_email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.operational_notifications.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}
