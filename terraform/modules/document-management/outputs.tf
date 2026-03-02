output "upload_function_name" {
  description = "Name of the Upload Lambda function"
  value       = aws_lambda_function.upload.function_name
}

output "upload_function_arn" {
  description = "ARN of the Upload Lambda function"
  value       = aws_lambda_function.upload.arn
}

output "upload_invoke_arn" {
  description = "Invoke ARN of the Upload Lambda function"
  value       = aws_lambda_function.upload.invoke_arn
}

output "list_function_name" {
  description = "Name of the List Lambda function"
  value       = aws_lambda_function.list.function_name
}

output "list_function_arn" {
  description = "ARN of the List Lambda function"
  value       = aws_lambda_function.list.arn
}

output "list_invoke_arn" {
  description = "Invoke ARN of the List Lambda function"
  value       = aws_lambda_function.list.invoke_arn
}

output "delete_function_name" {
  description = "Name of the Delete Lambda function"
  value       = aws_lambda_function.delete.function_name
}

output "delete_function_arn" {
  description = "ARN of the Delete Lambda function"
  value       = aws_lambda_function.delete.arn
}

output "delete_invoke_arn" {
  description = "Invoke ARN of the Delete Lambda function"
  value       = aws_lambda_function.delete.invoke_arn
}
