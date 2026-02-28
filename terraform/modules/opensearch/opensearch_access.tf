# This file handles OpenSearch access policy updates for Lambda roles
# It's separated to avoid circular dependencies

# Note: When using fine-grained access control with IAM authentication,
# Lambda roles need to be mapped to OpenSearch roles.
# This is typically done through the OpenSearch Dashboards UI or API.
#
# For production use, you should:
# 1. Create the OpenSearch domain
# 2. Create Lambda roles
# 3. Map Lambda roles to OpenSearch roles using the Security plugin
#
# Example mapping (done via OpenSearch API or Dashboards):
# PUT _plugins/_security/api/rolesmapping/all_access
# {
#   "backend_roles": ["arn:aws:iam::ACCOUNT:role/LAMBDA_ROLE_NAME"]
# }
