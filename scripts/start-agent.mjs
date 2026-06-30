// Wrapper per lanciare opencode con headroom proxy attivo in automatico.
//
// Comandi:
//   node scripts/start-agent.mjs            # start proxy (se non attivo) + lancia opencode
//   node scripts/start-agent.mjs proxy      # start proxy e basta (per uso manuale)
//   node scripts/start-agent.mjs stop       # termina il proxy
//   node scripts/start-agent.mjs status     # verifica se il proxy è in ascolto
//
// Il proxy resta attivo dopo l'uscita di opencode (persistenza tra sessioni).
// Per killarlo: `npm run agent:stop`.

import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PORT, PROXY_URL, DASHBOARD_URL,
  SAVINGS_PROFILE, c as _c, paint, isProxyUp, killProxy, startProxy,
  waitForProxy, openBrowserInDev, writeStartupBat, removeStartupBat,
} from './headroom.mjs';

const c = _c;

function setPersistentProxyEnv() {
  process.env.OPENAI_BASE_URL = PROXY_URL;
  process.env.ANTHROPIC_BASE_URL = PROXY_URL;

  if (os.platform() !== 'win32') return;

  // Persistente per nuovi processi Windows. setx aggiorna l'env utente;
  // i processi già aperti (opencode incluso) vanno riavviati.
  execSync(`setx OPENAI_BASE_URL "${PROXY_URL}"`, { stdio: 'ignore' });
  execSync(`setx ANTHROPIC_BASE_URL "${PROXY_URL}"`, { stdio: 'ignore' });
}

function installStartupAutostart() {
  if (os.platform() !== 'win32') return;
  const startupDir = path.join(
    process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
    'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'
  );
  const batPath = path.join(startupDir, 'headroom-proxy.bat');
  const logPath = path.join(os.homedir(), '.headroom-autostart.log');
  if (!existsSync(startupDir)) {
    throw new Error(`cartella startup non trovata: ${startupDir}`);
  }
  writeStartupBat(batPath, logPath);
  return { batPath, logPath };
}

function findOpencodeBin() {
  if (process.env.OPENCODE_BIN) {
    const p = process.env.OPENCODE_BIN;
    if (existsSync(p)) return p;
    throw new Error(`OPENCODE_BIN punta a un file inesistente: ${p}`);
  }
  // 1) PATH (case-insensitive su Windows via PATHEXT)
  try {
    const cmd = os.platform() === 'win32' ? 'where opencode' : 'which opencode';
    const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const first = out.split(/\r?\n/).find(Boolean);
    if (first && existsSync(first)) return first;
  } catch {
    // non in PATH
  }
  // 2) path di installazione noti su Windows
  if (os.platform() === 'win32') {
    const localApp = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const candidates = [
      path.join(localApp, 'Programs', '@opencode-aidesktop', 'OpenCode.exe'),
      path.join(localApp, 'Programs', 'OpenCode', 'OpenCode.exe'),
      path.join(localApp, 'Programs', 'opencode', 'opencode.exe'),
    ];
    for (const c of candidates) {
      if (existsSync(c)) return c;
    }
  }
  return null;
}

function launchOpencode() {
  const bin = findOpencodeBin();
  if (!bin) {
    console.error(paint('red', '✗ opencode non trovato.'));
    console.error(paint('dim', '  soluzioni:'));
    console.error(paint('dim', '    1. aggiungi opencode al PATH'));
    console.error(paint('dim', '    2. setta $env:OPENCODE_BIN = "C:\\path\\to\\OpenCode.exe"'));
    console.error(paint('dim', '    3. lancialo manualmente dopo `npm run agent:proxy` con:'));
    console.error(paint('dim', `       $env:OPENAI_BASE_URL="${PROXY_URL}"; opencode`));
    process.exit(1);
  }
  console.log(paint('cyan', '→ Lancio opencode ') + paint('dim', `(bin: ${bin})`));

  // Pre-launch guard: garantisce che la sessione venga instradata
  // attraverso headroom. Se l'utente ha settato OPENAI_BASE_URL a mano
  // rispettiamo la sua scelta, altrimenti impostiamo il proxy. Log
  // esplicito per auditing del routing.
  const childEnv = { ...process.env };
  if (childEnv.OPENAI_BASE_URL && childEnv.OPENAI_BASE_URL !== PROXY_URL) {
    console.log(
      paint('yellow', '  ⚠ OPENAI_BASE_URL già settato a ') +
      paint('bold', childEnv.OPENAI_BASE_URL) +
      paint('yellow', ` (override di headroom ${PROXY_URL})`)
    );
  } else {
    childEnv.OPENAI_BASE_URL = PROXY_URL;
    console.log(paint('green', `  ✓ instradato attraverso headroom @ ${PROXY_URL}`));
  }

  // Su Windows, .bat/.cmd non sono eseguibili nativi: serve cmd /c.
  // Gli .exe funzionano diretti. Detect via estensione.
  let cmdArgs, exe;
  if (os.platform() === 'win32' && /\.(bat|cmd)$/i.test(bin)) {
    exe = 'cmd.exe';
    cmdArgs = ['/c', bin];
  } else {
    exe = bin;
    cmdArgs = [];
  }
  const child = spawn(exe, cmdArgs, {
    stdio: 'inherit',
    env: childEnv,
    shell: false,
  });
  return new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      resolve({ code: code ?? (signal ? 1 : 0), signal });
    });
  });
}

async function cmdStart() {
  if (await isProxyUp()) {
    console.log(paint('green', '✓ headroom proxy già attivo ') + paint('dim', `@ ${PROXY_URL}`));
  } else {
    startProxy({ source: 'start-agent' });
    await waitForProxy();
    console.log(paint('green', '\n✓ headroom proxy pronto ') + paint('dim', `@ ${PROXY_URL}`));
  }
  console.log(paint('cyan', '→ Dashboard headroom: ') + paint('bold', DASHBOARD_URL));
  openBrowserInDev();
  const { code } = await launchOpencode();
  console.log('');
  console.log(paint('dim', `opencode uscito (code ${code}). headroom proxy resta attivo.`));
  console.log(paint('dim', `Per terminarlo: ${paint('reset', 'npm run agent:stop')}`));
  process.exit(code);
}

async function cmdStatus() {
  if (await isProxyUp()) {
    const { findProxyPids } = await import('./headroom.mjs');
    const pids = findProxyPids();
    console.log(paint('green', '● headroom proxy attivo') + paint('dim', ` @ ${PROXY_URL}  (pid: ${pids.join(', ') || 'n/a'})`));
    console.log(paint('cyan', '  Dashboard: ') + paint('bold', DASHBOARD_URL));
    process.exit(0);
  } else {
    console.log(paint('yellow', '○ headroom proxy NON attivo') + paint('dim', ` (porta ${PORT} libera)`));
    console.log(paint('dim', '  avvialo con: npm run agent:proxy'));
    process.exit(1);
  }
}

async function cmdStop() {
  if (!(await isProxyUp())) {
    console.log(paint('dim', '○ proxy già non attivo'));
    return;
  }
  killProxy();
  for (let i = 0; i < 25 && (await isProxyUp()); i++) {
    await new Promise((r) => setTimeout(r, 200));
  }
  if (await isProxyUp()) {
    console.log(paint('red', '✗ proxy ancora attivo dopo kill, riprova con privilegi elevati'));
    process.exit(1);
  }
  console.log(paint('green', '✓ headroom proxy terminato'));
}

// Apre la dashboard nel browser. Se il proxy non è attivo lo avvia prima
// (modalità no-op per chi vuole solo consultare le metriche correnti).
async function cmdDashboard() {
  if (!(await isProxyUp())) {
    startProxy({ source: 'dashboard' });
    await waitForProxy();
    console.log(paint('green', '\n✓ headroom proxy pronto ') + paint('dim', `@ ${PROXY_URL}`));
  } else {
    console.log(paint('green', '● headroom proxy attivo ') + paint('dim', `@ ${PROXY_URL}`));
  }
  console.log(paint('cyan', '\n→ Dashboard headroom: ') + paint('bold', DASHBOARD_URL));
  openDashboardInBrowser();
}

function openDashboardInBrowser() {
  try {
    if (os.platform() === 'win32') {
      spawn('cmd', ['/c', 'start', '""', DASHBOARD_URL], { detached: true, stdio: 'ignore' }).unref();
    } else if (os.platform() === 'darwin') {
      spawn('open', [DASHBOARD_URL], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [DASHBOARD_URL], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    // best effort
  }
}

// Crea/rimuove un Task Scheduler di Windows che lancia headroom proxy al
// logon dell'utente. Solo Windows. Per "sempre attivo" anche dopo reboot
// e anche se l'utente non lancia opencode.
async function cmdAutostart({ enable, mode = 'task' }) {
  if (os.platform() !== 'win32') {
    console.error(paint('red', '✗ autostart supportato solo su Windows per ora'));
    process.exit(1);
  }
  const taskName = 'HeadroomProxy';
  if (mode === 'startup') {
    // Fallback no-admin: cartella shell:startup (solo utente corrente).
    const startupDir = path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'
    );
    const batPath = path.join(startupDir, 'headroom-proxy.bat');
    const logPath = path.join(os.homedir(), '.headroom-autostart.log');
    if (enable) {
      try {
        if (!existsSync(startupDir)) {
          console.error(paint('red', `✗ cartella startup non trovata: ${startupDir}`));
          process.exit(1);
        }
        writeStartupBat(batPath, logPath);
        console.log(paint('green', `✓ Script startup creato: ${batPath}`));
        console.log(paint('dim', `  log autostart: ${logPath}`));
        console.log(paint('dim', '  Al prossimo logon Windows il proxy partirà in automatico.'));
      } catch (err) {
        console.error(paint('red', `✗ scrittura fallita: ${err.message}`));
        process.exit(1);
      }
    } else {
      try {
        removeStartupBat(batPath);
        console.log(paint('green', `✓ Script startup rimosso: ${batPath}`));
      } catch (err) {
        console.error(paint('red', `✗ rimozione fallita: ${err.message}`));
        process.exit(1);
      }
    }
    return;
  }
  if (enable) {
    const logPath = path.join(os.homedir(), '.headroom-autostart.log');
    const cmd = [
      'schtasks',
      '/Create',
      '/TN', taskName,
      '/TR', `cmd /c headroom proxy --port ${PORT} --target-ratio ${SAVINGS_PROFILE.HEADROOM_TARGET_RATIO} --budget ${SAVINGS_PROFILE.HEADROOM_BUDGET} --budget-period ${SAVINGS_PROFILE.HEADROOM_BUDGET_PERIOD} > "${logPath}" 2>&1`,
      '/SC', 'ONLOGON',
      '/RL', 'HIGHEST',
      '/F',
    ].map((a) => `"${a}"`).join(' ');
    try {
      execSync(cmd, { stdio: 'inherit' });
      console.log(paint('green', `✓ Task "${taskName}" creato (ONLOGON, headroom proxy :${PORT})`));
      console.log(paint('dim', `  log autostart: ${logPath}`));
      console.log(paint('dim', '  Al prossimo logon Windows il proxy partirà in automatico.'));
    } catch (err) {
      console.error(paint('red', `✗ schtasks fallito: ${err.message}`));
      console.error(paint('dim', '  Probabile mancanza privilegi admin. Riprova con:'));
      console.error(paint('dim', '    npm run agent:autostart:startup   (no admin, solo utente corrente)'));
      process.exit(1);
    }
  } else {
    try {
      execSync(`schtasks /Delete /TN ${taskName} /F`, { stdio: 'inherit' });
      console.log(paint('green', `✓ Task "${taskName}" rimosso`));
    } catch (err) {
      console.error(paint('red', `✗ rimozione fallita: ${err.message}`));
      process.exit(1);
    }
  }
}

async function cmdProxy() {
  if (await isProxyUp()) {
    console.log(paint('green', '✓ headroom proxy già attivo ') + paint('dim', `@ ${PROXY_URL}`));
    console.log(paint('cyan', '\n→ Dashboard headroom: ') + paint('bold', DASHBOARD_URL));
    return;
  }
  startProxy({ source: 'proxy' });
  await waitForProxy();
  console.log(paint('green', '\n✓ headroom proxy pronto ') + paint('dim', `@ ${PROXY_URL}`));
  console.log(paint('cyan', '\n→ Dashboard headroom: ') + paint('bold', DASHBOARD_URL));
  console.log(paint('dim', '  (apertura browser in dev...)'));
  openBrowserInDev();
  console.log(paint('dim', '  il proxy resterà attivo. Lancia opencode con:'));
  console.log(paint('dim', `    $env:OPENAI_BASE_URL="${PROXY_URL}"; opencode`));
}

async function cmdSetup() {
  console.log(paint('cyan', '→ Setup headroom automatico'));

  setPersistentProxyEnv();
  console.log(paint('green', `✓ env utente: OPENAI_BASE_URL=${PROXY_URL}`));
  console.log(paint('green', `✓ env utente: ANTHROPIC_BASE_URL=${PROXY_URL}`));

  if (os.platform() === 'win32') {
    const startup = installStartupAutostart();
    console.log(paint('green', `✓ autostart Windows: ${startup.batPath}`));
  }

  if (await isProxyUp()) {
    killProxy();
    for (let i = 0; i < 25 && (await isProxyUp()); i++) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  startProxy({ source: 'setup' });
  const ready = await waitForProxy();
  if (!ready) {
    throw new Error('headroom proxy non pronto dopo setup');
  }
  console.log(paint('green', `✓ proxy agent-90 attivo @ ${PROXY_URL}`));
  console.log(paint('cyan', `→ Dashboard: ${DASHBOARD_URL}`));
  openDashboardInBrowser();

  console.log('');
  console.log(paint('yellow', 'Nota: opencode già aperto va chiuso e riaperto.'));
  console.log(paint('dim', 'Motivo: Windows passa le env var solo ai nuovi processi.'));
}

const cmd = process.argv[2] || 'start';
const handlers = {
  start: cmdStart,
  status: cmdStatus,
  stop: cmdStop,
  proxy: cmdProxy,
  setup: cmdSetup,
  dashboard: cmdDashboard,
  'autostart:enable': () => cmdAutostart({ enable: true, mode: 'task' }),
  'autostart:disable': () => cmdAutostart({ enable: false, mode: 'task' }),
  'autostart:startup': () => cmdAutostart({ enable: true, mode: 'startup' }),
  'autostart:startup:disable': () => cmdAutostart({ enable: false, mode: 'startup' }),
};
const handler = handlers[cmd];
if (!handler) {
  console.error(paint('red', `comando sconosciuto: ${cmd}`));
  console.error(paint('dim', '  uso: node scripts/start-agent.mjs [start|setup|proxy|stop|status|dashboard|autostart:enable|autostart:disable|autostart:startup|autostart:startup:disable]'));
  process.exit(2);
}
handler().catch((err) => {
  console.error(paint('red', '✗ ' + (err?.message || String(err))));
  process.exit(1);
});
