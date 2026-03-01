# Setup Test Environment for Integration Tests (PowerShell)
# This script extracts configuration from Terraform outputs and sets environment variables

$ErrorActionPreference = "Stop"

Write-Host "=== Setting up Integration Test Environment ===" -ForegroundColor Cyan
Write-Host ""

# Check if terraform directory exists
if (-not (Test-Path "../../../../terraform")) {
    Write-Host "Error: Terraform directory not found" -ForegroundColor Red
    Write-Host "Please run this script from lambda/document-processor/tests/integration/"
    exit 1
}

# Get Terraform outputs
Write-Host "Extracting configuration from Terraform..."
Push-Location "../../../../terraform"

# Check if terraform state exists
if (-not (Test-Path "terraform.tfstate")) {
    Write-Host "Error: Terraform state not found. Please deploy infrastructure first." -ForegroundColor Red
    Pop-Location
    exit 1
}

# Extract values from terraform output
try {
    $tfOutput = terraform output -json | ConvertFrom-Json
    $BUCKET_NAME = $tfOutput.s3_documents_bucket_name.value
    $OPENSEARCH_ENDPOINT = $tfOutput.opensearch_endpoint.value
    $METADATA_TABLE = $tfOutput.dynamodb_document_metadata_table_name.value
} catch {
    Write-Host "Error: Could not extract values from Terraform output" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

# Validate required values
if ([string]::IsNullOrEmpty($BUCKET_NAME)) {
    Write-Host "Error: Could not extract S3 bucket name from Terraform" -ForegroundColor Red
    exit 1
}

# Create .env file
$ENV_FILE = ".env"
Write-Host "Creating $ENV_FILE..."

$envContent = @"
# AWS Configuration
AWS_REGION=us-east-2
AWS_PROFILE=default

# S3 Configuration
TEST_BUCKET_NAME=$BUCKET_NAME

# Lambda Functions
EXTRACT_TEXT_LAMBDA=dev-chatbot-extract-text
EMBEDDING_GENERATOR_LAMBDA=dev-chatbot-generate-embeddings

# DynamoDB Tables
DOCUMENT_METADATA_TABLE=$METADATA_TABLE

# OpenSearch Configuration
OPENSEARCH_ENDPOINT=$OPENSEARCH_ENDPOINT
OPENSEARCH_INDEX=documents

# Test Configuration
TEST_TIMEOUT=90
"@

Set-Content -Path $ENV_FILE -Value $envContent

Write-Host "✓ Environment file created: $ENV_FILE" -ForegroundColor Green
Write-Host ""
Write-Host "Configuration:"
Write-Host "  S3 Bucket: $BUCKET_NAME"
Write-Host "  Metadata Table: $METADATA_TABLE"
Write-Host "  OpenSearch: $OPENSEARCH_ENDPOINT"
Write-Host ""

# Check AWS credentials
Write-Host "Checking AWS credentials..."
try {
    $identity = aws sts get-caller-identity --output json | ConvertFrom-Json
    Write-Host "✓ AWS credentials valid" -ForegroundColor Green
    Write-Host "  Account: $($identity.Account)"
    Write-Host "  Identity: $($identity.Arn)"
} catch {
    Write-Host "✗ AWS credentials not configured or invalid" -ForegroundColor Red
    Write-Host "  Please configure AWS credentials using 'aws configure' or set AWS_PROFILE"
    exit 1
}

Write-Host ""

# Check S3 bucket access
Write-Host "Checking S3 bucket access..."
try {
    aws s3 ls "s3://$BUCKET_NAME" --max-items 1 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ S3 bucket access verified" -ForegroundColor Green
    } else {
        throw "Access denied"
    }
} catch {
    Write-Host "✗ Cannot access S3 bucket: $BUCKET_NAME" -ForegroundColor Red
    Write-Host ""
    Write-Host "Your IAM user/role needs the following permissions:"
    Write-Host "  - s3:ListBucket on arn:aws:s3:::$BUCKET_NAME"
    Write-Host "  - s3:GetObject on arn:aws:s3:::$BUCKET_NAME/*"
    Write-Host "  - s3:PutObject on arn:aws:s3:::$BUCKET_NAME/*"
    Write-Host "  - s3:DeleteObject on arn:aws:s3:::$BUCKET_NAME/*"
    Write-Host ""
    Write-Host "You can add these permissions using the AWS IAM console or CLI."
    exit 1
}

Write-Host ""

# Check DynamoDB table access
Write-Host "Checking DynamoDB table access..."
try {
    aws dynamodb describe-table --table-name $METADATA_TABLE 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ DynamoDB table access verified" -ForegroundColor Green
    } else {
        throw "Access denied"
    }
} catch {
    Write-Host "✗ Cannot access DynamoDB table: $METADATA_TABLE" -ForegroundColor Red
    Write-Host ""
    Write-Host "Your IAM user/role needs the following permissions:"
    Write-Host "  - dynamodb:DescribeTable on arn:aws:dynamodb:*:*:table/$METADATA_TABLE"
    Write-Host "  - dynamodb:GetItem on arn:aws:dynamodb:*:*:table/$METADATA_TABLE"
    Write-Host "  - dynamodb:PutItem on arn:aws:dynamodb:*:*:table/$METADATA_TABLE"
    Write-Host "  - dynamodb:DeleteItem on arn:aws:dynamodb:*:*:table/$METADATA_TABLE"
    exit 1
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "To run tests, use one of the following:"
Write-Host "  1. Load environment variables: Get-Content .env | ForEach-Object { `$name, `$value = `$_.Split('=', 2); [Environment]::SetEnvironmentVariable(`$name, `$value) }"
Write-Host "  2. Use the run script: .\run_tests.ps1"
Write-Host "  3. Load .env in your IDE and run tests"
Write-Host ""

# Set environment variables for current session
Write-Host "Setting environment variables for current PowerShell session..."
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
        Write-Host "  Set $name" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "✓ Environment variables set for current session" -ForegroundColor Green
Write-Host "You can now run: python -m unittest test_pipeline.py"
Write-Host ""
