variable "environment" {
  description = "Environment name"
  type        = string
}

variable "account_id" {
  description = "AWS Account ID"
  type        = string
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption"
  type        = string
}

variable "cors_origin" {
  description = "CORS origin for S3 bucket (e.g., http://localhost:5173 for development)"
  type        = string
  default     = "http://localhost:5173"
}
