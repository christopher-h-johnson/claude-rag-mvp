# Cache Module

This module provisions an Amazon ElastiCache Redis cluster for caching Bedrock responses and OpenSearch search results.

## Features

- **Redis Cluster**: Single-node or Multi-AZ deployment options
- **LRU Eviction Policy**: Configured with `allkeys-lru` to evict least recently used keys when memory limit is reached
- **Flexible Encryption**: Optional at-rest and in-transit encryption
- **Configurable Backups**: Optional automatic snapshots with configurable retention
- **Security**: Security group restricting access to Lambda functions only
- **Cost Optimization**: Configurable for minimum cost or production-grade reliability

## Cost-Optimized Configuration (Default)

The default configuration is optimized for minimum cost (~$12.50/month):

- **Node Type**: `cache.t3.micro` (~0.5GB memory)
- **Nodes**: 1 (single-node, no HA)
- **Backups**: Disabled (0-day retention)
- **Encryption at Rest**: Disabled
- **Encryption in Transit**: Disabled

**Monthly Cost:** ~$12.50/month

See [COST_OPTIMIZATION.md](./COST_OPTIMIZATION.md) for detailed cost analysis and upgrade paths.

## Production Configuration

For production deployments requiring high availability and compliance:

```hcl
module "cache" {
  source = "./modules/cache"

  environment                    = var.environment
  vpc_id                         = module.networking.vpc_id
  subnet_ids                     = module.networking.private_subnet_ids
  lambda_security_group_id       = module.security.lambda_security_group_id
  
  # Production settings
  node_type                      = "cache.t3.small"  # 1.37GB memory
  num_cache_nodes                = 2                 # Multi-AZ HA
  snapshot_retention_limit       = 5                 # 5-day backups
  enable_encryption_at_rest      = true              # KMS encryption
  enable_encryption_in_transit   = true              # TLS encryption
}
```

**Monthly Cost:** ~$60/month

## Configuration

### Memory Management

The Redis cluster is configured with:
- **Max Memory**: Determined by node type
  - `cache.t3.micro`: ~0.5GB usable memory
  - `cache.t3.small`: ~1.37GB usable memory
  - `cache.t4g.small`: ~1.37GB usable memory (ARM-based, cheaper)
- **Eviction Policy**: `allkeys-lru` - evicts least recently used keys across all keys when max memory is reached
- **Use Case**: Optimized for caching with automatic eviction of old entries

### Cache TTL Strategy

As per design requirements (set at application level):
- **Bedrock Responses**: 1 hour (3600s TTL)
- **OpenSearch Results**: 15 minutes (900s TTL)
- **Cache Keys**: SHA-256 hashed queries

### Node Types

| Node Type | Memory | vCPUs | Cost/Month | Use Case |
|-----------|--------|-------|------------|----------|
| cache.t3.micro | 0.5GB | 2 | ~$12.50 | Dev/Test (cost-optimized) |
| cache.t3.small | 1.37GB | 2 | ~$25 | Production (meets 1GB requirement) |
| cache.t4g.small | 1.37GB | 2 | ~$22.50 | Production (ARM-based, cheaper) |

## Usage

### Minimum Cost (Development)

```hcl
module "cache" {
  source = "./modules/cache"

  environment               = var.environment
  vpc_id                   = module.networking.vpc_id
  subnet_ids               = module.networking.private_subnet_ids
  lambda_security_group_id = module.security.lambda_security_group_id
  
  # Cost-optimized defaults
  node_type                      = "cache.t3.micro"
  num_cache_nodes                = 1
  snapshot_retention_limit       = 0
  enable_encryption_at_rest      = false
  enable_encryption_in_transit   = false
}
```

### Production with High Availability

```hcl
module "cache" {
  source = "./modules/cache"

  environment               = var.environment
  vpc_id                   = module.networking.vpc_id
  subnet_ids               = module.networking.private_subnet_ids
  lambda_security_group_id = module.security.lambda_security_group_id
  
  # Production settings
  node_type                      = "cache.t3.small"
  num_cache_nodes                = 2
  snapshot_retention_limit       = 5
  enable_encryption_at_rest      = true
  enable_encryption_in_transit   = true
}
```

## Outputs

- `redis_endpoint`: Primary endpoint for write operations
- `redis_reader_endpoint`: Reader endpoint for read operations (Multi-AZ only)
- `redis_port`: Redis port (6379)
- `redis_security_group_id`: Security group ID for Redis cluster

## Requirements

- VPC with private subnets
- Lambda security group for access control
- Redis 7.x compatible client libraries in Lambda functions

## Security

### Cost-Optimized Configuration
- ✅ Network isolation in private subnets
- ✅ Security group restricts access to Lambda functions only
- ⚠️ No encryption at rest (data stored unencrypted)
- ⚠️ No encryption in transit (data transmitted unencrypted within VPC)
- ⚠️ Not suitable for compliance-regulated workloads

### Production Configuration
- ✅ Network isolation in private subnets
- ✅ Security group restricts access to Lambda functions only
- ✅ Encryption at rest using AWS-managed KMS keys
- ✅ Encryption in transit using TLS
- ✅ Suitable for compliance-regulated workloads

## Monitoring

The cluster emits CloudWatch metrics including:
- `CPUUtilization`
- `DatabaseMemoryUsagePercentage`
- `CurrConnections`
- `Evictions` (important for LRU monitoring)
- `CacheHits` and `CacheMisses`

**Key Metrics to Watch:**
- **Evictions**: Should be <10% of gets (high evictions = need larger node)
- **CPU Utilization**: Should be <75% (high CPU = need larger node)
- **Cache Hit Rate**: Should be >30% (low hit rate = cache not effective)

## Cost Optimization

See [COST_OPTIMIZATION.md](./COST_OPTIMIZATION.md) for:
- Detailed cost breakdown
- Configuration comparison
- When to use each configuration
- Alternative optimization strategies
- Monitoring recommendations
- Upgrade paths

## Troubleshooting

### High Eviction Rate
- Increase node type to get more memory
- Reduce TTLs at application level
- Review cache key strategy

### Low Cache Hit Rate (<20%)
- Review query patterns
- Consider disabling cache entirely
- Adjust TTLs

### High CPU Utilization
- Upgrade to larger node type
- Reduce request rate
- Optimize Redis commands in application

### Connection Issues
- Verify Lambda security group has access
- Check VPC subnet configuration
- Verify Redis endpoint in Lambda environment variables
- If encryption in transit enabled, ensure TLS connection in client

