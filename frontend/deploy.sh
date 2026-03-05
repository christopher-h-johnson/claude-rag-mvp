#!/bin/bash

# Deployment script for AWS S3 + CloudFront
# Usage: ./deploy.sh <s3-bucket-name> [cloudfront-distribution-id]

set -e

# Check if bucket name is provided
if [ -z "$1" ]; then
  echo "Error: S3 bucket name is required"
  echo "Usage: ./deploy.sh <s3-bucket-name> [cloudfront-distribution-id]"
  exit 1
fi

S3_BUCKET=$1
CLOUDFRONT_DIST_ID=$2

echo "🏗️  Building React application..."
npm run build

echo "📦 Syncing build to S3 bucket: $S3_BUCKET"
aws s3 sync dist/ s3://$S3_BUCKET --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

# Upload index.html separately with no-cache to ensure updates are immediate
echo "📄 Uploading index.html with no-cache..."
aws s3 cp dist/index.html s3://$S3_BUCKET/index.html \
  --cache-control "no-cache, no-store, must-revalidate" \
  --metadata-directive REPLACE

echo "✅ S3 sync complete!"

# Invalidate CloudFront cache if distribution ID is provided
if [ -n "$CLOUDFRONT_DIST_ID" ]; then
  echo "🔄 Invalidating CloudFront cache for distribution: $CLOUDFRONT_DIST_ID"
  aws cloudfront create-invalidation \
    --distribution-id $CLOUDFRONT_DIST_ID \
    --paths "/*"
  echo "✅ CloudFront invalidation created!"
fi

echo "🚀 Deployment complete!"
echo "📍 Your app is now live at: https://$S3_BUCKET.s3-website-$(aws configure get region).amazonaws.com"

if [ -n "$CLOUDFRONT_DIST_ID" ]; then
  CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution --id $CLOUDFRONT_DIST_ID --query 'Distribution.DomainName' --output text)
  echo "📍 CloudFront URL: https://$CLOUDFRONT_DOMAIN"
fi
