# OpenSearch Domain
resource "aws_opensearch_domain" "main" {
  domain_name    = "${var.environment}-chatbot-opensearch"
  engine_version = "OpenSearch_3.3"

  cluster_config {
    instance_type            = var.instance_type
    instance_count           = var.instance_count
    dedicated_master_enabled = false
    zone_awareness_enabled   = var.instance_count > 1

    dynamic "zone_awareness_config" {
      for_each = var.instance_count > 1 ? [1] : []
      content {
        availability_zone_count = min(var.instance_count, 3)
      }
    }
  }

  ebs_options {
    ebs_enabled = true
    volume_type = "gp3"
    volume_size = 100
    iops        = 3000
    throughput  = 125
  }

  encrypt_at_rest {
    enabled = true
  }

  node_to_node_encryption {
    enabled = true
  }

  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-2019-07"
  }

  vpc_options {
    subnet_ids         = var.instance_count > 1 ? slice(var.subnet_ids, 0, min(var.instance_count, 3)) : [var.subnet_ids[0]]
    security_group_ids = var.security_group_ids
  }

  advanced_options = {
    "rest.action.multi.allow_explicit_index" = "true"
    "override_main_response_version"         = "false"
  }

  advanced_security_options {
    enabled                        = true
    internal_user_database_enabled = true
    master_user_options {
      master_user_name     = var.master_user_name
      master_user_password = var.master_user_password
    }
  }

  access_policies = jsonencode({
    Version = "2012-10-17"
    Statement = concat([
      {
        Effect = "Allow"
        Principal = {
          AWS = "*"
        }
        Action   = "es:*"
        Resource = "arn:aws:es:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:domain/${var.environment}-chatbot-opensearch/*"
      }
      ],
      length(var.lambda_role_arns) > 0 ? [
        {
          Effect = "Allow"
          Principal = {
            AWS = var.lambda_role_arns
          }
          Action = [
            "es:ESHttpGet",
            "es:ESHttpPut",
            "es:ESHttpPost",
            "es:ESHttpHead",
            "es:ESHttpDelete"
          ]
          Resource = "arn:aws:es:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:domain/${var.environment}-chatbot-opensearch/*"
        }
    ] : [])
  })

  tags = {
    Name        = "${var.environment}-chatbot-opensearch"
    Environment = var.environment
  }
}

# Data sources
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}
