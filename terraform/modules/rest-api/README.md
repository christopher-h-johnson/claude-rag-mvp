# REST API Gateway Module

This Terraform module creates a REST API Gateway for the AWS Claude RAG Chatbot system with Lambda Authorizer integration.

## Features

- REST API Gateway with regional endpoint
- Lambda Authorizer for token-based authentication
- Authentication endpoints (login, logout)
- CORS configuration for browser access
- CloudWatch logging with 365-day retention
- Throttling (burst=100, rate=50 req/sec)
- Automatic deployment and staging

## Resources Created

1. **API Gateway REST API**
   - Regional endpoint configuration
   - Custom authorizer integration
   - Request/response logging

2. **Lambda Authorizer**
   - Token-based authentication (Authorization header)
   - 5-minute result caching
   - IAM role for API Gateway to invoke authorizer

3. **Authentication Endpoints**
   - `POST /auth/login` - User login (no auth required)
   - `POST /auth/logout` - User logout (requires auth)

4. **CORS Configuration**
   - OPTIONS methods for preflight requests
   - Configured headers and methods
   - Wildcard origin support

5. **CloudWatch Logging**
   - Access logs with structured JSON format
   - 365-day retention for compliance
   - Request/response tracing

6. **Throttling**
   - Burst limit: 100 requests
   - Rate limit: 50 requests/second
   - Applied to all methods

## Usage

```hcl
module "rest_api" {
  source = "./modules/rest-api"

  environment              = "dev"
  authorizer_function_arn  = module.auth.authorizer_function_arn
  authorizer_invoke_arn    = module.auth.authorizer_invoke_arn
  login_function_name      = module.auth.login_function_name
  login_invoke_arn         = module.auth.login_invoke_arn
  logout_function_name     = module.auth.logout_function_name
  logout_invoke_arn        = module.auth.logout_invoke_arn
}
```

## Inputs

| Name | Description | Type | Required |
|------|-------------|------|----------|
| environment | Environment name (e.g., dev, staging, prod) | string | yes |
| authorizer_function_arn | ARN of the Lambda Authorizer function | string | yes |
| authorizer_invoke_arn | Invoke ARN of the Lambda Authorizer function | string | yes |
| login_function_name | Name of the Login Lambda function | string | yes |
| login_invoke_arn | Invoke ARN of the Login Lambda function | string | yes |
| logout_function_name | Name of the Logout Lambda function | string | yes |
| logout_invoke_arn | Invoke ARN of the Logout Lambda function | string | yes |

## Outputs

| Name | Description |
|------|-------------|
| rest_api_id | ID of the REST API |
| rest_api_execution_arn | Execution ARN of the REST API |
| rest_api_root_resource_id | Root resource ID for adding more resources |
| stage_url | Full URL of the API Gateway stage |
| stage_name | Name of the API Gateway stage |
| authorizer_id | ID of the Lambda Authorizer |

## API Endpoints

### POST /auth/login

Login endpoint (no authentication required).

**Request:**
```json
{
  "username": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": 1234567890,
  "userId": "user-123"
}
```

### POST /auth/logout

Logout endpoint (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Authentication

The Lambda Authorizer validates JWT tokens from the `Authorization` header:

```
Authorization: Bearer <jwt-token>
```

The authorizer:
1. Extracts the token from the Authorization header
2. Validates the JWT signature
3. Checks the session in DynamoDB
4. Returns an IAM policy allowing or denying access
5. Caches the result for 5 minutes

## CORS Configuration

CORS is enabled for browser access with the following configuration:

- **Allowed Origins:** `*` (wildcard)
- **Allowed Methods:** `POST, OPTIONS`
- **Allowed Headers:** `Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token`

## Extending the API

To add new endpoints, you can use the module outputs:

```hcl
# Add a new resource
resource "aws_api_gateway_resource" "documents" {
  rest_api_id = module.rest_api.rest_api_id
  parent_id   = module.rest_api.rest_api_root_resource_id
  path_part   = "documents"
}

# Add a method with authorization
resource "aws_api_gateway_method" "documents_get" {
  rest_api_id   = module.rest_api.rest_api_id
  resource_id   = aws_api_gateway_resource.documents.id
  http_method   = "GET"
  authorization = "CUSTOM"
  authorizer_id = module.rest_api.authorizer_id
}
```

## Monitoring

CloudWatch logs are available at:
- `/aws/apigateway/{environment}-chatbot-api`

Metrics available:
- Request count
- Latency (p50, p95, p99)
- 4XX/5XX errors
- Cache hit/miss (authorizer)

## Security

1. **Authentication:** Lambda Authorizer validates all protected endpoints
2. **Encryption:** HTTPS/TLS 1.2+ for all traffic
3. **Throttling:** Rate limiting to prevent abuse
4. **Logging:** Comprehensive audit trail in CloudWatch
5. **IAM:** Least privilege roles for all components

## Cost Optimization

- **Authorizer Caching:** 5-minute TTL reduces Lambda invocations
- **Regional Endpoint:** Lower latency and cost vs edge-optimized
- **Throttling:** Prevents runaway costs from abuse

## Troubleshooting

### 401 Unauthorized

- Verify the JWT token is valid and not expired
- Check that the token is in the Authorization header: `Bearer <token>`
- Check CloudWatch logs for the authorizer function

### 403 Forbidden

- The authorizer denied access (invalid token or session)
- Check the authorizer Lambda logs for details

### 429 Too Many Requests

- Rate limit exceeded (50 req/sec or 100 burst)
- Wait and retry with exponential backoff

### 500 Internal Server Error

- Check CloudWatch logs for the Lambda function
- Verify Lambda has correct IAM permissions
- Check DynamoDB table accessibility

## Dependencies

This module depends on:
- `auth` module (Lambda Authorizer and auth functions)
- `database` module (Sessions table)

## Next Steps

After deploying this module, you can:
1. Add document management endpoints (`/documents`)
2. Add chat history endpoints (`/chat/history`)
3. Configure custom domain with ACM certificate
4. Add AWS WAF for additional security
5. Set up CloudWatch alarms for monitoring
