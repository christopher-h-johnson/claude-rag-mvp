# AWS Claude RAG Chatbot

A production-ready, serverless RAG (Retrieval-Augmented Generation) chatbot system built on AWS that combines Claude 3 Sonnet via Amazon Bedrock with semantic document search capabilities. The system provides real-time chat responses grounded in organizational knowledge from PDF documents.

## Overview

This chatbot system enables users to interact with Claude 3 Sonnet while automatically retrieving relevant context from uploaded PDF documents. The architecture is fully serverless, leveraging AWS Lambda, API Gateway, S3, OpenSearch, and DynamoDB to achieve automatic scaling, high availability, and cost efficiency.

### Key Features

- **Real-time Chat Interface**: WebSocket-based bidirectional communication with streaming responses
- **Intelligent Document Search**: Semantic search across PDF documents using vector embeddings
- **Secure Authentication**: Session-based authentication with JWT tokens and 24-hour expiration
- **Document Management**: Upload, process, and search PDF documents up to 100MB
- **Cost Optimized**: Intelligent caching reduces API calls and keeps costs under $200/month
- **Scalable**: Supports 100+ concurrent users with sub-2-second response times
- **Comprehensive Audit Logging**: All interactions logged for compliance and security
- **Infrastructure as Code**: Complete Terraform configurations for reproducible deployments

## Architecture

### High-Level Components

```
┌─────────────────┐
│  React Frontend │ (S3 + CloudFront)
└────────┬────────┘
         │ HTTPS/WSS
┌────────▼────────┐
│  API Gateway    │ (REST + WebSocket)
└────────┬────────┘
         │
┌────────▼────────┐
│ Lambda Functions│
├─────────────────┤
│ • Auth Handler  │
│ • Chat Handler  │
│ • Upload Handler│
│ • Doc Processor │
└────────┬────────┘
         │
    ┌────┴────┬──────────┬──────────┐
    │         │          │          │
┌───▼───┐ ┌──▼──────┐ ┌─▼────┐ ┌──▼──────┐
│   S3  │ │DynamoDB │ │Redis │ │OpenSearch│
│(Docs) │ │(History)│ │(Cache)│ │(Vectors) │
└───────┘ └─────────┘ └──────┘ └──────────┘
                                     │
                              ┌──────▼──────┐
                              │   Bedrock   │
                              │Claude/Titan │
                              └─────────────┘
```

### Technology Stack

- **Frontend**: React with TypeScript (planned)
- **Backend**: AWS Lambda (Node.js/TypeScript)
- **API Layer**: AWS API Gateway (REST + WebSocket)
- **AI/ML**: Amazon Bedrock (Claude 3 Sonnet, Titan Embeddings)
- **Vector Database**: Amazon OpenSearch with k-NN plugin
- **Storage**: Amazon S3 with KMS encryption
- **Database**: Amazon DynamoDB
- **Cache**: Amazon ElastiCache (Redis) (planned)
- **Infrastructure**: Terraform
- **Testing**: Jest with property-based testing (fast-check)

## Project Structure

```
.
├── terraform/              # Infrastructure as Code
│   ├── main.tf            # Root Terraform configuration
│   ├── variables.tf       # Input variables
│   ├── outputs.tf         # Output values
│   └── modules/           # Terraform modules
│       ├── auth/          # Authentication infrastructure
│       ├── database/      # DynamoDB tables
│       ├── networking/    # VPC, subnets, security groups
│       ├── opensearch/    # OpenSearch cluster
│       ├── rest-api/      # REST API Gateway
│       ├── security/      # IAM roles and policies
│       ├── storage/       # S3 buckets
│       ├── websocket/     # WebSocket API Gateway
│       └── ...
│
├── lambda/                # Lambda function source code
│   ├── auth/             # Authentication functions
│   │   ├── authorizer/   # JWT token validation
│   │   ├── login/        # Login endpoint
│   │   └── logout/       # Logout endpoint
│   └── websocket/        # WebSocket handlers
│       ├── connect/      # Connection handler
│       ├── disconnect/   # Disconnection handler
│       └── message/      # Message handler (planned)
│
└── .kiro/                # Project specifications
    └── specs/
        └── aws-claude-rag-chatbot/
            ├── requirements.md  # Functional requirements
            ├── design.md       # Architecture design
            └── tasks.md        # Implementation tasks
```

## Current Implementation Status

### ✅ Completed

- **Infrastructure Foundation** (Task 1)
  - VPC with private subnets and NAT Gateway
  - S3 buckets with encryption and versioning
  - DynamoDB tables (Sessions, ChatHistory, RateLimits, DocumentMetadata)
  - OpenSearch cluster with k-NN plugin
  - Security groups and IAM roles
  - CloudWatch log groups

- **Authentication Service** (Task 2)
  - Lambda Authorizer with JWT validation
  - Login endpoint with session management
  - Logout endpoint
  - Property-based tests for authentication flows

- **WebSocket Manager** (Task 3)
  - WebSocket API Gateway configuration
  - Connection/disconnection handlers
  - Connection persistence in DynamoDB
  - Property-based tests for connection management

### 🚧 In Progress

- Rate Limiter (Task 4)
- Audit Logger (Task 5)
- Cache Layer (Task 6)

### 📋 Planned

- Bedrock Service integration
- Document processing pipeline
- Vector search implementation
- Chat handler with RAG
- React frontend
- End-to-end integration

See [tasks.md](.kiro/specs/aws-claude-rag-chatbot/tasks.md) for the complete implementation plan.

## Getting Started

### Prerequisites

- AWS Account with appropriate permissions
- Terraform >= 1.0
- Node.js >= 18.x
- AWS CLI configured with credentials

### Deployment

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd aws-claude-rag-chatbot
   ```

2. **Configure Terraform variables**
   ```bash
   cd terraform
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your configuration
   ```

3. **Deploy infrastructure**
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

4. **Build and deploy Lambda functions**
   ```bash
   cd ../lambda/auth/authorizer
   npm install
   npm run build
   
   cd ../login
   npm install
   npm run build
   
   # Repeat for other Lambda functions
   ```

5. **Update Lambda function code**
   ```bash
   cd ../../terraform
   terraform apply  # Redeploy with updated function code
   ```

### Testing

Run tests for individual Lambda functions:

```bash
# Authentication tests
cd lambda/auth/login
npm test

# WebSocket tests
cd lambda/websocket/connect
npm test
```

## Configuration

### Environment Variables

Lambda functions use the following environment variables (configured via Terraform):

- `DYNAMODB_SESSIONS_TABLE`: DynamoDB table for user sessions
- `DYNAMODB_CONNECTIONS_TABLE`: DynamoDB table for WebSocket connections
- `DYNAMODB_CHAT_HISTORY_TABLE`: DynamoDB table for chat history
- `DYNAMODB_RATE_LIMITS_TABLE`: DynamoDB table for rate limiting
- `DYNAMODB_DOCUMENT_METADATA_TABLE`: DynamoDB table for document metadata
- `S3_DOCUMENTS_BUCKET`: S3 bucket for PDF documents
- `OPENSEARCH_ENDPOINT`: OpenSearch cluster endpoint
- `JWT_SECRET`: Secret key for JWT token signing (stored in Secrets Manager)

### Terraform Variables

Key Terraform variables (see `terraform/variables.tf`):

- `aws_region`: AWS region for deployment (default: us-east-1)
- `environment`: Environment name (dev/staging/prod)
- `project_name`: Project name prefix for resources
- `opensearch_instance_type`: OpenSearch instance type (default: t3.medium.search)
- `lambda_memory_size`: Memory allocation for Lambda functions

## Security

### Authentication & Authorization

- JWT-based session tokens with 24-hour expiration
- Lambda Authorizer validates all API requests
- IAM roles follow least privilege principle

### Encryption

- **At Rest**: All data encrypted using AWS KMS
  - S3 buckets with server-side encryption
  - DynamoDB tables with encryption enabled
  - OpenSearch with encryption at rest
- **In Transit**: TLS 1.2+ for all communications

### Network Security

- Lambda functions in private subnets
- Security groups restrict traffic to necessary ports
- VPC endpoints for AWS service communication
- NAT Gateway for controlled outbound access

### Audit & Compliance

- All user actions logged to CloudWatch
- 365-day log retention for compliance
- Structured JSON logging format
- Tamper-evident log storage

## Cost Optimization

### Caching Strategy

- Response caching: 1 hour for identical queries
- Search result caching: 15 minutes for identical embeddings
- Target cache hit rate: 30%+

### Resource Optimization

- Lambda memory tuning based on workload
- DynamoDB on-demand pricing for variable load
- S3 Intelligent-Tiering for older documents
- OpenSearch right-sized for workload

### Expected Costs (Moderate Usage)

- Lambda: ~$50/month
- OpenSearch: ~$70/month
- Bedrock API: ~$40/month
- DynamoDB: ~$20/month
- S3 + Data Transfer: ~$10/month
- **Total: ~$190/month**

## Performance

### Target Metrics

- Response time (no RAG): < 2 seconds
- Response time (with RAG): < 2 seconds
- Vector search latency: < 200ms
- Document processing: < 30 seconds (10MB PDF)
- Concurrent users: 100+
- WebSocket connections: 100+

### Monitoring

CloudWatch dashboards track:
- Request rate and error rate
- Response time percentiles (p50, p95, p99)
- Bedrock token usage and costs
- Cache hit rates
- Concurrent connections

## Testing Strategy

### Property-Based Testing

The project uses property-based testing with fast-check to validate universal correctness properties:

- **Property 1**: Invalid credentials always rejected
- **Property 2**: Session tokens expire after 24 hours
- **Property 5**: WebSocket connections persist correctly
- **Property 6**: WebSocket reconnection works reliably

### Unit Testing

- Jest for unit tests
- AWS SDK mocking with aws-sdk-client-mock
- High coverage for business logic

### Integration Testing (Planned)

- End-to-end flow testing
- Document upload → processing → search → chat
- Error scenario testing
- Load testing for concurrent users

## Contributing

This project follows a spec-driven development approach:

1. Requirements defined in `requirements.md`
2. Architecture designed in `design.md`
3. Implementation tasks tracked in `tasks.md`
4. Code implements tasks with tests

## Documentation

- [Requirements Document](.kiro/specs/aws-claude-rag-chatbot/requirements.md) - Functional requirements
- [Design Document](.kiro/specs/aws-claude-rag-chatbot/design.md) - Architecture and design decisions
- [Implementation Tasks](.kiro/specs/aws-claude-rag-chatbot/tasks.md) - Development roadmap
- [Terraform Deployment](terraform/DEPLOYMENT.md) - Infrastructure deployment guide
- [Lambda Build Guide](lambda/auth/BUILD.md) - Lambda function build instructions

## License

[Add your license here]

## Support

For questions or issues, please [open an issue](link-to-issues) or contact the development team.
