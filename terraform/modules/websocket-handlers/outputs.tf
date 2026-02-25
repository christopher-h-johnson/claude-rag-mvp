output "connect_function_arn" {
  description = "ARN of the WebSocket connect handler Lambda"
  value       = aws_lambda_function.connect.arn
}

output "connect_function_name" {
  description = "Name of the WebSocket connect handler Lambda"
  value       = aws_lambda_function.connect.function_name
}

output "disconnect_function_arn" {
  description = "ARN of the WebSocket disconnect handler Lambda"
  value       = aws_lambda_function.disconnect.arn
}

output "disconnect_function_name" {
  description = "Name of the WebSocket disconnect handler Lambda"
  value       = aws_lambda_function.disconnect.function_name
}

output "message_function_arn" {
  description = "ARN of the WebSocket message handler Lambda"
  value       = aws_lambda_function.message.arn
}

output "message_function_name" {
  description = "Name of the WebSocket message handler Lambda"
  value       = aws_lambda_function.message.function_name
}
