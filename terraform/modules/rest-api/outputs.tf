output "rest_api_id" {
  description = "ID of the REST API"
  value       = aws_api_gateway_rest_api.chatbot.id
}

output "rest_api_execution_arn" {
  description = "Execution ARN of the REST API"
  value       = aws_api_gateway_rest_api.chatbot.execution_arn
}

output "rest_api_root_resource_id" {
  description = "Root resource ID of the REST API"
  value       = aws_api_gateway_rest_api.chatbot.root_resource_id
}

output "stage_url" {
  description = "URL of the API Gateway stage"
  value       = aws_api_gateway_stage.chatbot.invoke_url
}

output "stage_name" {
  description = "Name of the API Gateway stage"
  value       = aws_api_gateway_stage.chatbot.stage_name
}

output "authorizer_id" {
  description = "ID of the Lambda Authorizer"
  value       = aws_api_gateway_authorizer.lambda.id
}
