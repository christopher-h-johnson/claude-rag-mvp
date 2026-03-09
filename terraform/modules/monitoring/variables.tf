variable "environment" {
  description = "Environment name"
  type        = string
}

variable "system_alerts_topic_arn" {
  description = "SNS topic ARN for system alerts (optional)"
  type        = string
  default     = ""
}

variable "aws_region" {
  description = "AWS region for CloudWatch metrics"
  type        = string
  default     = "us-east-2"
}
