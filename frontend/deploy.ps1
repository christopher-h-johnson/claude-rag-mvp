# Deployment script for AWS S3 + CloudFront (PowerShell)
# Usage: .\deploy.ps1 -BucketName <s3-bucket-name> [-DistributionId <cloudfront-distribution-id>]

param(
    [Parameter(Mandatory=$true)]
    [string]$BucketName,
    
    [Parameter(Mandatory=$false)]
    [string]$DistributionId
)

$ErrorActionPreference = "Stop"

Write-Host "🏗️  Building React application..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Syncing build to S3 bucket: $BucketName" -ForegroundColor Cyan
aws s3 sync dist/ s3://$BucketName --delete `
    --cache-control "public, max-age=31536000, immutable" `
    --exclude "index.html"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ S3 sync failed!" -ForegroundColor Red
    exit 1
}

# Upload index.html separately with no-cache to ensure updates are immediate
Write-Host "📄 Uploading index.html with no-cache..." -ForegroundColor Cyan
aws s3 cp dist/index.html s3://$BucketName/index.html `
    --cache-control "no-cache, no-store, must-revalidate" `
    --metadata-directive REPLACE

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ index.html upload failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ S3 sync complete!" -ForegroundColor Green

# Invalidate CloudFront cache if distribution ID is provided
if ($DistributionId) {
    Write-Host "🔄 Invalidating CloudFront cache for distribution: $DistributionId" -ForegroundColor Cyan
    aws cloudfront create-invalidation `
        --distribution-id $DistributionId `
        --paths "/*"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  CloudFront invalidation failed!" -ForegroundColor Yellow
    } else {
        Write-Host "✅ CloudFront invalidation created!" -ForegroundColor Green
    }
}

Write-Host "🚀 Deployment complete!" -ForegroundColor Green

$region = aws configure get region
Write-Host "📍 Your app is now live at: https://$BucketName.s3-website-$region.amazonaws.com" -ForegroundColor Cyan

if ($DistributionId) {
    $cloudfrontDomain = aws cloudfront get-distribution --id $DistributionId --query 'Distribution.DomainName' --output text
    Write-Host "📍 CloudFront URL: https://$cloudfrontDomain" -ForegroundColor Cyan
}
