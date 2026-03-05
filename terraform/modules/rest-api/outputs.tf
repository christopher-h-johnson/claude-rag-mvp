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

output "body_validator_id" {
  description = "ID of the body request validator"
  value       = aws_api_gateway_request_validator.body_validator.id
}

output "params_validator_id" {
  description = "ID of the parameters request validator"
  value       = aws_api_gateway_request_validator.params_validator.id
}

output "all_validator_id" {
  description = "ID of the all (body + params) request validator"
  value       = aws_api_gateway_request_validator.all_validator.id
}

output "waf_web_acl_id" {
  description = "ID of the WAF Web ACL"
  value       = var.enable_waf ? aws_wafv2_web_acl.api_gateway[0].id : null
}

output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL"
  value       = var.enable_waf ? aws_wafv2_web_acl.api_gateway[0].arn : null
}

output "waf_web_acl_capacity" {
  description = "Capacity units used by the WAF Web ACL"
  value       = var.enable_waf ? aws_wafv2_web_acl.api_gateway[0].capacity : null
}
