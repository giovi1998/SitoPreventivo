#!/usr/bin/env node
// Pre-commit guard: verify api/ serverless imports resolve in prod (Vercel Lambda).
// Rules enforced (see docs/agent-gotchas.md §1):
//   1. No static import from ../src/ in api/*.ts (cross-boundary not bundled -> ERR_MODULE_NOT_FOUND)
//      Only dynamic `await import('../src/...')` is allowed in dev, but still risky in prod.
//   2. No import from api/_lib/ or api/_* paths (excluded from bundle).
//   3. Every bare/package import must resolve via node resolution.
// Exit 1 on violation. Exit 0 on clean.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));

const errors = [];
const scanned = [];

function walkApi(dir) {
  const entries = require('node:fs').readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      if (e.name.startsWith('_')) {
        // api/_* are excluded from Vercel bundle -> importing them = ERR_MODULE_NOT_FOUND
        errors.push(`api/${e.name}/ is excluded from Vercel bundle (api/_*). Move shared code to src/.`);
        continue;
      }
      walkApi(full);
    } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.js')) && !e.name.endsWith('.d.ts')) {
      scanFile(full);
    }
  }
}

function scanFile(file) {
  const rel = file.replace(root + '\\', '').replace(root + '/', '');
  scanned.push(rel);
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // import ... from '...'  |  import '...'  |  export ... from '...'
    const fromMatch = trimmed.match(/\bfrom\s+['"]([^'"]+)['"]/);
    const bareMatch = trimmed.match(/^\s*import\s+['"]([^'"]+)['"]/);
    const spec = fromMatch?.[1] ?? bareMatch?.[1];
    if (!spec) continue;

    // Rule 1: cross-boundary ../src/
    if (spec.startsWith('../src/') || spec === '../src' || /^(\.\.\/)+src\//.test(spec)) {
      // dynamic await import('../src/...') is technically allowed but still risky in prod
      const isDynamic = /\bawait\s+import\s*\(/.test(trimmed);
      if (isDynamic) {
        errors.push(`${rel}:${i + 1} WARN: dynamic \`await import('${spec}')\` from src/ — not resolved on Vercel Lambda (gotcha §1). Move shared code to bundled module or inline.`);
      } else {
        errors.push(`${rel}:${i + 1} static import from '${spec}' — cross-boundary, ERR_MODULE_NOT_FOUND on Vercel (gotcha §1). Use dynamic await import or move to api/.`);
      }
      continue;
    }

    // Rule 2: api/_* paths
    if (spec.startsWith('./_') || /^\.\/[^/]+\/_/.test(spec)) {
      errors.push(`${rel}:${i + 1} import from '${spec}' — api/_* excluded from bundle (gotcha §1).`);
      continue;
    }

    // Rule 3: relative ./ or ../ must resolve to existing file
    if (spec.startsWith('.')) {
      const target = resolve(dirname(file), spec);
      const candidates = [target, target + '.ts', target + '.js', target + '.mjs', target + '/index.ts', target + '/index.js'];
      if (!candidates.some(existsSync)) {
        errors.push(`${rel}:${i + 1} relative import '${spec}' does not resolve to any file (checked: ${candidates.join(', ')}).`);
      }
      continue;
    }

    // Rule 3b: bare package specifier must resolve via node
    try {
      require.resolve(spec, { paths: [root] });
    } catch {
      // Some package exports may not expose main for require — try import resolution
      try {
        // dynamic import for ESM resolution check (sync-ish via createRequire already failed)
        // Fallback: check node_modules/<pkg>/ exists
        const pkgName = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        if (!existsSync(join(root, 'node_modules', pkgName))) {
          errors.push(`${rel}:${i + 1} bare import '${spec}' not resolvable (no node_modules/${pkgName}).`);
        }
      } catch {}
    }
  }
}

walkApi(join(root, 'api'));

if (errors.length) {
  console.error('\n[check-api-imports] FAILED — ' + errors.length + ' issue(s) in api/:\n');
  for (const e of errors) console.error('  ' + e);
  console.error('\nScanned ' + scanned.length + ' file(s): ' + scanned.join(', '));
  process.exit(1);
}

console.log('[check-api-imports] OK — ' + scanned.length + ' api file(s), all imports resolve.');