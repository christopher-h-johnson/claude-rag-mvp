# Integration Test Runner for Document Processing Pipeline (PowerShell)
# 
# This script sets up the environment and runs integration tests
# for the document processing pipeline.

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Document Processing Pipeline Integration Tests" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if required environment variables are set
$requiredVars = @(
    "TEST_BUCKET_NAME",
    "EXTRACT_TEXT_LAMBDA",
    "EMBEDDING_GENERATOR_LAMBDA",
    "DOCUMENT_METADATA_TABLE"
)

$missingVars = @()

foreach ($var in $requiredVars) {
    if (-not (Test-Path "env:$var")) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "Error: Missing required environment variables:" -ForegroundColor Red
    foreach ($var in $missingVars) {
        Write-Host "  - $var" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Please set these variables before running tests:"
    Write-Host ""
    Write-Host '  $env:TEST_BUCKET_NAME = "dev-chatbot-documents"'
    Write-Host '  $env:EXTRACT_TEXT_LAMBDA = "dev-chatbot-extract-text"'
    Write-Host '  $env:EMBEDDING_GENERATOR_LAMBDA = "dev-chatbot-generate-embeddings"'
    Write-Host '  $env:DOCUMENT_METADATA_TABLE = "dev-chatbot-document-metadata"'
    Write-Host ""
    exit 1
}

# Display configuration
Write-Host "Configuration:" -ForegroundColor Green
Write-Host "  Bucket: $env:TEST_BUCKET_NAME"
Write-Host "  Extract Lambda: $env:EXTRACT_TEXT_LAMBDA"
Write-Host "  Embedding Lambda: $env:EMBEDDING_GENERATOR_LAMBDA"
Write-Host "  Metadata Table: $env:DOCUMENT_METADATA_TABLE"
Write-Host "  AWS Region: $(if ($env:AWS_REGION) { $env:AWS_REGION } else { 'us-east-1' })"
Write-Host ""

# Check if dependencies are installed
Write-Host "Checking dependencies..." -ForegroundColor Yellow
try {
    python -c "import boto3" 2>$null
    Write-Host "Dependencies already installed"
} catch {
    Write-Host "Installing dependencies..."
    pip install -r requirements.txt
}
Write-Host ""

# Run tests
Write-Host "Running integration tests..." -ForegroundColor Green
Write-Host ""

$verboseFlag = ""
if ($args -contains "-v" -or $args -contains "--verbose") {
    $verboseFlag = "-v"
}

python -m unittest test_pipeline.py $verboseFlag

$testExitCode = $LASTEXITCODE

Write-Host ""
if ($testExitCode -eq 0) {
    Write-Host "✓ All tests passed!" -ForegroundColor Green
} else {
    Write-Host "✗ Some tests failed" -ForegroundColor Red
}

exit $testExitCode
