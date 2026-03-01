# .mjs Extension Update Summary

## Changes Made

Updated the generate-embeddings Lambda build process to output `index.mjs` instead of `index.js` for explicit ES module support.

## Why .mjs?

### Benefits of .mjs Extension

1. **Explicit Module Type**: The `.mjs` extension explicitly tells Node.js and AWS Lambda that this is an ES module, eliminating any ambiguity
2. **No package.json Required**: While we still use `"type": "module"` in package.json, the `.mjs` extension works even without it
3. **Better Tooling Support**: Many tools and IDEs recognize `.mjs` as ES modules automatically
4. **AWS Lambda Best Practice**: AWS Lambda documentation recommends `.mjs` for ES modules
5. **Prevents CommonJS Fallback**: Ensures Node.js never tries to load the file as CommonJS

### Comparison

| Approach | Pros | Cons |
|----------|------|------|
| `.js` + `"type": "module"` | Standard approach | Requires package.json in every directory |
| `.mjs` | Explicit, no ambiguity | Slightly less common |
| `.cjs` | Explicit CommonJS | Not applicable (we use ES modules) |

## Files Modified

### 1. tsconfig.json
**Changes**:
- Updated `moduleResolution` from `"node"` to `"bundler"`
- Added `declarationMap`, `sourceMap`, `allowSyntheticDefaultImports`
- Added `ts-node.esm` configuration

**Why**: Better ES module support and compatibility with modern bundlers.

### 2. build.mjs
**Changes**:
- Added step to rename `index.js` → `index.mjs`
- Added step to rename `index.d.ts` → `index.d.mts`
- Updated import path fixing to work with `.mjs` files

**Why**: Automate the conversion to `.mjs` extension after TypeScript compilation.

### 3. package.json
**Changes**:
- Updated `main` from `"dist/index.js"` to `"dist/index.mjs"`

**Why**: Reflect the new output file name.

### 4. Documentation
**Files Updated**:
- `README.md` - Updated build instructions
- `ES_MODULES_SETUP.md` - Updated configuration examples
- `MJS_UPDATE_SUMMARY.md` - This file (new)

## Build Process

### Before
```
TypeScript → index.js → Fix imports → Deploy
```

### After
```
TypeScript → index.js → Rename to index.mjs → Fix imports → Deploy
```

### Build Output
```
dist/
├── index.mjs          ✅ ES module (explicit)
├── index.d.mts        ✅ TypeScript declaration for .mjs
├── index.js.map       ✅ Source map
├── node_modules/      ✅ Dependencies
└── shared/            ✅ Shared modules
```

## TypeScript Configuration

### moduleResolution: "bundler"

We changed from `"node"` to `"bundler"` for better ES module support:

**"node"** (old):
- Classic Node.js module resolution
- Looks for `index.js` in directories
- May have issues with pure ES modules

**"bundler"** (new):
- Modern bundler-style resolution
- Better support for ES modules
- Handles `.mjs` files correctly
- Works with tools like Vite, esbuild, etc.

## AWS Lambda Handler

The Lambda handler configuration remains the same:

```hcl
resource "aws_lambda_function" "generate_embeddings" {
  handler = "index.handler"
  runtime = "nodejs20.x"
  # ...
}
```

AWS Lambda automatically recognizes `.mjs` files as ES modules and loads them correctly.

## Testing

### Build Test
```bash
npm run build:lambda
```

**Expected Output**:
```
Building Generate Embeddings Lambda...
📦 Installing dependencies...
🔨 Compiling TypeScript...
🔄 Renaming index.js to index.mjs...
✅ Renamed index.js → index.mjs
✅ Renamed index.d.ts → index.d.mts
📋 Copying node_modules to dist...
📋 Copying shared embeddings module...
📋 Copying shared vector-store module...
🔧 Fixing import paths in index.mjs...
✅ Build complete!
📁 Output: dist/index.mjs
```

### Verify Output
```bash
ls dist/
# Should show: index.mjs, index.d.mts, node_modules/, shared/
```

### Type Check
```bash
npm run build
# Should compile without errors
```

## Deployment

No changes required to the deployment process:

```bash
cd terraform
terraform apply
```

Terraform will automatically package the `dist/` folder including `index.mjs`.

## Troubleshooting

### Issue: "Cannot find module 'index.mjs'"
**Cause**: Build script didn't run or failed
**Solution**: Run `npm run build:lambda`

### Issue: TypeScript errors after update
**Cause**: tsconfig.json changes
**Solution**: 
```bash
rm -rf node_modules dist
npm install
npm run build
```

### Issue: Lambda handler not found
**Cause**: Handler configuration mismatch
**Solution**: Verify Terraform has `handler = "index.handler"` (not `index.mjs.handler`)

## Benefits Summary

✅ **Explicit ES Module**: No ambiguity about module type
✅ **Better Compatibility**: Works with all Node.js versions that support ES modules
✅ **AWS Best Practice**: Follows AWS Lambda recommendations
✅ **Tooling Support**: Better IDE and tool recognition
✅ **Future-Proof**: Standard approach for modern JavaScript

## References

- [Node.js ES Modules](https://nodejs.org/api/esm.html)
- [AWS Lambda Node.js ES Modules](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html#nodejs-handler-esmodules)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [ES Module File Extensions](https://nodejs.org/api/packages.html#determining-module-system)
