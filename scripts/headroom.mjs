// Modulo condiviso: profilo risparmio + helper per headroom proxy.
// Usato sia da scripts/start-agent.mjs (wrapper opencode) sia da
// scripts/dev.mjs (vite dev server). Modifica SAVINGS_PROFILE qui per
// cambiare l'aggressività in tutto il progetto.

import { spawn, execSync } from 'node:child_process';
import { existsSync, openSync, appendFileSync, writeFileSync, unlinkSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.join(__dirname, '..');
export const LOG_FILE = path.join(PROJECT_ROOT, '.headroom.log');

export const PORT = 8787;
export const PROXY_URL = `http://127.0.0.1:${PORT}`;
export const DASHBOARD_URL = `${PROXY_URL}/dashboard`;
export const READY_TIMEOUT_MS = 30_000;

// === PROFILO RISPARMIO (modifica qui per cambiare aggressività) ============
// agent-90 = profilo più aggressivo di headroom (target 90% savings input).
// + output shaper attivo = taglia anche i token in uscita (5x più cari su
// Anthropic). + budget cap giornaliero = hard stop se sfori. Override via env:
//   HEADROOM_BUDGET_USD=10.0 npm run agent:proxy
export const SAVINGS_PROFILE = {
  // Profilo "agent-90" — input compression aggressiva
  HEADROOM_MODE: 'token',
  HEADROOM_SAVINGS_PROFILE: 'agent-90',
  HEADROOM_SAVINGS_TARGET: '0.90',
  HEADROOM_TARGET_RATIO: '0.10',
  HEADROOM_COMPRESS_USER_MESSAGES: '1',
  HEADROOM_COMPRESS_SYSTEM_MESSAGES: '1',
  HEADROOM_PROTECT_RECENT: '2',
  HEADROOM_PROTECT_ANALYSIS_CONTEXT: '1',
  HEADROOM_MIN_TOKENS: '120',
  HEADROOM_MAX_ITEMS: '8',
  HEADROOM_SMART_CRUSHER_COMPACTION: '0',
  HEADROOM_FORCE_KOMPRESS: '1',
  HEADROOM_ACCURACY_GUARD: 'strict',
  // Output shaper — taglia i token scritti dal modello (più cari)
  HEADROOM_OUTPUT_SHAPER: '1',
  // Budget cap — default 5 USD/giorno. Override con env HEADROOM_BUDGET_USD.
  HEADROOM_BUDGET: process.env.HEADROOM_BUDGET_USD || '5.0',
  HEADROOM_BUDGET_PERIOD: 'daily',
};
// ==========================================================================

// ANSI helpers
export const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};
export const paint = (color, s) => `${c[color]}${s}${c.reset}`;

export function isProxyUp() {
  return new Promise((resolve) => {
    const req = http.get(
      `${PROXY_URL}/livez`,
      { timeout: 3000 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

export function findProxyPids() {
  try {
    if (os.platform() === 'win32') {
      const out = execSync(
        "wmic process where \"name='headroom.exe'\" get ProcessId /format:list",
        { stdio: ['ignore', 'pipe', 'ignore'] }
      ).toString();
      return out
        .split('\n')
        .map((l) => l.match(/ProcessId=(\d+)/i)?.[1])
        .filter(Boolean);
    }
    const out = execSync("pgrep -f 'headroom proxy'", { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export function killProxy() {
  const pids = findProxyPids();
  if (pids.length === 0) return false;
  for (const pid of pids) {
    try {
      if (os.platform() === 'win32') {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      } else {
        process.kill(Number(pid), 'SIGTERM');
      }
    } catch {
      // best effort
    }
  }
  return true;
}

export function startProxy({ source = 'unknown', silent = false } = {}) {
  if (!silent) {
    console.log(paint('cyan', '→ Avvio headroom proxy su :' + PORT));
    console.log(paint('dim', `  log: ${LOG_FILE}`));
    console.log(paint('dim', `  profilo: agent-90 + output shaper + budget $${SAVINGS_PROFILE.HEADROOM_BUDGET}/${SAVINGS_PROFILE.HEADROOM_BUDGET_PERIOD}`));
  }
  appendFileSync(LOG_FILE, `\n--- [${source}] start ${new Date().toISOString()} ---\n`);

  // Settiamo il profilo risparmio PRIMA di spawnare il proxy.
  for (const [k, v] of Object.entries(SAVINGS_PROFILE)) {
    process.env[k] = v;
  }

  try {
    // Stessa logica su Windows e POSIX: spawn Node diretto con detached
    // + env esplicito. Così l'env var del profilo arriva al proxy al 100%
    // (cmd /c start /B su Windows non propaga env vars custom).
    const out = openSync(LOG_FILE, 'a');
    const errFd = openSync(LOG_FILE, 'a');
    const child = spawn(
      'headroom',
      [
        'proxy',
        '--port', String(PORT),
        '--target-ratio', SAVINGS_PROFILE.HEADROOM_TARGET_RATIO,
        '--budget', SAVINGS_PROFILE.HEADROOM_BUDGET,
        '--budget-period', SAVINGS_PROFILE.HEADROOM_BUDGET_PERIOD,
      ],
      {
        detached: true,
        stdio: ['ignore', out, errFd],
        env: { ...process.env, ...SAVINGS_PROFILE },
        windowsHide: true,
      }
    );
    child.unref();
    return true;
  } catch (err) {
    appendFileSync(LOG_FILE, `\n[${source}] spawn error: ${err?.message || err}\n`);
    if (!silent) {
      console.error(paint('red', `✗ Impossibile avviare headroom: ${err.message}`));
      console.error(paint('dim', '  installalo con: pip install "headroom-ai[all]"'));
    }
    return false;
  }
}

export async function waitForProxy() {
  const start = Date.now();
  while (Date.now() - start < READY_TIMEOUT_MS) {
    if (await isProxyUp()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

export function openBrowserInDev() {
  if (process.env.NODE_ENV === 'production') return;
  try {
    if (os.platform() === 'win32') {
      spawn('cmd', ['/c', 'start', '""', PROXY_URL], { detached: true, stdio: 'ignore' }).unref();
    } else if (os.platform() === 'darwin') {
      spawn('open', [PROXY_URL], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [PROXY_URL], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    // Browser not available — just print the URL so the user can click it.
  }
}

// Scrive uno script .bat in shell:startup (Windows) che lancia headroom
// al logon dell'utente. No admin richiesto. Solo utente corrente.
export function writeStartupBat(batPath, logPath) {
  const envExports = Object.entries(SAVINGS_PROFILE)
    .map(([k, v]) => `set "${k}=${v}"`)
    .join('\r\n');
  const content = `@echo off\r\n${envExports}\r\nstart /B "" headroom proxy --port ${PORT} --target-ratio ${SAVINGS_PROFILE.HEADROOM_TARGET_RATIO} --budget ${SAVINGS_PROFILE.HEADROOM_BUDGET} --budget-period ${SAVINGS_PROFILE.HEADROOM_BUDGET_PERIOD} > "${logPath}" 2>&1\r\n`;
  writeFileSync(batPath, content);
}

export function removeStartupBat(batPath) {
  if (existsSync(batPath)) {
    unlinkSync(batPath);
  }
}
