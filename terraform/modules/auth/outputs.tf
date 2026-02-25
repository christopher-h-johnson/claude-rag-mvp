output "authorizer_function_arn" {
  description = "ARN of the Lambda Authorizer function"
  value       = aws_lambda_function.authorizer.arn
}

output "authorizer_function_name" {
  description = "Name of the Lambda Authorizer function"
  value       = aws_lambda_function.authorizer.function_name
}

output "authorizer_invoke_arn" {
  description = "Invoke ARN of the Lambda Authorizer function"
  value       = aws_lambda_function.authorizer.invoke_arn
}

output "login_function_arn" {
  description = "ARN of the Login Lambda function"
  value       = aws_lambda_function.login.arn
}

output "login_function_name" {
  description = "Name of the Login Lambda function"
  value       = aws_lambda_function.login.function_name
}

output "login_invoke_arn" {
  description = "Invoke ARN of the Login Lambda function"
  value       = aws_lambda_function.login.invoke_arn
}

output "logout_function_arn" {
  description = "ARN of the Logout Lambda function"
  value       = aws_lambda_function.logout.arn
}

output "logout_function_name" {
  description = "Name of the Logout Lambda function"
  value       = aws_lambda_function.logout.function_name
}

output "logout_invoke_arn" {
  description = "Invoke ARN of the Logout Lambda function"
  value       = aws_lambda_function.logout.invoke_arn
}
