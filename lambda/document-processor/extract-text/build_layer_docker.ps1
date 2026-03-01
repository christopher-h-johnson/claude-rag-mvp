# Build Lambda layer using Docker (for Lambda compatibility)
# This ensures the layer works on AWS Lambda (Amazon Linux 2)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LayerDir = Join-Path $ScriptDir "layer"
$ZipPath = Join-Path $ScriptDir "document-processor-layer.zip"

Write-Host "Building Lambda layer using Docker..." -ForegroundColor Green

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "ERROR: Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Clean previous build
if (Test-Path $LayerDir) {
    Write-Host "Cleaning previous build..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $LayerDir
}

if (Test-Path $ZipPath) {
    Remove-Item $ZipPath
}

# Create layer directory
New-Item -ItemType Directory -Path (Join-Path $LayerDir "python") -Force | Out-Null

Write-Host "Installing dependencies using AWS Lambda Python 3.11 image..." -ForegroundColor Yellow
Write-Host "This may take a few minutes (installing Rust compiler for tiktoken)..." -ForegroundColor Yellow

Write-Host "Script directory: $ScriptDir" -ForegroundColor Cyan

# Verify requirements.txt exists
$RequirementsPath = Join-Path $ScriptDir "requirements.txt"
if (-not (Test-Path $RequirementsPath)) {
    Write-Host "ERROR: requirements.txt not found at $RequirementsPath" -ForegroundColor Red
    exit 1
}

Write-Host "Requirements file found: $RequirementsPath" -ForegroundColor Green

# Build layer using Docker with AWS Lambda Python image
# Docker Desktop on Windows handles path conversion automatically
# --rm: Remove container after execution
# --entrypoint "": Override the Lambda entrypoint to run shell commands
# -v: Mount current directory to /var/task in container
# -w: Set working directory inside container
# tiktoken requires Rust compiler - install gcc first, then Rust, then build packages
docker run --rm --entrypoint "" -v "${ScriptDir}:/var/task" -w /var/task public.ecr.aws/lambda/python:3.11 sh -c "yum install -y gcc && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && source `$HOME/.cargo/env && pip install -r requirements.txt -t layer/python --upgrade"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker build failed" -ForegroundColor Red
    exit 1
}

# Create zip file
Write-Host "Creating layer package..." -ForegroundColor Yellow
Compress-Archive -Path (Join-Path $LayerDir "*") -DestinationPath $ZipPath -Force

# Display results
Write-Host "`nLayer built successfully!" -ForegroundColor Green
Write-Host "Layer directory: $LayerDir" -ForegroundColor Cyan
Write-Host "Zip file: $ZipPath" -ForegroundColor Cyan
$Size = (Get-Item $ZipPath).Length / 1MB
Write-Host "Size: $([math]::Round($Size, 2)) MB" -ForegroundColor Cyan

Write-Host "`nBuild complete!" -ForegroundColor Green
Write-Host "`nThe layer directory is kept for Terraform to use." -ForegroundColor Yellow
Write-Host "Run 'terraform apply' to deploy." -ForegroundColor White
