# Quick Start Guide

## Deploy with Terraform (Recommended)

```bash
# 1. Navigate to terraform directory
cd terraform

# 2. Initialize Terraform
terraform init

# 3. Review changes
terraform plan

# 4. Deploy
terraform apply
```

That's it! Terraform will:
- Build the Lambda layer with dependencies
- Package the function code
- Deploy both to AWS
- Configure S3 event triggers

## Manual Deployment

### Build Layer

**Linux/Mac:**
```bash
cd lambda/document-processor/extract-text
./build_layer.sh
```

**Windows:**
```powershell
cd lambda/document-processor/extract-text
.\build_layer.ps1
```

### Deploy Layer

```bash
aws lambda publish-layer-version \
  --layer-name chatbot-document-processor-deps \
  --zip-file fileb://document-processor-layer.zip \
  --compatible-runtimes python3.11
```

### Deploy Function

```bash
# Package function
zip function.zip index.py

# Deploy
aws lambda create-function \
  --function-name chatbot-document-processor \
  --runtime python3.11 \
  --role arn:aws:iam::ACCOUNT_ID:role/lambda-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --layers LAYER_ARN \
  --timeout 300 \
  --memory-size 3008
```

## Test

```bash
# Upload test PDF
aws s3 cp test.pdf s3://BUCKET/uploads/test-id/test.pdf

# Check logs
aws logs tail /aws/lambda/chatbot-document-processor --follow

# Verify output
aws s3 ls s3://BUCKET/processed/test-id/
```

## Update Function Code

```bash
# Update code
zip function.zip index.py

# Deploy update
aws lambda update-function-code \
  --function-name chatbot-document-processor \
  --zip-file fileb://function.zip
```

## Update Dependencies

```bash
# 1. Update requirements.txt
# 2. Rebuild layer
./build_layer.sh

# 3. Redeploy with Terraform
cd terraform
terraform apply
```

## Troubleshooting

**Import errors?**
- Check layer is attached: `aws lambda get-function --function-name chatbot-document-processor`
- Verify layer structure has `python/` directory

**Timeout?**
- Increase memory: `aws lambda update-function-configuration --memory-size 3008`
- Check PDF size and complexity

**Access denied?**
- Verify IAM role has S3 permissions
- Check bucket policy

## Next Steps

1. Run unit tests: `pytest test_index.py -v`
2. Monitor CloudWatch metrics
3. Set up alarms for errors and duration
4. Deploy to production environment
