variable "environment" {
  description = "Environment name"
  type        = string
}

variable "documents_bucket_name" {
  description = "S3 documents bucket name"
  type        = string
}

variable "documents_bucket_arn" {
  description = "S3 documents bucket ARN"
  type        = string
}

variable "document_metadata_table_name" {
  description = "DynamoDB DocumentMetadata table name"
  type        = string
}

variable "document_metadata_table_arn" {
  description = "DynamoDB DocumentMetadata table ARN"
  type        = string
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption"
  type        = string
}

variable "failed_processing_sns_topic_arn" {
  description = "SNS topic ARN for failed processing notifications (optional)"
  type        = string
  default     = ""
}
