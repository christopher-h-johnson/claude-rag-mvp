output "function_name" {
  description = "Document Processor Lambda function name"
  value       = aws_lambda_function.document_processor.function_name
}

output "function_arn" {
  description = "Document Processor Lambda function ARN"
  value       = aws_lambda_function.document_processor.arn
}

output "function_invoke_arn" {
  description = "Document Processor Lambda function invoke ARN"
  value       = aws_lambda_function.document_processor.invoke_arn
}

output "role_arn" {
  description = "Document Processor Lambda IAM role ARN"
  value       = aws_iam_role.document_processor.arn
}

output "layer_arn" {
  description = "Document Processor Lambda layer ARN"
  value       = aws_lambda_layer_version.document_processor_dependencies.arn
}

output "layer_version" {
  description = "Document Processor Lambda layer version"
  value       = aws_lambda_layer_version.document_processor_dependencies.version
}
