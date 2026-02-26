variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "authorizer_function_arn" {
  description = "ARN of the Lambda Authorizer function"
  type        = string
}

variable "authorizer_invoke_arn" {
  description = "Invoke ARN of the Lambda Authorizer function"
  type        = string
}

variable "authorizer_function_name" {
  description = "Name of the Lambda Authorizer function"
  type        = string
}

variable "connect_handler_arn" {
  description = "ARN of the WebSocket connect handler Lambda"
  type        = string
}

variable "connect_handler_name" {
  description = "Name of the WebSocket connect handler Lambda"
  type        = string
}

variable "disconnect_handler_arn" {
  description = "ARN of the WebSocket disconnect handler Lambda"
  type        = string
}

variable "disconnect_handler_name" {
  description = "Name of the WebSocket disconnect handler Lambda"
  type        = string
}

variable "message_handler_arn" {
  description = "ARN of the WebSocket message handler Lambda"
  type        = string
}

variable "message_handler_name" {
  description = "Name of the WebSocket message handler Lambda"
  type        = string
}
