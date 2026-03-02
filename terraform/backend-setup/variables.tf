variable "aws_region" {
  description = "AWS region for the backend resources"
  type        = string
  default     = "us-east-2"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "state_bucket_prefix" {
  description = "Prefix for the S3 state bucket name"
  type        = string
  default     = "terraform-state-chatbot"
}

variable "lock_table_prefix" {
  description = "Prefix for the DynamoDB lock table name"
  type        = string
  default     = "terraform-locks"
}
