output "log_group_names" {
  description = "CloudWatch log group names"
  value = {
    api_gateway          = aws_cloudwatch_log_group.api_gateway.name
    lambda_auth          = aws_cloudwatch_log_group.lambda_auth.name
    lambda_websocket     = aws_cloudwatch_log_group.lambda_websocket.name
    lambda_chat          = aws_cloudwatch_log_group.lambda_chat.name
    lambda_doc_processor = aws_cloudwatch_log_group.lambda_document_processor.name
    lambda_embedding     = aws_cloudwatch_log_group.lambda_embedding_generator.name
    lambda_upload        = aws_cloudwatch_log_group.lambda_upload_handler.name
    audit_logs           = aws_cloudwatch_log_group.audit_logs.name
    application_logs     = aws_cloudwatch_log_group.application_logs.name
  }
}

output "log_group_arns" {
  description = "CloudWatch log group ARNs"
  value = {
    api_gateway          = aws_cloudwatch_log_group.api_gateway.arn
    lambda_auth          = aws_cloudwatch_log_group.lambda_auth.arn
    lambda_websocket     = aws_cloudwatch_log_group.lambda_websocket.arn
    lambda_chat          = aws_cloudwatch_log_group.lambda_chat.arn
    lambda_doc_processor = aws_cloudwatch_log_group.lambda_document_processor.arn
    lambda_embedding     = aws_cloudwatch_log_group.lambda_embedding_generator.arn
    lambda_upload        = aws_cloudwatch_log_group.lambda_upload_handler.arn
    audit_logs           = aws_cloudwatch_log_group.audit_logs.arn
    application_logs     = aws_cloudwatch_log_group.application_logs.arn
  }
}

output "alarm_arns" {
  description = "CloudWatch alarm ARNs"
  value = {
    lambda_errors   = aws_cloudwatch_metric_alarm.lambda_errors.arn
    api_gateway_5xx = aws_cloudwatch_metric_alarm.api_gateway_5xx.arn
    high_latency    = aws_cloudwatch_metric_alarm.high_latency.arn
  }
}
