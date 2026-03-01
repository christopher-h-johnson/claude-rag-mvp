variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "kms_key_id" {
  description = "KMS key ID for SNS topic encryption"
  type        = string
}

variable "alert_email" {
  description = "Email address for alert notifications (optional). If provided, email subscriptions will be created for all SNS topics."
  type        = string
  default     = ""
}
