// Wrapper DX: `npm run dev` (vedi package.json)
// Phase 2.2 REQ-K01: avvia headroom proxy (best-effort, degrada con grazia
// se assente) + Vite in foreground. Stampa un banner informativo su
// caveman (skill auto-attiva).
//
// Questo file riusa la logica di scripts/start-agent.mjs (`isProxyUp`,
// `startProxy`, `waitForProxy`, `openBrowserInDev`) senza dipendenze nuove.

import { spawn, execSync } from 'node:child_process';
import { existsSync, openSync, appendFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

const HEADROOM_PORT = 8787;
const HEADROOM_URL = `http://127.0.0.1:${HEADROOM_PORT}`;
const HEADROOM_LOG = path.join(PROJECT_ROOT, '.headroom.log');
const HEADROOM_READY_TIMEOUT_MS = 30_000;

// ─── ANSI colors ────────────────────────────────────────────
const c = {
  reset: '\x1b[0m', dim: '\x1b[2m', green: '\x1b[32m',
  red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m',
};
const paint = (color, s) => `${c[color]}${s}${c.reset}`;

// ─── Banner (print once at start) ────────────────────────────
function printBanner() {
  console.log('');
  console.log(paint('cyan', '  ┌──────────────────────────────────────────────────────────┐'));
  console.log(paint('cyan', '  │   ') + paint('bold', 'PrecisionQuote dev server') + paint('cyan', '  (Phase 2.2)                              │'));
  console.log(paint('cyan', '  └──────────────────────────────────────────────────────────┘'));
  console.log('');
  console.log(paint('dim', '  • Vite: ') + 'http://localhost:8000');
  console.log(paint('dim', '  • caveman: ') + paint('green', 'output compresso attivo via skill (.agents/skills/caveman/)'));
  console.log('');
}

// ─── Headroom helpers (copied from start-agent.mjs) ──────────
function isProxyUp() {
  return new Promise((resolve) => {
    const req = http.get(
      `${HEADROOM_URL}/livez`,
      { timeout: 3000 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      },
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function startProxy() {
  console.log(paint('cyan', '→ Avvio headroom proxy su :' + HEADROOM_PORT));
  console.log(paint('dim', `  log: ${HEADROOM_LOG}`));
  appendFileSync(HEADROOM_LOG, `\n--- [dev.mjs] start ${new Date().toISOString()} ---\n`);
  try {
    if (os.platform() === 'win32') {
      execSync(
        `cmd /c "start /B headroom proxy --port ${HEADROOM_PORT} > "${HEADROOM_LOG}" 2>&1"`,
        { stdio: 'ignore' },
      );
    } else {
      const out = openSync(HEADROOM_LOG, 'a');
      const errFd = openSync(HEADROOM_LOG, 'a');
      const child = spawn('headroom', ['proxy', '--port', String(HEADROOM_PORT)], {
        detached: true,
        stdio: ['ignore', out, errFd],
      });
      child.unref();
    }
  } catch (err) {
    // Degrade con grazia: stampa warning e ritorna false.
    console.log(paint('yellow', `  ⚠ headroom non disponibile: ${err?.message || err}`));
    console.log(paint('dim', '    installalo con: pip install "headroom-ai[all]"'));
    console.log(paint('dim', '    (continua comunque con Vite)'));
    return false;
  }
  return true;
}

async function waitForProxy() {
  const start = Date.now();
  let lastLog = 0;
  while (Date.now() - start < HEADROOM_READY_TIMEOUT_MS) {
    if (await isProxyUp()) return true;
    const elapsed = Date.now() - start;
    if (elapsed - lastLog > 3000) {
      lastLog = elapsed;
      process.stdout.write(paint('dim', `  ...attendo proxy (${Math.floor(elapsed / 1000)}s)\r`));
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  process.stdout.write('\n');
  return false;
}

function openBrowserInDev() {
  if (process.env.NODE_ENV === 'production') return;
  try {
    if (os.platform() === 'win32') {
      spawn('cmd', ['/c', 'start', '""', HEADROOM_URL], { detached: true, stdio: 'ignore' }).unref();
    } else if (os.platform() === 'darwin') {
      spawn('open', [HEADROOM_URL], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [HEADROOM_URL], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    // best-effort
  }
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  printBanner();

  // 1. Headroom proxy (best-effort)
  let proxyUp = await isProxyUp();
  if (proxyUp) {
    console.log(paint('green', '✓ headroom proxy già attivo ') + paint('dim', `@ ${HEADROOM_URL}`));
  } else {
    const started = startProxy();
    if (started) {
      proxyUp = await waitForProxy();
      if (proxyUp) {
        console.log(paint('green', '\n✓ headroom proxy pronto ') + paint('dim', `@ ${HEADROOM_URL}`));
      } else {
        console.log(paint('yellow', '\n⚠ headroom proxy non risponde entro il timeout'));
        console.log(paint('dim', '  log: ' + HEADROOM_LOG));
        console.log(paint('dim', '  (continua comunque con Vite)'));
      }
    }
  }
  if (proxyUp) {
    console.log(paint('cyan', '\n→ Dashboard headroom: ') + paint('bold', HEADROOM_URL));
    openBrowserInDev();
  }

  // 2. Vite (foreground)
  console.log(paint('cyan', '\n→ Avvio Vite ') + paint('dim', '(http://localhost:8000)'));
  console.log('');

  // Local bin lookup (prefer npx if local node_modules exists)
  const viteBin = path.join(PROJECT_ROOT, 'node_modules', '.bin', os.platform() === 'win32' ? 'vite.cmd' : 'vite');
  const useLocal = existsSync(viteBin);
  const cmd = useLocal ? viteBin : 'npx';
  const args = useLocal ? [] : ['vite'];

  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: os.platform() === 'win32',
    env: process.env,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(paint('red', '✗ ' + (err?.message || String(err))));
  process.exit(1);
});
