# OpenSearch Role Mapping for Lambda IAM Role
# This maps the Lambda IAM role to OpenSearch's all_access role

# Note: This requires the OpenSearch domain to have fine-grained access control enabled
# The mapping allows the Lambda function to authenticate using IAM and access OpenSearch

# Data source to get current AWS account ID and region
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Output the role mapping command for manual execution
# This needs to be run after both OpenSearch and Lambda are created
output "role_mapping_command" {
  description = "Command to map Lambda IAM role to OpenSearch role (run this manually)"
  value       = <<-EOT
    # Map the Lambda IAM role to OpenSearch all_access role
    # Run this command after both OpenSearch and Lambda are deployed:
    
    curl -X PUT "https://${var.opensearch_endpoint}/_plugins/_security/api/rolesmapping/all_access" \
      -u "MASTER_USERNAME:MASTER_PASSWORD" \
      -H "Content-Type: application/json" \
      -d '{
        "backend_roles": ["${aws_iam_role.init_index_role.arn}"],
        "hosts": [],
        "users": []
      }'
    
    # Or use AWS CLI with IAM authentication:
    aws opensearchserverless update-access-policy \
      --name ${var.environment}-vector-store-init \
      --policy-version 1 \
      --policy '[{"Rules":[{"ResourceType":"index","Resource":["index/*/*"],"Permission":["aoss:*"]}],"Principal":["${aws_iam_role.init_index_role.arn}"]}]'
  EOT
}
