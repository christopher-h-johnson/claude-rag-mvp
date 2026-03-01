# Dependencies Fix Summary

## Problem

Lambda execution failed with error:
```
"Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@opensearch-project/opensearch' imported from /var/task/shared/vector-store/opensearch-client.js"
```

## Root Cause

The shared `vector-store` module requires external dependencies that were not included in the Lambda deployment package:

1. `@opensearch-project/opensearch` - OpenSearch client library
2. `aws-sdk` - AWS SDK v2 (for SigV4 signing)

These dependencies were in the `vector-store` module's `package.json`, but not in the `generate-embeddings` Lambda's `package.json`. When we copy the shared module code, we also need to ensure its dependencies are available in the Lambda's `node_modules`.

## Solution

Added the missing dependencies to the generate-embeddings Lambda's `package.json`:

### File: `lambda/document-processor/generate-embeddings/package.json`

**Added**:
```json
{
  "dependencies": {
    "@opensearch-project/opensearch": "^2.12.0",
    "aws-sdk": "^2.1540.0"
  }
}
```

## Why This Happened

When we bundle shared modules into a Lambda:

1. **Code is copied**: The shared module's compiled JavaScript is copied to `dist/shared/`
2. **Dependencies are NOT automatically copied**: The shared module's dependencies must be explicitly added to the Lambda's `package.json`
3. **Node.js looks in node_modules**: At runtime, Node.js looks for packages in the Lambda's `node_modules`, not in the shared module's folder

### Dependency Resolution Flow

```
Lambda Runtime
    ↓
Loads: /var/task/shared/vector-store/opensearch-client.js
    ↓
Imports: @opensearch-project/opensearch
    ↓
Looks in: /var/task/node_modules/@opensearch-project/opensearch
    ↓
Found? ✅ Yes (after fix) / ❌ No (before fix)
```

## Complete Dependency List

The generate-embeddings Lambda now includes:

### Direct Dependencies
- `@aws-sdk/client-bedrock-runtime` - For Bedrock Titan Embeddings
- `@aws-sdk/client-dynamodb` - For DocumentMetadata updates
- `@aws-sdk/client-lambda` - For Lambda invocations
- `@aws-sdk/client-s3` - For S3 operations

### Shared Module Dependencies
- `@opensearch-project/opensearch` - For vector-store module
- `aws-sdk` - For vector-store module (SigV4 signing)

## Steps Taken

1. ✅ Identified missing dependencies from vector-store module
2. ✅ Added `@opensearch-project/opensearch` to package.json
3. ✅ Added `aws-sdk` to package.json
4. ✅ Ran `npm install` to install new dependencies
5. ✅ Ran `npm run build:lambda` to rebuild with dependencies
6. ✅ Verified packages exist in `dist/node_modules/`

## Verification

### Package Installation
```bash
npm install
# Added 50 packages
```

### Build Output
```bash
npm run build:lambda
# ✅ Build complete!
# 📦 Dependencies: dist/node_modules/
```

### Package Verification
```bash
Test-Path "dist/node_modules/@opensearch-project/opensearch"
# True ✅
```

## Best Practices for Shared Modules

When using shared modules in Lambda functions:

### 1. Document Dependencies
Create a clear list of what each shared module needs:

```markdown
## Shared Module Dependencies

### embeddings
- @aws-sdk/client-bedrock-runtime

### vector-store
- @opensearch-project/opensearch
- aws-sdk

### audit-logger
- (no external dependencies)
```

### 2. Add to Lambda package.json
Include all shared module dependencies in the Lambda's `package.json`:

```json
{
  "dependencies": {
    // Lambda's own dependencies
    "@aws-sdk/client-s3": "^3.0.0",
    
    // Shared module dependencies
    "@opensearch-project/opensearch": "^2.12.0",
    "aws-sdk": "^2.1540.0"
  }
}
```

### 3. Automate Dependency Checking
Consider adding a build step to verify all required dependencies are present:

```javascript
// In build.mjs
const requiredPackages = [
  '@opensearch-project/opensearch',
  'aws-sdk'
];

for (const pkg of requiredPackages) {
  if (!existsSync(join('node_modules', pkg))) {
    throw new Error(`Missing required package: ${pkg}`);
  }
}
```

## Alternative Approaches

### Option 1: Bundle Dependencies (Current Approach)
- ✅ Simple and straightforward
- ✅ Works with all packages
- ❌ Larger deployment package
- ❌ Duplicate dependencies if multiple Lambdas use same shared module

### Option 2: Lambda Layers
- ✅ Share dependencies across multiple Lambdas
- ✅ Smaller individual Lambda packages
- ❌ More complex deployment
- ❌ Layer size limits (250MB unzipped)

### Option 3: Monorepo with Workspace Dependencies
- ✅ Automatic dependency resolution
- ✅ Better dependency management
- ❌ More complex project structure
- ❌ Requires build tool configuration

For our use case, **Option 1 (Bundle Dependencies)** is the best choice because:
- Simple to understand and maintain
- Works reliably with Terraform deployment
- Deployment package size is acceptable

## Deployment Package Structure

After the fix, the Lambda deployment package includes:

```
dist/
├── index.mjs                           # Main handler
├── node_modules/                       # All dependencies
│   ├── @aws-sdk/                       # AWS SDK v3 packages
│   ├── @opensearch-project/            # OpenSearch client ✅
│   │   └── opensearch/
│   ├── aws-sdk/                        # AWS SDK v2 ✅
│   └── ... (other dependencies)
└── shared/                             # Shared modules
    ├── embeddings/
    │   └── index.js
    └── vector-store/
        ├── index.js
        └── opensearch-client.js        # Uses @opensearch-project/opensearch
```

## AWS SDK v2 vs v3

Note that we're using both:
- **AWS SDK v3** (`@aws-sdk/*`) - For Lambda's direct AWS operations (S3, DynamoDB, Bedrock)
- **AWS SDK v2** (`aws-sdk`) - For OpenSearch SigV4 signing (required by `@opensearch-project/opensearch`)

This is intentional and necessary because:
1. AWS SDK v3 is modular and tree-shakeable (smaller bundles)
2. OpenSearch client requires AWS SDK v2 for SigV4 signing
3. Both can coexist in the same Lambda

## Status

✅ **Fixed**: All required dependencies are now included
✅ **Verified**: Packages exist in dist/node_modules
✅ **Ready**: Lambda can now import and use OpenSearch client

## Next Steps

1. Deploy the updated Lambda
2. Test with a document upload
3. Verify embeddings are indexed in OpenSearch
4. Monitor CloudWatch logs for successful execution

## Related Files

- `lambda/document-processor/generate-embeddings/package.json` - Updated with dependencies
- `lambda/shared/vector-store/package.json` - Source of dependency requirements
- `lambda/document-processor/generate-embeddings/build.mjs` - Copies node_modules to dist
