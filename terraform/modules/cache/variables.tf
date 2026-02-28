variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where Redis cluster will be deployed"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for Redis cluster"
  type        = list(string)
}

variable "lambda_security_group_id" {
  description = "Security group ID of Lambda functions that need Redis access"
  type        = string
}

variable "node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "num_cache_nodes" {
  description = "Number of cache nodes in the cluster (1 for single node, 2+ for HA)"
  type        = number
  default     = 1
}

variable "snapshot_retention_limit" {
  description = "Number of days to retain automatic snapshots (0 to disable backups)"
  type        = number
  default     = 0
}

variable "enable_encryption_at_rest" {
  description = "Enable encryption at rest (adds cost)"
  type        = bool
  default     = false
}

variable "enable_encryption_in_transit" {
  description = "Enable encryption in transit (requires TLS, no additional cost)"
  type        = bool
  default     = false
}

variable "notification_topic_arn" {
  description = "SNS topic ARN for ElastiCache notifications"
  type        = string
  default     = ""
}
