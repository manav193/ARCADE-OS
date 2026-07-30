import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const ignored = new Set(['.git', 'node_modules']);
const files = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (ignored.has(entry)) continue;
    const absolute = join(directory, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) walk(absolute);
    else if (/\.(?:js|mjs|cjs)$/.test(entry)) files.push(absolute);
  }
}

walk(root);
if (!files.length) throw new Error('No JavaScript files found.');

for (const file of files) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  console.log(`syntax ok: ${relative(root, file)}`);
}

console.log(`Verified ${files.length} JavaScript files.`);
