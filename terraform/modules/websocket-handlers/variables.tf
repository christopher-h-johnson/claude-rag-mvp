variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "connections_table_name" {
  description = "Name of the DynamoDB connections table"
  type        = string
}

variable "connections_table_arn" {
  description = "ARN of the DynamoDB connections table"
  type        = string
}

variable "websocket_api_id" {
  description = "WebSocket API Gateway ID"
  type        = string
}

variable "websocket_api_execution_arn" {
  description = "WebSocket API Gateway execution ARN"
  type        = string
}

variable "kms_key_arn" {
  description = "ARN of the KMS key for encryption/decryption"
  type        = string
}
