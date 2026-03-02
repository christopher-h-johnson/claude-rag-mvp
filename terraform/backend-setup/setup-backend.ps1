# Automated Backend Setup Script
# This script creates the S3 backend and migrates existing state

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Terraform Remote Backend Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create backend infrastructure
Write-Host "Step 1: Creating S3 bucket and DynamoDB table..." -ForegroundColor Yellow
Write-Host ""

terraform init
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to initialize Terraform" -ForegroundColor Red
    exit 1
}

terraform plan -out=backend.tfplan
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to plan backend resources" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Review the plan above. Press Enter to apply or Ctrl+C to cancel..." -ForegroundColor Yellow
Read-Host

terraform apply backend.tfplan
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create backend resources" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✓ Backend infrastructure created successfully!" -ForegroundColor Green
Write-Host ""

# Step 2: Get backend configuration
Write-Host "Step 2: Getting backend configuration..." -ForegroundColor Yellow
$backendConfig = terraform output -raw backend_configuration_block

Write-Host ""
Write-Host "Backend Configuration:" -ForegroundColor Cyan
Write-Host $backendConfig -ForegroundColor White
Write-Host ""

# Step 3: Update main.tf
Write-Host "Step 3: Updating main Terraform configuration..." -ForegroundColor Yellow

$mainTfPath = "../main.tf"
if (Test-Path $mainTfPath) {
    # Read current main.tf
    $mainTfContent = Get-Content $mainTfPath -Raw
    
    # Check if backend block already exists
    if ($mainTfContent -match 'backend\s+"s3"') {
        Write-Host "⚠ Backend block already exists in main.tf" -ForegroundColor Yellow
        Write-Host "Please manually update the backend configuration" -ForegroundColor Yellow
    } else {
        # Find the terraform block and add backend
        $bucketName = terraform output -raw s3_bucket_name
        $tableName = terraform output -raw dynamodb_table_name
        $region = terraform output -json backend_config | ConvertFrom-Json | Select-Object -ExpandProperty region
        
        $backendBlock = @"

  backend "s3" {
    bucket         = "$bucketName"
    key            = "chatbot/terraform.tfstate"
    region         = "$region"
    encrypt        = true
    dynamodb_table = "$tableName"
  }
"@
        
        # Insert backend block after required_providers
        $mainTfContent = $mainTfContent -replace '(\s+}\s+)\s+(provider\s+"aws")', "`$1$backendBlock`n`n`$2"
        
        # Backup original
        Copy-Item $mainTfPath "$mainTfPath.backup"
        Write-Host "  Created backup: main.tf.backup" -ForegroundColor Gray
        
        # Write updated content
        Set-Content $mainTfPath $mainTfContent
        Write-Host "  ✓ Updated main.tf with backend configuration" -ForegroundColor Green
    }
} else {
    Write-Host "⚠ main.tf not found at $mainTfPath" -ForegroundColor Yellow
    Write-Host "Please manually add the backend configuration shown above" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 4: Migrate state to remote backend..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. cd .." -ForegroundColor White
Write-Host "  2. terraform init -migrate-state" -ForegroundColor White
Write-Host "  3. Answer 'yes' when prompted to copy state" -ForegroundColor White
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Backend Setup Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your Terraform state will now be stored in:" -ForegroundColor Cyan
Write-Host "  S3 Bucket: $(terraform output -raw s3_bucket_name)" -ForegroundColor White
Write-Host "  DynamoDB Table: $(terraform output -raw dynamodb_table_name)" -ForegroundColor White
Write-Host ""
