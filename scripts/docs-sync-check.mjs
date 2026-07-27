#!/usr/bin/env node
// Docs sync reminder: warn when src/ or api/ changed but docs/ + spec/ + README
// were not touched in the same commit range. Non-blocking (exit 0 always),
// pure nudge to keep AGENTS.md/docs/agent-gotchas.md/spec/ in sync.
//
// Usage: node scripts/docs-sync-check.mjs [base..head]
// Default: HEAD~1..HEAD (last commit).

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const range = process.argv[2] ?? 'HEAD~1..HEAD';

function changed(range) {
  try {
    return execSync(`git diff --name-only ${range}`, { cwd: root, encoding: 'utf8' })
      .split('\n').map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

const files = changed(range);
const code = files.filter(f => f.startsWith('src/') || f.startsWith('api/') || f.startsWith('db/'));
const docs = files.filter(f => f.startsWith('docs/') || f.startsWith('spec/') || f === 'README.md' || f === 'AGENTS.md');

if (code.length === 0) process.exit(0);

const touchedSpecOrGotchas = docs.some(f => f.includes('agent-gotchas') || f.startsWith('spec/'));
const stale = code.length > 0 && docs.length === 0;

if (stale || (code.length > 0 && !touchedSpecOrGotchas)) {
  console.warn('\n[docs-sync] reminder: code changed (' + code.length + ' file(s)) but no docs/spec/agent-gotchas update in ' + range + '.');
  console.warn('  Code: ' + code.slice(0, 5).join(', ') + (code.length > 5 ? ' ...' : ''));
  console.warn('  Consider updating:');
  console.warn('    - docs/agent-gotchas.md (module-specific rules)');
  console.warn('    - spec/  (active specs)');
  console.warn('    - README.md / AGENTS.md (public surface)');
  console.warn('');
}
process.exit(0);