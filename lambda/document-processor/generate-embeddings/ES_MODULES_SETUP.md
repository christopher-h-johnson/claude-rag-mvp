# ES Modules Setup for Generate Embeddings Lambda

## Overview

This Lambda function uses ES modules (ESM) instead of CommonJS for better compatibility with modern JavaScript and AWS SDK v3. This document explains the setup and build process.

## Why ES Modules?

1. **AWS SDK v3 Compatibility**: AWS SDK v3 is designed for ES modules
2. **Modern JavaScript**: ES modules are the standard for modern JavaScript
3. **Better Tree Shaking**: Smaller bundle sizes with better dead code elimination
4. **Shared Module Compatibility**: Our shared modules use ES modules
5. **Explicit Module Type**: Using `.mjs` extension makes the module type unambiguous

## Configuration

### package.json
```json
{
  "type": "module",
  "main": "dist/index.mjs"
}
```

The `"type": "module"` field tells Node.js to treat `.js` files as ES modules. Additionally, we use the `.mjs` extension for the main handler file to explicitly indicate it's an ES module.

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler"
  }
}
```

TypeScript is configured to output ES2022 modules with bundler-style module resolution for better compatibility.

## Build Process

### Cross-Platform Build Script

We use a Node.js-based build script (`build.mjs`) instead of bash for cross-platform compatibility:

```bash
npm run build:lambda
```

This script:
1. Installs dependencies
2. Compiles TypeScript to JavaScript (ES2022 modules)
3. Renames `index.js` to `index.mjs` for explicit ES module support
4. Renames `index.d.ts` to `index.d.mts` for TypeScript declaration
5. Copies `node_modules` to `dist/`
6. Copies shared modules to `dist/shared/`
7. Ensures `package.json` with `"type": "module"` exists in shared module folders
8. Fixes import paths to use local shared modules

### Import Path Resolution

**Before build** (development):
```typescript
import { EmbeddingGenerator } from '../../../shared/embeddings/dist/index.js';
import { OpenSearchVectorStore } from '../../../shared/vector-store/dist/index.js';
```

**After build** (Lambda deployment):
```typescript
import { EmbeddingGenerator } from './shared/embeddings/index.js';
import { OpenSearchVectorStore } from './shared/vector-store/index.js';
```

The build script automatically rewrites these paths so the Lambda can find the bundled shared modules.

## Shared Modules

### Structure
```
dist/
├── index.mjs                   # Main Lambda handler (ES module)
├── index.d.mts                 # TypeScript declaration
├── node_modules/               # All dependencies
└── shared/                     # Bundled shared modules
    ├── embeddings/
    │   ├── package.json        # { "type": "module" }
    │   ├── index.js
    │   ├── embeddings.js
    │   └── types.js
    └── vector-store/
        ├── package.json        # { "type": "module" }
        ├── index.js
        ├── opensearch-client.js
        └── types.js
```

### Why Copy Shared Modules?

Lambda needs all code in a single deployment package. We can't use relative paths outside the Lambda directory, so we:
1. Copy the compiled shared modules into `dist/shared/`
2. Rewrite import paths to reference the local copies
3. Include `package.json` with `"type": "module"` so Node.js treats them as ES modules

## Troubleshooting

### Error: "To load an ES module, set 'type': 'module' in package.json"

**Cause**: A `.js` file is being loaded as CommonJS instead of ES module.

**Solution**: Ensure `package.json` has `"type": "module"` in:
- Root `lambda/document-processor/generate-embeddings/package.json`
- `dist/shared/embeddings/package.json`
- `dist/shared/vector-store/package.json`

The build script automatically creates these if missing.

### Error: "Cannot find module './shared/embeddings/index.js'"

**Cause**: Import paths weren't rewritten or shared modules weren't copied.

**Solution**: Run the full build:
```bash
npm run build:lambda
```

### Error: "Unexpected token 'export'"

**Cause**: Node.js is trying to load an ES module as CommonJS.

**Solution**: Verify all `package.json` files have `"type": "module"`.

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Compile TypeScript (for type checking)
npm run build

# Run tests
npm test
```

### Lambda Deployment
```bash
# Build for Lambda deployment
npm run build:lambda

# Deploy with Terraform
cd ../../../terraform
terraform apply
```

## Lambda Runtime

- **Runtime**: Node.js 20.x
- **Handler**: `index.handler`
- **Module System**: ES Modules (ESM)
- **Entry Point**: `index.mjs`

Node.js 20.x has full support for ES modules, including:
- Top-level `await`
- Dynamic `import()`
- `import.meta.url`
- Native `.mjs` file support

## Best Practices

1. **Always use `.js` extension in imports**: ES modules require explicit file extensions
   ```typescript
   // Good
   import { foo } from './bar.js';
   
   // Bad
   import { foo } from './bar';
   ```

2. **Use `build:lambda` for deployment**: Don't deploy the output of `npm run build` directly

3. **Keep shared modules in sync**: Rebuild shared modules before building the Lambda if they change

4. **Test locally with Node.js 20+**: Ensure your local Node.js version matches the Lambda runtime

## References

- [Node.js ES Modules Documentation](https://nodejs.org/api/esm.html)
- [AWS Lambda Node.js Runtime](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)
- [TypeScript ES Modules](https://www.typescriptlang.org/docs/handbook/esm-node.html)
