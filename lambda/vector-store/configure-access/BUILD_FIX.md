# Fix: "Cannot find module '@opensearch-project/opensearch'"

## Problem

When the Lambda function runs, it fails with:
```
Error: Cannot find module '@opensearch-project/opensearch'
```

## Root Cause

The Lambda deployment package (zip file) didn't include the `node_modules` dependencies. 

Terraform's `archive_file` data source was only packaging the `dist/` folder, which contained the compiled JavaScript but not the dependencies.

## Solution

Created a build script that copies `node_modules` into the `dist/` folder before Terraform creates the zip file.

### What Was Added

**1. Build Script** (`build-for-terraform.sh`)
```bash
#!/bin/bash
set -e

# Install dependencies
npm install

# Compile TypeScript
npm run build

# Copy node_modules to dist (THIS IS THE KEY!)
cp -r node_modules dist/

# Verify
if [ ! -f "dist/index.js" ]; then
    echo "Error: dist/index.js not found"
    exit 1
fi
```

**2. Package.json Script**
```json
{
  "scripts": {
    "build": "tsc",
    "build:terraform": "bash build-for-terraform.sh"
  }
}
```

**3. Convenience Script** (`lambda/vector-store/build-all.sh`)

Builds both Lambda functions with one command.

## How to Fix

### Option 1: Use the Build Script (Recommended)

```bash
cd lambda/vector-store
bash build-all.sh
```

### Option 2: Build Individually

```bash
cd lambda/vector-store/configure-access
npm run build:terraform
```

### Option 3: Manual Steps

```bash
cd lambda/vector-store/configure-access
npm install
npm run build
cp -r node_modules dist/
```

## Verify the Fix

Check that node_modules was copied:

```bash
ls -la lambda/vector-store/configure-access/dist/node_modules
```

You should see:
```
drwxr-xr-x  @opensearch-project/
drwxr-xr-x  aws-sdk/
drwxr-xr-x  ... (other dependencies)
```

## Deploy and Test

```bash
# Deploy with Terraform
cd terraform
terraform apply

# Test the Lambda
aws lambda invoke \
  --function-name dev-opensearch-configure-access \
  --payload '{"lambdaRoleArn":"arn:aws:iam::123:role/test"}' \
  response.json

cat response.json
```

## Why This Happens

Lambda needs dependencies at runtime, but TypeScript compilation (`tsc`) only creates JavaScript files - it doesn't bundle dependencies.

### Before (Broken)
```
dist/
├── index.js
├── index.d.ts
└── index.js.map
```

Terraform zips this → Lambda can't find `@opensearch-project/opensearch`

### After (Fixed)
```
dist/
├── index.js
├── index.d.ts
├── index.js.map
└── node_modules/          ← Added!
    ├── @opensearch-project/
    ├── aws-sdk/
    └── ...
```

Terraform zips this → Lambda finds all dependencies ✓

## Alternative Solutions

### Option A: Use a Bundler (webpack/esbuild)

Bundle all dependencies into a single file:

```bash
npm install --save-dev esbuild
npx esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js
```

Pros: Smaller package size
Cons: More complex build, some modules don't bundle well

### Option B: Use Lambda Layers

Put dependencies in a Lambda Layer:

```hcl
resource "aws_lambda_layer_version" "opensearch" {
  filename   = "opensearch-layer.zip"
  layer_name = "opensearch-client"
}
```

Pros: Reusable across functions
Cons: More infrastructure to manage

### Option C: Copy node_modules (Current Solution)

Copy dependencies to dist folder:

```bash
cp -r node_modules dist/
```

Pros: Simple, reliable, works with all modules
Cons: Larger package size

## Best Practices

1. **Always use `build:terraform` for deployment**
   ```bash
   npm run build:terraform  # ✓ Includes dependencies
   npm run build            # ✗ Only compiles TypeScript
   ```

2. **Verify before deploying**
   ```bash
   ls dist/node_modules  # Should list dependencies
   ```

3. **Use the build-all script**
   ```bash
   cd lambda/vector-store
   bash build-all.sh
   ```

4. **Clean builds when in doubt**
   ```bash
   npm run clean
   npm run build:terraform
   ```

## Related Issues

This same pattern applies to:
- `lambda/vector-store/init-index` (already fixed)
- Any other Lambda functions using external dependencies

## Documentation

- [BUILD.md](../BUILD.md) - Complete build guide
- [README.md](./README.md) - Lambda function documentation
- [DEPLOYMENT_GUIDE.md](../../../terraform/modules/vector-store-init/DEPLOYMENT_GUIDE.md) - Deployment guide
