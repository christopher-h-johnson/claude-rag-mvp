#!/usr/bin/env node

/**
 * Build script for Generate Embeddings Lambda
 * Cross-platform Node.js build script that handles ES modules properly
 */

import { execSync } from 'child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, cpSync, existsSync, rmSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Building Generate Embeddings Lambda...\n');

// Step 1: Install dependencies
console.log('📦 Installing dependencies...');
execSync('npm install', { stdio: 'inherit', cwd: __dirname });

// Step 2: Build TypeScript
console.log('\n🔨 Compiling TypeScript...');
execSync('npm run build', { stdio: 'inherit', cwd: __dirname });

// Step 3: Rename index.js to index.mjs for explicit ES module
console.log('\n� Renaming index.js to index.mjs...');
const indexJsPath = join(__dirname, 'dist', 'index.js');
const indexMjsPath = join(__dirname, 'dist', 'index.mjs');

if (existsSync(indexJsPath)) {
    renameSync(indexJsPath, indexMjsPath);
    console.log('✅ Renamed index.js → index.mjs');
}

// Also rename declaration file
const indexDtsPath = join(__dirname, 'dist', 'index.d.ts');
const indexDmtsPath = join(__dirname, 'dist', 'index.d.mts');

if (existsSync(indexDtsPath)) {
    renameSync(indexDtsPath, indexDmtsPath);
    console.log('✅ Renamed index.d.ts → index.d.mts');
}

// Step 4: Copy node_modules to dist
console.log('\n📋 Copying node_modules to dist...');
const nodeModulesSource = join(__dirname, 'node_modules');
const nodeModulesDest = join(__dirname, 'dist', 'node_modules');

if (existsSync(nodeModulesDest)) {
    rmSync(nodeModulesDest, { recursive: true, force: true });
}

cpSync(nodeModulesSource, nodeModulesDest, { recursive: true });

// Step 5: Copy shared embeddings module
console.log('\n📋 Copying shared embeddings module...');
const embeddingsSource = join(__dirname, '..', '..', '..', 'lambda', 'shared', 'embeddings', 'dist');
const embeddingsDest = join(__dirname, 'dist', 'shared', 'embeddings');

mkdirSync(embeddingsDest, { recursive: true });
cpSync(embeddingsSource, embeddingsDest, { recursive: true });

// Ensure package.json exists for ES module support
const embeddingsPackageJson = join(embeddingsDest, 'package.json');
if (!existsSync(embeddingsPackageJson)) {
    writeFileSync(embeddingsPackageJson, JSON.stringify({ type: 'module' }, null, 2), 'utf-8');
}

// Step 6: Copy shared vector-store module
console.log('\n� Copying shared vector-store module...');
const vectorStoreSource = join(__dirname, '..', '..', '..', 'lambda', 'shared', 'vector-store', 'dist');
const vectorStoreDest = join(__dirname, 'dist', 'shared', 'vector-store');

mkdirSync(vectorStoreDest, { recursive: true });
cpSync(vectorStoreSource, vectorStoreDest, { recursive: true });

// Ensure package.json exists for ES module support
const vectorStorePackageJson = join(vectorStoreDest, 'package.json');
if (!existsSync(vectorStorePackageJson)) {
    writeFileSync(vectorStorePackageJson, JSON.stringify({ type: 'module' }, null, 2), 'utf-8');
}

// Step 7: Fix import paths in index.mjs
console.log('\n🔧 Fixing import paths in index.mjs...');
let indexContent = readFileSync(indexMjsPath, 'utf-8');

// Replace relative paths to shared modules with local paths
indexContent = indexContent.replace(
    /from ['"]\.\.\/\.\.\/\.\.\/shared\/embeddings\/dist\/index\.js['"]/g,
    "from './shared/embeddings/index.js'"
);

indexContent = indexContent.replace(
    /from ['"]\.\.\/\.\.\/\.\.\/shared\/vector-store\/dist\/index\.js['"]/g,
    "from './shared/vector-store/index.js'"
);

indexContent = indexContent.replace(
    /from ['"]\.\.\/\.\.\/\.\.\/shared\/vector-store\/dist\/types\.js['"]/g,
    "from './shared/vector-store/types.js'"
);

writeFileSync(indexMjsPath, indexContent, 'utf-8');

console.log('\n✅ Build complete!');
console.log('📁 Output: dist/index.mjs');
console.log('📦 Dependencies: dist/node_modules/');
console.log('🔗 Shared modules: dist/shared/');

