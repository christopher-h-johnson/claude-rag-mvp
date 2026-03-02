import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Building RAG module...');

// Clean dist directory
if (existsSync('dist')) {
    rmSync('dist', { recursive: true, force: true });
}

// Run TypeScript compiler
console.log('Running TypeScript compiler...');
execSync('tsc', { stdio: 'inherit' });

// Copy package.json to dist
console.log('Copying package.json...');
copyFileSync('package.json', 'dist/package.json');

// Function to recursively copy node_modules dependencies
function copyDependencies(sourceDir, targetDir) {
    if (!existsSync(sourceDir)) {
        return;
    }

    if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
    }

    const items = readdirSync(sourceDir);

    for (const item of items) {
        const sourcePath = join(sourceDir, item);
        const targetPath = join(targetDir, item);

        const stat = statSync(sourcePath);

        if (stat.isDirectory()) {
            copyDependencies(sourcePath, targetPath);
        } else {
            copyFileSync(sourcePath, targetPath);
        }
    }
}

// Copy local dependencies (embeddings, vector-store, cache)
console.log('Copying local dependencies...');
const localDeps = ['embeddings', 'vector-store', 'cache'];

for (const dep of localDeps) {
    const sourceDepDir = join(__dirname, '..', dep, 'dist');
    const targetDepDir = join(__dirname, 'dist', 'node_modules', dep);

    if (existsSync(sourceDepDir)) {
        console.log(`  Copying ${dep}...`);
        copyDependencies(sourceDepDir, targetDepDir);
    } else {
        console.warn(`  Warning: ${dep} dist directory not found at ${sourceDepDir}`);
    }
}

console.log('Build complete!');
