#!/usr/bin/env node
// Pre-commit guard: verify server entrypoint imports resolve in prod (Vercel).
// Pattern (docs/functions/runtimes/node-js): `server.ts` alla root = unica
// Vercel Function; la root della funzione è la root del progetto, quindi gli
// import da src/ risolvono (gotcha §1 superato).
// Rules enforced:
//   1. server.ts + src/server/* devono importare solo node_modules o path
//      relativi che risolvono (niente import da api/ — cartella rimossa).
//   2. Ogni bare/package import deve risolvere via node resolution.
// Exit 1 on violation. Exit 0 on clean.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));

const errors = [];
const scanned = [];

function walkServer(dir) {
  const entries = require('node:fs').readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      walkServer(full);
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

    // Rule 1: import da api/ è vietato (cartella rimossa — monolite superato)
    if (spec.startsWith('../api/') || spec.startsWith('./api/') || spec === '../api' || spec === './api') {
      errors.push(`${rel}:${i + 1} import from '${spec}' — api/ non esiste più (server entrypoint, gotcha §1).`);
      continue;
    }

    // Rule 2: relative ./ or ../ must resolve to existing file
    if (spec.startsWith('.')) {
      const target = resolve(dirname(file), spec);
      const candidates = [target, target + '.ts', target + '.js', target + '.mjs', target + '/index.ts', target + '/index.js'];
      if (!candidates.some(existsSync)) {
        errors.push(`${rel}:${i + 1} relative import '${spec}' does not resolve to any file (checked: ${candidates.join(', ')}).`);
      }
      continue;
    }

    // Rule 3: bare package specifier must resolve via node
    try {
      require.resolve(spec, { paths: [root] });
    } catch {
      try {
        const pkgName = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        if (!existsSync(join(root, 'node_modules', pkgName))) {
          errors.push(`${rel}:${i + 1} bare import '${spec}' not resolvable (no node_modules/${pkgName}).`);
        }
      } catch {}
    }
  }
}

scanFile(join(root, 'server.ts'));
walkServer(join(root, 'src', 'server'));

if (errors.length) {
  console.error('\n[check-api-imports] FAILED — ' + errors.length + ' issue(s) in server entrypoint:\n');
  for (const e of errors) console.error('  ' + e);
  console.error('\nScanned ' + scanned.length + ' file(s): ' + scanned.join(', '));
  process.exit(1);
}

console.log('[check-api-imports] OK — ' + scanned.length + ' server file(s), all imports resolve.');
