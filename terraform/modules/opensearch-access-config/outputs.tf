output "function_arn" {
  description = "ARN of the Configure Access Lambda function"
  value       = aws_lambda_function.configure_access.arn
}

output "function_name" {
  description = "Name of the Configure Access Lambda function"
  value       = aws_lambda_function.configure_access.function_name
}

output "invoke_command" {
  description = "AWS CLI command to invoke the function"
  value       = "aws lambda invoke --function-name ${aws_lambda_function.configure_access.function_name} --payload '{\"lambdaRoleArn\":\"ROLE_ARN_HERE\"}' response.json"
}

output "configure_access_role_arn" {
  description = "ARN of the configure access Lambda IAM role"
  value       = aws_iam_role.configure_access_role.arn
}
