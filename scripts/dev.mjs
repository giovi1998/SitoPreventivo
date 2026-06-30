// Wrapper DX: `npm run dev` (vedi package.json)
// Phase 2.2 REQ-K01: avvia headroom proxy (best-effort, degrada con grazia
// se assente) + Vite in foreground. Stampa un banner informativo su
// caveman (skill auto-attiva).
//
// Usa scripts/headroom.mjs per condividere SAVINGS_PROFILE + logica di
// avvio proxy con scripts/start-agent.mjs.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PORT, PROXY_URL, DASHBOARD_URL, PROJECT_ROOT, LOG_FILE,
  paint, isProxyUp, startProxy, waitForProxy, openBrowserInDev,
} from './headroom.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Banner (print once at start) ────────────────────────────
function printBanner() {
  console.log('');
  console.log(paint('cyan', '  ┌──────────────────────────────────────────────────────────┐'));
  console.log(paint('cyan', '  │   ') + paint('bold', 'PrecisionQuote dev server') + paint('cyan', '  (Phase 2.2)                              │'));
  console.log(paint('cyan', '  └──────────────────────────────────────────────────────────┘'));
  console.log('');
  console.log(paint('dim', '  • Vite: ') + 'http://localhost:8000');
  console.log(paint('dim', '  • caveman: ') + paint('green', 'output compresso attivo via skill (.agents/skills/caveman/)'));
  console.log(paint('dim', '  • headroom: ') + paint('green', 'proxy compression attivo se OPENAI_BASE_URL=' + PROXY_URL));
  console.log('');
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  printBanner();

  // 1. Headroom proxy (best-effort). Se già up, non lo si tocca (potrebbe
  // essere stato avviato con config diversa, es. agent-90). Se non up,
  // lo avviamo con SAVINGS_PROFILE (stesso profilo di start-agent).
  let proxyUp = await isProxyUp();
  if (proxyUp) {
    console.log(paint('green', '✓ headroom proxy già attivo ') + paint('dim', `@ ${PROXY_URL}`));
  } else {
    const started = startProxy({ source: 'dev' });
    if (started) {
      proxyUp = await waitForProxy();
      if (proxyUp) {
        console.log(paint('green', '\n✓ headroom proxy pronto ') + paint('dim', `@ ${PROXY_URL}`));
      } else {
        console.log(paint('yellow', '\n⚠ headroom proxy non risponde entro il timeout'));
        console.log(paint('dim', '  log: ' + LOG_FILE));
        console.log(paint('dim', '  (continua comunque con Vite)'));
      }
    } else {
      console.log(paint('yellow', '  ⚠ headroom non disponibile, Vite parte senza proxy'));
    }
  }
  if (proxyUp) {
    console.log(paint('cyan', '\n→ Dashboard headroom: ') + paint('bold', DASHBOARD_URL));
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

  // Propaga OPENAI_BASE_URL al child Vite SOLO se headroom è up E la var
  // non è già settata. Così l'utente può aprire la dashboard con
  // `npm run dev` senza dover lanciare `npm run agent` separatamente.
  const childEnv = { ...process.env };
  if (proxyUp && !childEnv.OPENAI_BASE_URL) {
    childEnv.OPENAI_BASE_URL = PROXY_URL;
    console.log(paint('green', `  ✓ Vite instradato attraverso headroom @ ${PROXY_URL}`));
  } else if (proxyUp && childEnv.OPENAI_BASE_URL === PROXY_URL) {
    console.log(paint('green', `  ✓ Vite eredita OPENAI_BASE_URL=headroom`));
  }

  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: os.platform() === 'win32',
    env: childEnv,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(paint('red', '✗ ' + (err?.message || String(err))));
  process.exit(1);
});
