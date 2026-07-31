#!/usr/bin/env node
// Spec lifecycle reminder. Regola (AGENTS.md "Regola spec"):
//   1. Implementazione di una spec = UN unico commit dedicato.
//   2. Ultimo step = cancellare il file spec da docs/spec/ + nota in docs/done.md.
//      Mai lasciare spec "attive" a implementazione completata.
// Non-blocking (exit 0 sempre): puro nudge, come docs-sync-check.
//
// Usage: node scripts/spec-sync-check.mjs [base..head]
// Default: @{u}..HEAD (upstream) se esiste, altrimenti HEAD~1..HEAD.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const range = process.argv[2] ?? (hasUpstream() ? '@{u}..HEAD' : 'HEAD~1..HEAD');

function hasUpstream() {
  try {
    execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function run(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function changed() {
  return run(`git diff --name-status ${range}`)
    .split('\n').map(s => s.trim()).filter(Boolean)
    .map(line => {
      const [st, path] = line.split(/\t+/);
      return { st, path };
    });
}

const changes = changed();
const codeChanges = changes.filter(c => /^(src|api|db|e2e)\//.test(c.path));
const specChanges = changes.filter(c => c.path.startsWith('docs/spec/'));
const specDeleted = specChanges.filter(c => c.st === 'D' || c.st.startsWith('D'));
const specAdded = specChanges.filter(c => c.st === 'A' || c.st.startsWith('A'));
const codeCommits = run(`git log --oneline ${range} -- src api db e2e`).split('\n').filter(Boolean).length;

let warned = false;
const warn = msg => {
  if (!warned) {
    console.warn('\n[spec-sync] reminder:');
    warned = true;
  }
  console.warn('  ' + msg);
};

// Regola "ultimo step = cancellare la spec": pusho codice ma ci sono spec
// ancora presenti in docs/spec/ (tracked e non cancellate nel range).
if (codeChanges.length > 0 && specDeleted.length === 0) {
  const active = run('git ls-files docs/spec/').split('\n').filter(Boolean);
  if (active.length > 0) {
    warn(`Stai pushando codice ma ${active.length} spec è/sono ancora presente/i in docs/spec/: ${active.join(', ')}.`);
    warn('  Regola spec: ultimo step = cancellare il file spec + nota di completamento in docs/done.md.');
  }
}

// Spec cancellata nel range ma docs/done.md non aggiornato.
if (specDeleted.length > 0 && !changes.some(c => c.path === 'docs/done.md')) {
  warn(`Spec cancellata (${specDeleted.map(c => c.path).join(', ')}) ma docs/done.md non toccato — aggiungi la nota di completamento.`);
}

// Regola "un unico commit per spec": spec introdotta nel range e NON
// cancellata nello stesso range (ciclo ancora aperto) ma codice distribuito
// su più commit (implementazione non dedicata).
const specAddedNotDeleted = specAdded.filter(a => !specDeleted.some(d => d.path === a.path));
if (specAddedNotDeleted.length > 0 && codeCommits > 1) {
  warn(`Spec introdotta (${specAddedNotDeleted.map(c => c.path).join(', ')}) con ${codeCommits} commit di codice nel range.`);
  warn('  Regola spec: implementazione = UN unico commit dedicato.');
}

if (warned) {
  console.warn('  (reminder non bloccante — cancella la spec come ultimo step se l\'implementazione è completa)');
}
process.exit(0);
