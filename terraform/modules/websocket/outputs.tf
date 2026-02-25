output "websocket_api_id" {
  description = "WebSocket API ID"
  value       = aws_apigatewayv2_api.websocket.id
}

output "websocket_api_endpoint" {
  description = "WebSocket API endpoint URL"
  value       = aws_apigatewayv2_api.websocket.api_endpoint
}

output "websocket_stage_url" {
  description = "WebSocket stage URL"
  value       = aws_apigatewayv2_stage.websocket.invoke_url
}

output "websocket_api_execution_arn" {
  description = "WebSocket API execution ARN"
  value       = aws_apigatewayv2_api.websocket.execution_arn
}
