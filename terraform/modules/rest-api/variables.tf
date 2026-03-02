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

variable "document_upload_function_name" {
  description = "Name of the Document Upload Lambda function"
  type        = string
}

variable "document_upload_invoke_arn" {
  description = "Invoke ARN of the Document Upload Lambda function"
  type        = string
}

variable "document_list_function_name" {
  description = "Name of the Document List Lambda function"
  type        = string
}

variable "document_list_invoke_arn" {
  description = "Invoke ARN of the Document List Lambda function"
  type        = string
}

variable "document_delete_function_name" {
  description = "Name of the Document Delete Lambda function"
  type        = string
}

variable "document_delete_invoke_arn" {
  description = "Invoke ARN of the Document Delete Lambda function"
  type        = string
}
