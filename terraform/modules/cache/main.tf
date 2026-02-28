# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.environment}-chatbot-redis-subnet-group"
  subnet_ids = var.subnet_ids

  tags = {
    Name        = "${var.environment}-chatbot-redis-subnet-group"
    Environment = var.environment
  }
}

# Security Group for ElastiCache Redis
resource "aws_security_group" "redis" {
  name_prefix = "${var.environment}-redis-"
  description = "Security group for ElastiCache Redis cluster"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from Lambda"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.lambda_security_group_id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-chatbot-redis-sg"
    Environment = var.environment
  }
}

# ElastiCache Parameter Group for Redis with LRU eviction
resource "aws_elasticache_parameter_group" "redis" {
  name   = "${var.environment}-chatbot-redis-params"
  family = "redis7"

  # Configure LRU eviction policy
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  tags = {
    Name        = "${var.environment}-chatbot-redis-params"
    Environment = var.environment
  }
}

# ElastiCache Replication Group (Redis Cluster Mode)
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.environment}-chatbot-redis"
  description          = "Redis cluster for chatbot caching"

  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_nodes
  parameter_group_name = aws_elasticache_parameter_group.redis.name
  port                 = 6379

  # High availability configuration
  automatic_failover_enabled = var.num_cache_nodes > 1
  multi_az_enabled           = var.num_cache_nodes > 1

  # Network configuration
  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  # Encryption configuration (at-rest disabled for cost optimization)
  at_rest_encryption_enabled = var.enable_encryption_at_rest
  transit_encryption_enabled = var.enable_encryption_in_transit

  # Backup configuration (disabled for cost optimization in dev)
  snapshot_retention_limit = var.snapshot_retention_limit
  snapshot_window          = var.snapshot_retention_limit > 0 ? "03:00-05:00" : null
  maintenance_window       = "sun:05:00-sun:07:00"

  # Auto minor version upgrade
  auto_minor_version_upgrade = true

  # Notification configuration
  notification_topic_arn = var.notification_topic_arn != "" ? var.notification_topic_arn : null

  tags = {
    Name        = "${var.environment}-chatbot-redis"
    Environment = var.environment
  }
}
