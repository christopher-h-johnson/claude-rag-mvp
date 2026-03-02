# Terraform Backend Setup

This directory contains the Terraform configuration to create the S3 bucket and DynamoDB table for remote state storage.

## Purpose

Creates:
- **S3 Bucket**: Stores Terraform state files with versioning and encryption
- **DynamoDB Table**: Provides state locking to prevent concurrent modifications

## Prerequisites

- AWS CLI configured with appropriate credentials
- Terraform installed
- Permissions to create S3 buckets and DynamoDB tables

## Usage

### Step 1: Create the Backend Infrastructure

```powershell
cd backend-setup
terraform init
terraform plan
terraform apply
```

This will create:
- S3 bucket: `terraform-state-chatbot-<account-id>`
- DynamoDB table: `terraform-locks-dev`

### Step 2: Note the Output

After apply, Terraform will output the backend configuration. Copy this for the next step.

Example output:
```
backend_configuration_block = <<EOT
terraform {
  backend "s3" {
    bucket         = "terraform-state-chatbot-177981160483"
    key            = "chatbot/terraform.tfstate"
    region         = "us-east-2"
    encrypt        = true
    dynamodb_table = "terraform-locks-dev"
  }
}
EOT
```

### Step 3: Configure Backend in Main Project

Add the backend configuration to your main `terraform/main.tf`:

```hcl
terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Add this backend block
  backend "s3" {
    bucket         = "terraform-state-chatbot-177981160483"
    key            = "chatbot/terraform.tfstate"
    region         = "us-east-2"
    encrypt        = true
    dynamodb_table = "terraform-locks-dev"
  }
}
```

### Step 4: Migrate Existing State

If you already have a local state file:

```powershell
cd ..  # Back to main terraform directory
terraform init -migrate-state
```

Terraform will ask if you want to copy the existing state to the new backend. Answer `yes`.

### Step 5: Verify

```powershell
# Check that state is now remote
terraform state list

# The state file should now be in S3
aws s3 ls s3://terraform-state-chatbot-<account-id>/chatbot/
```

## Features

### S3 Bucket
- **Versioning**: Enabled - keeps history of state changes
- **Encryption**: AES256 server-side encryption
- **Public Access**: Blocked - no public access allowed
- **Lifecycle**: Old versions deleted after 90 days

### DynamoDB Table
- **Billing**: Pay-per-request (cost-effective for low usage)
- **Purpose**: State locking prevents concurrent modifications
- **Key**: LockID (required by Terraform)

## Security

- S3 bucket has public access blocked
- Server-side encryption enabled
- Versioning enabled for state recovery
- State locking prevents race conditions

## Cost Estimate

- **S3**: ~$0.023 per GB per month (state files are typically < 1MB)
- **DynamoDB**: Pay-per-request, ~$0.25 per million requests
- **Total**: < $1 per month for typical usage

## Backup and Recovery

### Backup State File

```powershell
# Download current state
aws s3 cp s3://terraform-state-chatbot-<account-id>/chatbot/terraform.tfstate ./backup-terraform.tfstate

# List all versions
aws s3api list-object-versions --bucket terraform-state-chatbot-<account-id> --prefix chatbot/terraform.tfstate
```

### Restore Previous Version

```powershell
# Get version ID from list-object-versions
aws s3api get-object --bucket terraform-state-chatbot-<account-id> --key chatbot/terraform.tfstate --version-id <version-id> ./restored-state.tfstate

# Copy back to S3
aws s3 cp ./restored-state.tfstate s3://terraform-state-chatbot-<account-id>/chatbot/terraform.tfstate
```

## Troubleshooting

### State Lock Error

If you get a state lock error:

```powershell
# Force unlock (use with caution!)
terraform force-unlock <lock-id>
```

### Cannot Access S3 Bucket

Check your AWS credentials and permissions:

```powershell
aws sts get-caller-identity
aws s3 ls s3://terraform-state-chatbot-<account-id>/
```

### DynamoDB Table Not Found

Verify the table exists:

```powershell
aws dynamodb describe-table --table-name terraform-locks-dev --region us-east-2
```

## Cleanup

To remove the backend infrastructure (only do this if you're sure!):

```powershell
cd backend-setup

# First, remove backend configuration from main project
# Then destroy backend resources
terraform destroy
```

**Warning**: This will delete your state bucket and lock table. Make sure you have backups!

## Best Practices

1. **Never commit state files to git** - They contain sensitive information
2. **Use state locking** - Prevents concurrent modifications
3. **Enable versioning** - Allows recovery from mistakes
4. **Regular backups** - Download state files periodically
5. **Separate backends per environment** - Use different buckets for dev/staging/prod
6. **Restrict access** - Use IAM policies to control who can access state

## Multi-Environment Setup

For multiple environments, create separate state paths:

```hcl
# Development
backend "s3" {
  bucket = "terraform-state-chatbot-177981160483"
  key    = "chatbot/dev/terraform.tfstate"
  ...
}

# Production
backend "s3" {
  bucket = "terraform-state-chatbot-177981160483"
  key    = "chatbot/prod/terraform.tfstate"
  ...
}
```

Or use separate buckets:

```hcl
# Development
backend "s3" {
  bucket = "terraform-state-chatbot-dev-177981160483"
  ...
}

# Production
backend "s3" {
  bucket = "terraform-state-chatbot-prod-177981160483"
  ...
}
```
