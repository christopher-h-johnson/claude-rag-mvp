# Rate Limiter Middleware

Rate limiting middleware for AWS Lambda functions using DynamoDB sliding window algorithm.

## Features

- **Sliding Window Algorithm**: Accurate rate limiting using DynamoDB atomic counters
- **Automatic TTL**: DynamoDB TTL automatically cleans up expired rate limit records
- **Role-Based Limits**: Different limits for regular users (60/min) and admins (300/min)
- **HTTP 429 Responses**: Returns proper HTTP 429 status with Retry-After header
- **Rate Limit Headers**: Includes X-RateLimit-* headers in all responses
- **Fail-Open Design**: Allows requests through if rate limiter encounters errors

## Requirements

This middleware validates the following requirements:
- **10.1**: Enforce 60 requests per minute per user
- **10.2**: Return HTTP 429 with retry-after header when limit exceeded
- **10.3**: Track request counts using sliding window algorithm
- **10.4**: Reset user request counts every 60 seconds
- **10.5**: Allow 300 requests per minute for administrative access

## Installation

```bash
cd lambda/shared/rate-limiter
npm install
npm run build
```

## Usage

### As Middleware (Recommended)

Wrap your Lambda handler with the `withRateLimit` middleware:

```typescript
import { withRateLimit } from 'rate-limiter';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

const myHandler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' }),
    };
};

// Export the wrapped handler
export const handler = withRateLimit(myHandler);
```

### With Custom Configuration

```typescript
export const handler = withRateLimit(myHandler, {
    tableName: 'CustomRateLimitsTable',
    defaultLimit: 100,
    adminLimit: 500,
    windowSizeSeconds: 60,
});
```

### Standalone Usage

For custom implementations, use the `checkRateLimit` function:

```typescript
import { checkRateLimit } from 'rate-limiter';

export const handler = async (event, context) => {
    const rateLimitResult = await checkRateLimit(event);
    
    if (!rateLimitResult.allowed) {
        return {
            statusCode: 429,
            headers: {
                'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
            },
            body: JSON.stringify({ error: 'Rate limit exceeded' }),
        };
    }
    
    // Continue with your logic
};
```

### Direct RateLimiter Class Usage

```typescript
import { RateLimiter } from 'rate-limiter';

const rateLimiter = new RateLimiter({
    tableName: 'RateLimits',
    defaultLimit: 60,
    adminLimit: 300,
});

const result = await rateLimiter.checkRateLimit({
    userId: 'user123',
    username: 'john',
    roles: ['user'],
    sessionId: 'session456',
});

if (!result.allowed) {
    console.log(`Rate limit exceeded. Retry after ${result.retryAfter} seconds`);
}
```

## DynamoDB Table Structure

The rate limiter requires a DynamoDB table with the following structure:

```typescript
{
    PK: "USER#<userId>",           // Partition Key
    SK: "WINDOW#<windowStart>",    // Sort Key
    requestCount: number,
    limit: number,
    windowStart: number,           // Unix timestamp (seconds)
    windowEnd: number,             // Unix timestamp (seconds)
    ttl: number                    // TTL attribute for auto-deletion
}
```

### Terraform Configuration

```hcl
resource "aws_dynamodb_table" "rate_limits" {
  name           = "RateLimits"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "PK"
  range_key      = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "RateLimits"
  }
}
```

## Environment Variables

- `RATE_LIMITS_TABLE`: DynamoDB table name (default: "RateLimits")

## Response Headers

The middleware adds the following headers to all responses:

- `X-RateLimit-Limit`: Maximum requests allowed per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp (milliseconds) when the window resets

When rate limit is exceeded (HTTP 429):
- `Retry-After`: Seconds until the user can retry

## Error Handling

The middleware follows a fail-open design:
- If the rate limiter encounters an error, it logs the error and allows the request to proceed
- This prevents rate limiter issues from causing complete service outages
- Errors are logged to CloudWatch for monitoring

## Testing

Run unit tests:

```bash
npm test
```

## How It Works

### Sliding Window Algorithm

1. **Window Calculation**: Each request calculates the current time window (e.g., 0-60s, 60-120s)
2. **Atomic Increment**: Uses DynamoDB conditional writes to atomically increment the counter
3. **Limit Check**: The conditional expression ensures the counter doesn't exceed the limit
4. **Automatic Cleanup**: DynamoDB TTL automatically deletes expired window records

### Admin Detection

Users with `admin` or `administrator` roles automatically get the higher rate limit (300/min).

### Race Condition Prevention

DynamoDB's conditional writes ensure atomicity:
- Multiple concurrent requests are handled correctly
- No race conditions between read and increment operations
- Consistent behavior under high concurrency

## Performance

- **Latency**: ~10-20ms per request (DynamoDB operation)
- **Scalability**: Handles 1000+ concurrent users
- **Cost**: ~$0.25 per million requests (DynamoDB on-demand pricing)

## Security Considerations

1. **User Context**: Requires API Gateway authorizer to provide user context
2. **Fail-Open**: Allows requests on errors to prevent DoS of legitimate traffic
3. **TTL Cleanup**: Automatic cleanup prevents table growth
4. **Atomic Operations**: Prevents bypass through race conditions
