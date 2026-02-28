# OpenSearch Access Configuration Lambda

Lambda function to configure OpenSearch role mapping for IAM roles. This function runs inside the VPC and can access the private OpenSearch domain to configure fine-grained access control.

## Purpose

When OpenSearch has fine-grained access control enabled, Lambda functions using IAM authentication need their IAM roles mapped to OpenSearch roles. This Lambda function automates that mapping process.

## How It Works

1. Connects to OpenSearch using master username/password
2. Retrieves the current role mapping for the specified OpenSearch role (default: `all_access`)
3. Adds the Lambda IAM role ARN to the `backend_roles` list
4. Updates the role mapping in OpenSearch

## Usage

### 1. Build the Lambda

```bash
cd lambda/vector-store/configure-access
npm run build:terraform
```

This will:
- Install dependencies
- Compile TypeScript to JavaScript
- Copy node_modules to dist/ for Lambda deployment

### 2. Deploy with Terraform

The Lambda is deployed as part of the infrastructure. See `terraform/modules/opensearch-access-config`.

### 3. Invoke to Configure Access

```bash
# Get the Lambda role ARN that needs access
LAMBDA_ROLE_ARN=$(cd terraform && terraform output -raw vector_store_init_lambda_role_arn)

# Invoke the configuration function
aws lambda invoke \
  --function-name dev-opensearch-configure-access \
  --payload "{\"lambdaRoleArn\":\"${LAMBDA_ROLE_ARN}\"}" \
  response.json

cat response.json
```

Expected response:
```json
{
  "statusCode": 200,
  "body": "{\"success\":true,\"message\":\"Successfully mapped Lambda role arn:aws:iam::123456789:role/dev-vector-store-init-role to OpenSearch role all_access\"}"
}
```

### 4. Test the Original Lambda

After configuring access, test that the vector-store-init Lambda can now access OpenSearch:

```bash
aws lambda invoke \
  --function-name dev-vector-store-init-index \
  --payload '{}' \
  response.json

cat response.json
```

## Request Format

```json
{
  "lambdaRoleArn": "arn:aws:iam::123456789:role/my-lambda-role",
  "opensearchRole": "all_access"  // Optional, defaults to "all_access"
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| OPENSEARCH_ENDPOINT | OpenSearch domain endpoint | Yes |
| OPENSEARCH_MASTER_USER | Master username | Yes |
| OPENSEARCH_MASTER_PASSWORD | Master password | Yes |

## Response Format

### Success (200)
```json
{
  "statusCode": 200,
  "body": "{\"success\":true,\"message\":\"Successfully mapped Lambda role...\"}"
}
```

### Error (400/500)
```json
{
  "statusCode": 500,
  "body": "{\"error\":\"Failed to configure OpenSearch access\",\"message\":\"...\"}"
}
```

## Security Considerations

1. **Master Credentials**: The function requires master username/password. In production:
   - Store credentials in AWS Secrets Manager
   - Rotate credentials regularly
   - Use IAM policies to restrict access to the secret

2. **VPC Access**: The function must run in the same VPC as OpenSearch

3. **Least Privilege**: Consider creating a custom OpenSearch role with minimal permissions instead of using `all_access`

## Troubleshooting

### "OPENSEARCH_ENDPOINT environment variable not set"

The Lambda environment variables are not configured. Check Terraform deployment.

### "Failed to map role: Connection timeout"

The Lambda cannot reach OpenSearch. Check:
- Lambda is in the correct VPC and subnets
- Security groups allow Lambda → OpenSearch traffic (port 443)
- OpenSearch is accessible from the Lambda subnets

### "Failed to map role: 401 Unauthorized"

The master username/password is incorrect. Verify the credentials.

### "Failed to map role: 403 Forbidden"

The master user doesn't have permission to modify role mappings. This shouldn't happen with the default master user.

## Development

### Run Tests

```bash
npm test
```

### Watch Mode

```bash
npm run test:watch
```

### Clean Build

```bash
npm run clean
npm install
npm run build
```

## Architecture

```
┌─────────────────────┐
│  AWS CLI / Console  │
│  (Invoke Lambda)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐      ┌──────────────────┐
│  Configure Access   │─────▶│  OpenSearch      │
│  Lambda (VPC)       │      │  Security API    │
│                     │◀─────│  (VPC)           │
└─────────────────────┘      └──────────────────┘
           │
           ▼
┌─────────────────────┐
│  CloudWatch Logs    │
└─────────────────────┘
```

## Related Components

- `lambda/vector-store/init-index` - The Lambda that needs OpenSearch access
- `terraform/modules/opensearch-access-config` - Terraform module for deployment
- `terraform/modules/vector-store-init` - The module being configured

## Future Enhancements

1. Support for custom OpenSearch roles with minimal permissions
2. Automatic role mapping during Terraform apply
3. Integration with AWS Secrets Manager for credential management
4. Support for mapping multiple roles at once
5. Validation of role mapping success
