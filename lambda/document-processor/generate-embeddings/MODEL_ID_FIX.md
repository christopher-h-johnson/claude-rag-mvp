# Bedrock Model ID Fix Summary

## Problem

Lambda execution failed with error:
```
ERROR Error generating embeddings: ValidationException: The provided model identifier is invalid.
```

## Root Cause

The Bedrock Titan Embeddings model ID was incorrect or outdated. The code was using:
```
amazon.titan-embed-text-v1
```

This model ID format may not be available in all regions or may have been deprecated in favor of newer versions.

## Solution

Updated the model ID to use Titan Embeddings V2:

### File: `lambda/shared/embeddings/src/embeddings.ts`

**Before**:
```typescript
this.modelId = config.modelId || 'amazon.titan-embed-text-v1';
```

**After**:
```typescript
this.modelId = config.modelId || 'amazon.titan-embed-text-v2:0';
```

## Bedrock Titan Embeddings Model IDs

### Available Models

| Model ID | Version | Dimensions | Max Input Tokens | Notes |
|----------|---------|------------|------------------|-------|
| `amazon.titan-embed-text-v1` | V1 | 1536 | 8192 | Legacy, may not be available in all regions |
| `amazon.titan-embed-text-v2:0` | V2 | 1024 or 256 | 8192 | Current version, recommended |

### V2 Model Features

Titan Embeddings V2 offers:
- **Multiple output dimensions**: 256, 512, or 1024 dimensions (configurable)
- **Better performance**: Improved embedding quality
- **Wider availability**: Available in more AWS regions
- **Versioned**: `:0` suffix indicates model version for stability

### Default Configuration

By default, V2 uses **1024 dimensions** (not 1536 like V1). If you need 1536 dimensions, you may need to:
1. Use V1 if available in your region
2. Or adjust your vector store configuration to use 1024 dimensions

## Dimension Compatibility

### Current Setup
- **Vector Store**: Configured for 1536 dimensions
- **Titan V1**: Outputs 1536 dimensions ✅
- **Titan V2**: Outputs 1024 dimensions by default ⚠️

### Options

#### Option 1: Use Titan V2 with 1024 dimensions (Recommended)
Update OpenSearch index to use 1024 dimensions:

```typescript
// In vector store index creation
{
  "embedding": {
    "type": "knn_vector",
    "dimension": 1024,  // Changed from 1536
    "method": {
      "name": "hnsw",
      "space_type": "cosinesimil",
      "engine": "lucene"
    }
  }
}
```

#### Option 2: Configure Titan V2 for 1024 dimensions
Titan V2 supports custom dimensions via request parameters:

```typescript
const requestBody = {
  inputText: text,
  dimensions: 1024,  // Specify output dimensions
  normalize: true    // Normalize vectors
};
```

#### Option 3: Use Titan V1 if available
Keep using V1 if it's available in your region and you need 1536 dimensions.

## Steps Taken

1. ✅ Updated model ID to `amazon.titan-embed-text-v2:0`
2. ✅ Rebuilt embeddings shared module
3. ✅ Rebuilt generate-embeddings Lambda
4. ⚠️ **TODO**: Verify dimension compatibility with OpenSearch index

## Verification

### Check Model Availability
You can verify which models are available in your region using AWS CLI:

```bash
aws bedrock list-foundation-models \
  --region us-east-1 \
  --query 'modelSummaries[?contains(modelId, `titan-embed`)].{ModelId:modelId,Name:modelName}' \
  --output table
```

### Test Embedding Generation
```bash
aws bedrock-runtime invoke-model \
  --region us-east-1 \
  --model-id amazon.titan-embed-text-v2:0 \
  --body '{"inputText":"test"}' \
  --cli-binary-format raw-in-base64-out \
  output.json

cat output.json
```

## Recommended Next Steps

### 1. Verify Dimension Compatibility

Check your OpenSearch index configuration:
```bash
curl -X GET "https://<opensearch-endpoint>/documents/_mapping?pretty"
```

Look for the `embedding` field dimension setting.

### 2. Update OpenSearch Index if Needed

If using Titan V2 with 1024 dimensions, update the index:

**Option A: Recreate Index** (if no data yet)
```bash
# Delete old index
curl -X DELETE "https://<opensearch-endpoint>/documents"

# Create new index with 1024 dimensions
# (Use the vector-store-init Lambda)
```

**Option B: Reindex** (if data exists)
```bash
# Create new index with 1024 dimensions
# Reindex all documents with new embeddings
# Delete old index
```

### 3. Update Documentation

Update any documentation that references:
- Model ID: `amazon.titan-embed-text-v1` → `amazon.titan-embed-text-v2:0`
- Dimensions: 1536 → 1024

### 4. Test End-to-End

1. Upload a test PDF
2. Verify embeddings are generated
3. Verify embeddings are indexed in OpenSearch
4. Test semantic search with a query

## Alternative: Configurable Model ID

For flexibility, you can make the model ID configurable via environment variable:

### Lambda Environment Variable
```hcl
# In Terraform
environment {
  variables = {
    BEDROCK_EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v2:0"
  }
}
```

### Code Update
```typescript
constructor(config: EmbeddingConfig = {}) {
  const region = config.region || process.env.AWS_REGION || 'us-east-1';
  this.modelId = config.modelId 
    || process.env.BEDROCK_EMBEDDING_MODEL_ID 
    || 'amazon.titan-embed-text-v2:0';

  this.client = new BedrockRuntimeClient({ region });
}
```

This allows changing the model without code changes.

## Status

✅ **Model ID Updated**: Now using `amazon.titan-embed-text-v2:0`
✅ **Code Rebuilt**: Embeddings module and Lambda rebuilt
⚠️ **Dimension Check Needed**: Verify OpenSearch index dimension compatibility
⚠️ **Testing Needed**: Test embedding generation with new model

## References

- [Amazon Titan Embeddings Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html)
- [Bedrock Model IDs](https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids.html)
- [Titan Embeddings V2 Release Notes](https://aws.amazon.com/about-aws/whats-new/2024/03/amazon-titan-embeddings-v2-bedrock/)
