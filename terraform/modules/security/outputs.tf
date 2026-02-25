output "kms_key_arn" {
  description = "KMS key ARN"
  value       = aws_kms_key.main.arn
}

output "kms_key_id" {
  description = "KMS key ID"
  value       = aws_kms_key.main.key_id
}

output "opensearch_security_group_id" {
  description = "OpenSearch security group ID"
  value       = aws_security_group.opensearch.id
}

output "lambda_security_group_id" {
  description = "Lambda security group ID"
  value       = aws_security_group.lambda.id
}

output "lambda_execution_role_arn" {
  description = "Lambda execution role ARN"
  value       = aws_iam_role.lambda_execution.arn
}

output "lambda_execution_role_name" {
  description = "Lambda execution role name"
  value       = aws_iam_role.lambda_execution.name
}

output "api_gateway_role_arn" {
  description = "API Gateway role ARN"
  value       = aws_iam_role.api_gateway.arn
}

output "api_gateway_role_name" {
  description = "API Gateway role name"
  value       = aws_iam_role.api_gateway.name
}
