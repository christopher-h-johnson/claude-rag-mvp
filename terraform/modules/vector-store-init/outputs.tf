# Outputs for Vector Store Init module

output "function_arn" {
  description = "ARN of the Vector Store Init Lambda function"
  value       = aws_lambda_function.init_index.arn
}

output "function_name" {
  description = "Name of the Vector Store Init Lambda function"
  value       = aws_lambda_function.init_index.function_name
}

output "lambda_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.init_index_role.arn
}

output "lambda_role_name" {
  description = "Name of the Lambda execution role"
  value       = aws_iam_role.init_index_role.name
}
