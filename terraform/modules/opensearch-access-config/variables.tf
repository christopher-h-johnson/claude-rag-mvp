variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "opensearch_endpoint" {
  description = "OpenSearch domain endpoint"
  type        = string
}

variable "master_user_name" {
  description = "Master user name for OpenSearch"
  type        = string
  default     = "admin"
  sensitive   = true
}

variable "master_user_password" {
  description = "OpenSearch master password"
  type        = string
  sensitive   = true
}

variable "master_password_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the master password"
  type        = string
  default     = ""
}

variable "subnet_ids" {
  description = "List of subnet IDs for Lambda VPC configuration"
  type        = list(string)
}

variable "security_group_ids" {
  description = "List of security group IDs for Lambda VPC configuration"
  type        = list(string)
}
