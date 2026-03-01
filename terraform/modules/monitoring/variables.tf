variable "environment" {
  description = "Environment name"
  type        = string
}

variable "system_alerts_topic_arn" {
  description = "SNS topic ARN for system alerts (optional)"
  type        = string
  default     = ""
}
