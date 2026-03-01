output "failed_processing_topic_arn" {
  description = "ARN of the failed processing SNS topic"
  value       = aws_sns_topic.failed_processing.arn
}

output "failed_processing_topic_name" {
  description = "Name of the failed processing SNS topic"
  value       = aws_sns_topic.failed_processing.name
}

output "system_alerts_topic_arn" {
  description = "ARN of the system alerts SNS topic"
  value       = aws_sns_topic.system_alerts.arn
}

output "system_alerts_topic_name" {
  description = "Name of the system alerts SNS topic"
  value       = aws_sns_topic.system_alerts.name
}

output "operational_notifications_topic_arn" {
  description = "ARN of the operational notifications SNS topic"
  value       = aws_sns_topic.operational_notifications.arn
}

output "operational_notifications_topic_name" {
  description = "Name of the operational notifications SNS topic"
  value       = aws_sns_topic.operational_notifications.name
}
