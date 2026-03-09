#!/usr/bin/env node

/**
 * Build script for shared rag library
 * Compiles TypeScript and renames .js to .mjs for ES modules
 */

import { execSync } from 'child_process';
import { readdirSync, readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, rmSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Building shared rag library...\n');

// Step 1: Compile TypeScript
console.log('🔨 Compiling TypeScript...');
execSync('tsc', { stdio: 'inherit', cwd: __dirname });

// Step 2: Rename all .js files to .mjs in dist
console.log('\n📝 Renaming .js files to .mjs...');
const distDir = join(__dirname, 'dist');

if (existsSync(distDir)) {
    const files = readdirSync(distDir);

    for (const file of files) {
        if (file.endsWith('.js')) {
            const oldPath = join(distDir, file);
            const newPath = join(distDir, file.replace('.js', '.mjs'));
            renameSync(oldPath, newPath);
            console.log(`  ✅ ${file} → ${file.replace('.js', '.mjs')}`);
        }
    }
}

// Step 3: Copy sibling dependencies into dist
console.log('\n📋 Copying sibling dependencies...');

const siblingModules = ['embeddings', 'vector-store', 'cache', 'metrics'];

for (const moduleName of siblingModules) {
    const moduleSource = join(__dirname, '..', moduleName, 'dist');
    const moduleDest = join(distDir, moduleName);

    if (existsSync(moduleSource)) {
        // Remove existing if present
        if (existsSync(moduleDest)) {
            rmSync(moduleDest, { recursive: true, force: true });
        }

        mkdirSync(moduleDest, { recursive: true });
        cpSync(moduleSource, moduleDest, { recursive: true });
        console.log(`  ✅ Copied ${moduleName}`);

        // Ensure package.json exists for ES module support
        const modulePackageJson = join(moduleDest, 'package.json');
        if (!existsSync(modulePackageJson)) {
            writeFileSync(modulePackageJson, JSON.stringify({ type: 'module' }, null, 2), 'utf-8');
        }
    } else {
        console.warn(`  ⚠️  Warning: ${moduleName}/dist not found, skipping...`);
    }
}

// Step 4: Fix imports in .mjs files to reference local copies
console.log('\n🔧 Fixing import paths in .mjs files...');

if (existsSync(distDir)) {
    const files = readdirSync(distDir);

    for (const file of files) {
        if (file.endsWith('.mjs')) {
            const filePath = join(distDir, file);
            let content = readFileSync(filePath, 'utf-8');

            // Replace imports without extensions to include .mjs
            const originalContent = content;

            // Match: from './module' or from "./module"
            content = content.replace(/from ['"](\.\/.+?)['"];/g, (match, path) => {
                if (!path.endsWith('.mjs') && !path.endsWith('.js')) {
                    return `from '${path}.mjs';`;
                }
                return match;
            });

            // Match: export * from './module'
            content = content.replace(/export \* from ['"](\.\/.+?)['"];/g, (match, path) => {
                if (!path.endsWith('.mjs') && !path.endsWith('.js')) {
                    return `export * from '${path}.mjs';`;
                }
                return match;
            });

            // Replace .js imports with .mjs
            content = content.replace(/from ['"](\.\/.+)\.js['"]/g, "from '$1.mjs'");
            content = content.replace(/import\(['"](\.\/.+)\.js['"]\)/g, "import('$1.mjs')");

            // Fix imports from sibling modules to use local copies
            // Change: ../../embeddings/dist/embeddings.js → ./embeddings/embeddings.mjs
            content = content.replace(
                /from ['"]\.\.\/\.\.\/embeddings\/dist\/(.+?)\.js['"]/g,
                "from './embeddings/$1.mjs'"
            );
            content = content.replace(
                /from ['"]\.\.\/\.\.\/vector-store\/dist\/(.+?)\.js['"]/g,
                "from './vector-store/$1.mjs'"
            );
            content = content.replace(
                /from ['"]\.\.\/\.\.\/cache\/dist\/(.+?)\.js['"]/g,
                "from './cache/$1.mjs'"
            );
            content = content.replace(
                /from ['"]\.\.\/\.\.\/metrics\/dist\/(.+?)\.mjs['"]/g,
                "from './metrics/$1.mjs'"
            );

            if (content !== originalContent) {
                writeFileSync(filePath, content, 'utf-8');
                console.log(`  ✅ Fixed imports in ${file}`);
            }
        }
    }
}

console.log('\n✅ Build complete!');
console.log('📁 Output: dist/*.mjs');
console.log('📦 Sibling dependencies: dist/{embeddings,vector-store,cache,metrics}/\n');
