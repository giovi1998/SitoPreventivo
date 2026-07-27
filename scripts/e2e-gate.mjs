#!/usr/bin/env node
// E2E gate: run Playwright on critical routes before merging to main.
// Critical specs (form preventivo -> generazione -> export + routing + AI logs).
// Run via: npm run pre:e2e   (manual, slow ~5-10min)
// NOT wired into pre-push (too slow). Use before merging to main.

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CRITICAL = [
  'e2e/url-routing.spec.ts',
  'e2e/card-export-inspection.spec.ts',
  'e2e/card-grid-export-roundtrip.spec.ts',
  'e2e/flyer-hero-entrypoint.spec.ts',
  'e2e/ai-log-preview.spec.ts',
];

const args = process.argv.slice(2);
const filter = args.length ? args : CRITICAL;

console.log('[e2e-gate] Running critical Playwright specs:\n  ' + filter.join('\n  ') + '\n');

try {
  execSync('npx playwright test ' + filter.map(s => `"${s}"`).join(' '), {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CI: 'true' },
  });
  console.log('\n[e2e-gate] PASS — critical routes green.');
  process.exit(0);
} catch (err) {
  console.error('\n[e2e-gate] FAIL — do not merge to main.');
  process.exit(1);
}