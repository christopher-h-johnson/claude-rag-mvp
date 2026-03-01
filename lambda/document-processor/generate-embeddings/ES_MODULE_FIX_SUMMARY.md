# ES Module Configuration Fix Summary

## Problem

The Lambda function was showing a warning:
```
ERROR (node:2) Warning: To load an ES module, set "type": "module" in the package.json or use the .mjs extension.
```

This occurred because Node.js was trying to load ES module files (`.js` with `import`/`export` syntax) as CommonJS modules.

## Root Cause

1. The main `package.json` had `"type": "module"` ✅
2. BUT the shared modules copied to `dist/shared/` didn't have their own `package.json` with `"type": "module"` ❌
3. Node.js treats each directory with a `package.json` as a separate module boundary
4. Without `package.json` in the shared folders, Node.js defaulted to CommonJS

## Solution

### 1. Created Cross-Platform Build Script

**File**: `build.mjs`

A Node.js-based build script that works on Windows, macOS, and Linux:
- Compiles TypeScript
- Copies dependencies and shared modules
- Ensures `package.json` with `"type": "module"` exists in shared module folders
- Fixes import paths for Lambda deployment

### 2. Added package.json to Shared Module Dist Folders

**Files**:
- `lambda/shared/embeddings/dist/package.json`
- `lambda/shared/vector-store/dist/package.json`

Both contain:
```json
{
  "type": "module"
}
```

This tells Node.js to treat all `.js` files in these directories as ES modules.

### 3. Updated Build Process

**Before**:
```bash
npm run build  # Only compiled TypeScript
```

**After**:
```bash
npm run build:lambda  # Full Lambda deployment build
```

The new `build:lambda` script:
1. Installs dependencies
2. Compiles TypeScript
3. Copies `node_modules` to `dist/`
4. Copies shared modules to `dist/shared/`
5. Creates/verifies `package.json` in shared folders
6. Rewrites import paths

### 4. Updated Shared Module package.json

Added `"type": "module"` to:
- `lambda/shared/vector-store/package.json`

(embeddings already had it)

## File Structure After Build

```
dist/
├── package.json                    # "type": "module" (from root)
├── index.js                        # Main handler
├── node_modules/                   # All dependencies
└── shared/
    ├── embeddings/
    │   ├── package.json            # "type": "module" ✅
    │   ├── index.js
    │   ├── embeddings.js
    │   └── types.js
    └── vector-store/
        ├── package.json            # "type": "module" ✅
        ├── index.js
        ├── opensearch-client.js
        └── types.js
```

## How It Works

### Module Resolution in Node.js

When Node.js encounters:
```javascript
import { OpenSearchVectorStore } from './shared/vector-store/index.js';
```

It looks for the nearest `package.json` to determine the module type:

1. Checks `dist/shared/vector-store/package.json` → finds `"type": "module"` ✅
2. Loads `index.js` as an ES module
3. All imports work correctly

Without the `package.json`, Node.js would:
1. Check `dist/package.json` → finds `"type": "module"`
2. But the path `./shared/vector-store/` is treated as a subdirectory
3. Node.js gets confused about module boundaries
4. Shows the warning/error

## Testing

Build and verify:
```bash
cd lambda/document-processor/generate-embeddings
npm run build:lambda
```

Expected output:
```
Building Generate Embeddings Lambda...
📦 Installing dependencies...
🔨 Compiling TypeScript...
📋 Copying node_modules to dist...
📋 Copying shared embeddings module...
📋 Copying shared vector-store module...
🔧 Fixing import paths in index.js...
✅ Build complete!
```

## Benefits

1. **Cross-Platform**: Works on Windows, macOS, and Linux
2. **Proper ES Modules**: No more warnings or errors
3. **Maintainable**: Clear build process with documentation
4. **Automated**: Build script handles all the complexity
5. **Reliable**: Ensures correct module configuration every time

## References

- [Node.js ES Modules](https://nodejs.org/api/esm.html)
- [Node.js Package.json type field](https://nodejs.org/api/packages.html#type)
- [ES_MODULES_SETUP.md](./ES_MODULES_SETUP.md) - Full documentation
