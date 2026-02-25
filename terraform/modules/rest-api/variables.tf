variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
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

variable "login_function_name" {
  description = "Name of the Login Lambda function"
  type        = string
}

variable "login_invoke_arn" {
  description = "Invoke ARN of the Login Lambda function"
  type        = string
}

variable "logout_function_name" {
  description = "Name of the Logout Lambda function"
  type        = string
}

variable "logout_invoke_arn" {
  description = "Invoke ARN of the Logout Lambda function"
  type        = string
}
