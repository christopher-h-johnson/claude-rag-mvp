# Quick Start: Remote Backend Setup

## TL;DR

```powershell
cd terraform/backend-setup
.\setup-backend.ps1
cd ..
terraform init -migrate-state
```

## What This Does

1. Creates an S3 bucket for storing Terraform state
2. Creates a DynamoDB table for state locking
3. Updates your main.tf with backend configuration
4. Migrates your existing local state to S3

## Manual Steps (if you prefer)

### 1. Create Backend Resources

```powershell
cd terraform/backend-setup
terraform init
terraform apply
```

### 2. Copy the Backend Configuration

After apply, copy the output that looks like:

```hcl
terraform {
  backend "s3" {
    bucket         = "terraform-state-chatbot-177981160483"
    key            = "chatbot/terraform.tfstate"
    region         = "us-east-2"
    encrypt        = true
    dynamodb_table = "terraform-locks-dev"
  }
}
```

### 3. Add to Main Terraform Configuration

Edit `terraform/main.tf` and add the backend block inside the `terraform {}` block:

```hcl
terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Add this backend configuration
  backend "s3" {
    bucket         = "terraform-state-chatbot-177981160483"
    key            = "chatbot/terraform.tfstate"
    region         = "us-east-2"
    encrypt        = true
    dynamodb_table = "terraform-locks-dev"
  }
}
```

### 4. Migrate State

```powershell
cd ..  # Back to terraform directory
terraform init -migrate-state
```

When prompted "Do you want to copy existing state to the new backend?", answer `yes`.

### 5. Verify

```powershell
# Check state is now remote
terraform state list

# Verify in S3
aws s3 ls s3://terraform-state-chatbot-177981160483/chatbot/
```

## Benefits

✅ **No more lost state files** - State is stored in S3 with versioning
✅ **Team collaboration** - Multiple people can work on the same infrastructure
✅ **State locking** - Prevents concurrent modifications
✅ **Automatic backups** - S3 versioning keeps history
✅ **Encryption** - State is encrypted at rest

## Troubleshooting

### "Backend configuration changed"

If you see this error, run:
```powershell
terraform init -reconfigure
```

### "Error acquiring the state lock"

Someone else is running Terraform. Wait for them to finish, or if stuck:
```powershell
terraform force-unlock <lock-id>
```

### "Access Denied" to S3 bucket

Check your AWS credentials:
```powershell
aws sts get-caller-identity
```

## Next Steps

After setting up the remote backend:

1. Your state is now safely stored in S3
2. Continue with your Terraform workflow as normal
3. State will automatically sync to S3 after each apply
4. Other team members can access the same state

## Cleanup (Only if needed)

To remove the backend (⚠️ dangerous!):

```powershell
# First, migrate state back to local
cd terraform
terraform init -migrate-state  # Choose "local" backend

# Then destroy backend resources
cd backend-setup
terraform destroy
```
