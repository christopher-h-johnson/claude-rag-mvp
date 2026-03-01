# Export Error Fix Summary

## Problem

Lambda execution failed with error:
```
"errorMessage": "SyntaxError: The requested module './shared/vector-store/index.js' does not provide an export named 'OpenSearchVectorStore'"
```

## Root Cause

The `vector-store` shared module was compiled as **CommonJS** instead of **ES modules**:

### Before (CommonJS)
```javascript
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenSearchVectorStore = void 0;
var opensearch_client_1 = require("./opensearch-client");
Object.defineProperty(exports, "OpenSearchVectorStore", { enumerable: true, get: function () { return opensearch_client_1.OpenSearchVectorStore; } });
```

This uses CommonJS syntax (`exports`, `require`) which is incompatible with ES module imports.

### After (ES Module)
```javascript
export { OpenSearchVectorStore } from './opensearch-client';
```

This uses ES module syntax (`export`, `import`) which is compatible with our Lambda.

## Solution

Updated the `vector-store` module TypeScript configuration to output ES modules:

### File: `lambda/shared/vector-store/tsconfig.json`

**Changed**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",  // ❌ CommonJS
    // ...
  }
}
```

**To**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",  // ✅ ES Module
    "moduleResolution": "bundler",
    // ...
  }
}
```

## Steps Taken

1. **Updated vector-store tsconfig.json**
   - Changed `module` from `"commonjs"` to `"ES2022"`
   - Changed `target` from `"ES2020"` to `"ES2022"`
   - Changed `moduleResolution` to `"bundler"`
   - Added `allowSyntheticDefaultImports`

2. **Rebuilt vector-store module**
   ```bash
   cd lambda/shared/vector-store
   npm run build
   ```

3. **Rebuilt generate-embeddings Lambda**
   ```bash
   cd lambda/document-processor/generate-embeddings
   npm run build:lambda
   ```

## Verification

### Vector Store Output (ES Module)
```javascript
// lambda/shared/vector-store/dist/index.js
export { OpenSearchVectorStore } from './opensearch-client';

// lambda/shared/vector-store/dist/opensearch-client.js
export class OpenSearchVectorStore {
  // ...
}
```

### Generate Embeddings Import (ES Module)
```javascript
// lambda/document-processor/generate-embeddings/dist/index.mjs
import { OpenSearchVectorStore } from './shared/vector-store/index.js';
```

✅ **Compatible**: ES module import → ES module export

## Why This Happened

The `vector-store` module was originally created with CommonJS configuration, while the `embeddings` module was created with ES module configuration. When we updated `generate-embeddings` to use ES modules, we needed to ensure all shared modules were also ES modules.

## Module System Compatibility

| Import Type | Export Type | Compatible? |
|-------------|-------------|-------------|
| ES Module (`import`) | ES Module (`export`) | ✅ Yes |
| ES Module (`import`) | CommonJS (`exports`) | ❌ No |
| CommonJS (`require`) | CommonJS (`exports`) | ✅ Yes |
| CommonJS (`require`) | ES Module (`export`) | ⚠️ Sometimes |

Our Lambda uses ES module imports, so all shared modules must use ES module exports.

## Files Modified

### Updated
- `lambda/shared/vector-store/tsconfig.json` - Changed to ES module output
- `lambda/shared/vector-store/dist/index.js` - Rebuilt as ES module
- `lambda/shared/vector-store/dist/opensearch-client.js` - Rebuilt as ES module
- `lambda/document-processor/generate-embeddings/dist/shared/vector-store/*` - Updated via rebuild

### No Changes Required
- `lambda/shared/embeddings/*` - Already ES modules
- `lambda/document-processor/generate-embeddings/src/*` - Source code unchanged

## Testing

### Build Test
```bash
cd lambda/document-processor/generate-embeddings
npm run build:lambda
```

**Expected**: Build completes successfully ✅

### Module Verification
```bash
# Check vector-store exports ES modules
cat lambda/shared/vector-store/dist/index.js
# Should show: export { OpenSearchVectorStore }

# Check generate-embeddings imports ES modules
cat lambda/document-processor/generate-embeddings/dist/index.mjs
# Should show: import { OpenSearchVectorStore } from './shared/vector-store/index.js'
```

**Expected**: Both use ES module syntax ✅

### Lambda Execution
After deploying, the Lambda should:
1. Load the ES module successfully
2. Import `OpenSearchVectorStore` without errors
3. Execute the handler function

## Prevention

To prevent this issue in the future:

1. **Standardize on ES Modules**: All shared modules should use ES module configuration
2. **Check tsconfig.json**: Ensure `"module": "ES2022"` or `"ESNext"`
3. **Verify Build Output**: Check that compiled files use `export`/`import` syntax
4. **Test Imports**: Verify imports work before deploying

## Related Issues

This is similar to the earlier "To load an ES module" warning, but different:
- **Earlier issue**: Missing `"type": "module"` in package.json
- **This issue**: Module compiled as CommonJS instead of ES module

Both are module system compatibility issues, but require different fixes.

## Status

✅ **Fixed**: Vector store module now outputs ES modules
✅ **Verified**: Build completes successfully
✅ **Ready**: Lambda can now import and use OpenSearchVectorStore

## Next Steps

1. Deploy the updated Lambda
2. Test with a document upload
3. Verify embeddings are indexed in OpenSearch
4. Monitor CloudWatch logs for any remaining errors
