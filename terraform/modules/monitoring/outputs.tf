output "log_group_names" {
  description = "CloudWatch log group names"
  value = {
    api_gateway               = aws_cloudwatch_log_group.api_gateway.name
    lambda_auth               = aws_cloudwatch_log_group.lambda_auth.name
    lambda_websocket          = aws_cloudwatch_log_group.lambda_websocket.name
    lambda_chat               = aws_cloudwatch_log_group.lambda_chat.name
    lambda_doc_processor      = aws_cloudwatch_log_group.lambda_document_processor.name
    lambda_embedding          = aws_cloudwatch_log_group.lambda_embedding_generator.name
    lambda_upload             = aws_cloudwatch_log_group.lambda_upload_handler.name
    application_logs          = aws_cloudwatch_log_group.application_logs.name
    audit_user_actions        = aws_cloudwatch_log_group.audit_user_actions.name
    audit_api_calls           = aws_cloudwatch_log_group.audit_api_calls.name
    audit_document_operations = aws_cloudwatch_log_group.audit_document_operations.name
  }
}

output "log_group_arns" {
  description = "CloudWatch log group ARNs"
  value = {
    api_gateway               = aws_cloudwatch_log_group.api_gateway.arn
    lambda_auth               = aws_cloudwatch_log_group.lambda_auth.arn
    lambda_websocket          = aws_cloudwatch_log_group.lambda_websocket.arn
    lambda_chat               = aws_cloudwatch_log_group.lambda_chat.arn
    lambda_doc_processor      = aws_cloudwatch_log_group.lambda_document_processor.arn
    lambda_embedding          = aws_cloudwatch_log_group.lambda_embedding_generator.arn
    lambda_upload             = aws_cloudwatch_log_group.lambda_upload_handler.arn
    application_logs          = aws_cloudwatch_log_group.application_logs.arn
    audit_user_actions        = aws_cloudwatch_log_group.audit_user_actions.arn
    audit_api_calls           = aws_cloudwatch_log_group.audit_api_calls.arn
    audit_document_operations = aws_cloudwatch_log_group.audit_document_operations.arn
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
