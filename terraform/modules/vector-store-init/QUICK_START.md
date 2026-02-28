# Quick Start Guide - Vector Store Init Index

Deploy the OpenSearch index initialization Lambda in 3 steps.

## 1. Build the Lambda Function

```bash
cd lambda/vector-store/init-index
bash build-for-terraform.sh
```

## 2. Deploy with Terraform

```bash
cd terraform
terraform init
terraform apply
```

## 3. Initialize the Index

```bash
# Get the function name from Terraform output
FUNCTION_NAME=$(terraform output -raw vector_store_init_function_name)

# Invoke the function
aws lambda invoke \
  --function-name $FUNCTION_NAME \
  --payload '{}' \
  response.json

# Check the result
cat response.json
```

Expected output:
```json
{
  "statusCode": 200,
  "body": "{\"success\":true,\"message\":\"Index 'documents' created successfully with k-NN configuration\"}"
}
```

## Verify Index Creation

```bash
# Get OpenSearch endpoint
OPENSEARCH_ENDPOINT=$(terraform output -raw opensearch_endpoint)

echo "OpenSearch endpoint: $OPENSEARCH_ENDPOINT"
echo "Index 'documents' should now exist with k-NN configuration"
```

## Troubleshooting

**Lambda timeout?**
- Check VPC networking and security groups
- Ensure Lambda can reach OpenSearch on port 443

**Permission denied?**
- Verify IAM role has `es:ESHttpPut` permission
- Check OpenSearch access policies

**Index already exists?**
- This is normal - function is idempotent
- No action needed

## Next Steps

✅ Index created successfully!

Now you can:
1. Implement the Vector Store client (Task 9.2)
2. Start document processing (Task 10)
3. Generate and store embeddings (Task 11)

## Need Help?

See detailed documentation:
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Full deployment guide
- [README.md](./README.md) - Module documentation
- [Lambda README](../../../lambda/vector-store/init-index/README.md) - Function details
