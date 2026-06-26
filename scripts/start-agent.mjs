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
import { existsSync, openSync, appendFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const LOG_FILE = path.join(PROJECT_ROOT, '.headroom.log');

const PORT = 8787;
const PROXY_URL = `http://127.0.0.1:${PORT}`;
const READY_TIMEOUT_MS = 30_000;

const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};
const paint = (color, s) => `${c[color]}${s}${c.reset}`;

function isProxyUp() {
  return new Promise((resolve) => {
    const req = http.get(
      `${PROXY_URL}/livez`,
      { timeout: 3000 },
      (res) => {
        res.resume();
        // /livez ritorna 200 quando il processo è vivo e il server è in ascolto
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

function findProxyPids() {
  try {
    if (os.platform() === 'win32') {
      const out = execSync(
        'wmic process where "name=\'headroom.exe\'" get ProcessId /format:list',
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

function killProxy() {
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

function startProxy() {
  console.log(paint('cyan', '→ Avvio headroom proxy su :' + PORT));
  console.log(paint('dim', `  log: ${LOG_FILE}`));
  // Resetta il log ad ogni start pulito
  appendFileSync(LOG_FILE, `\n--- [start-agent] start ${new Date().toISOString()} ---\n`);

  try {
    if (os.platform() === 'win32') {
      // `start /B` dentro cmd.exe è l'unico modo affidabile su Windows per
      // staccare headroom dal parent. execSync ritorna appena `start /B`
      // ritorna (subito), headroom resta in background. Redirection va passata
      // dentro la stringa cmd (NON come args separati a spawn, altrimenti
      // `>` diventa un argomento letterale di headroom).
      execSync(
        `cmd /c "start /B headroom proxy --port ${PORT} > "${LOG_FILE}" 2>&1"`,
        { stdio: 'ignore' }
      );
    } else {
      // POSIX: detached + stdio su file (= nohup)
      const out = openSync(LOG_FILE, 'a');
      const errFd = openSync(LOG_FILE, 'a');
      const child = spawn('headroom', ['proxy', '--port', String(PORT)], {
        detached: true,
        stdio: ['ignore', out, errFd],
      });
      child.unref();
    }
  } catch (err) {
    appendFileSync(LOG_FILE, `\n[start-agent] spawn error: ${err?.message || err}\n`);
    console.error(paint('red', `✗ Impossibile avviare headroom: ${err.message}`));
    console.error(paint('dim', '  installalo con: pip install "headroom-ai[all]"'));
    process.exit(1);
  }
}

async function waitForProxy() {
  const start = Date.now();
  let lastLog = 0;
  while (Date.now() - start < READY_TIMEOUT_MS) {
    if (await isProxyUp()) return;
    const elapsed = Date.now() - start;
    if (elapsed - lastLog > 3000) {
      lastLog = elapsed;
      process.stdout.write(paint('dim', `  ...attendo proxy (${Math.floor(elapsed / 1000)}s)\r`));
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  process.stdout.write('\n');
  throw new Error(`headroom proxy non risponde su :${PORT} entro ${READY_TIMEOUT_MS / 1000}s. Vedi log: ${LOG_FILE}`);
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
    env: { ...process.env, OPENAI_BASE_URL: PROXY_URL },
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
    startProxy();
    await waitForProxy();
    console.log(paint('green', '\n✓ headroom proxy pronto ') + paint('dim', `@ ${PROXY_URL}`));
  }
  const { code } = await launchOpencode();
  console.log('');
  console.log(paint('dim', `opencode uscito (code ${code}). headroom proxy resta attivo.`));
  console.log(paint('dim', `Per terminarlo: ${paint('reset', 'npm run agent:stop')}`));
  process.exit(code);
}

async function cmdStatus() {
  if (await isProxyUp()) {
    const pids = findProxyPids();
    console.log(paint('green', '● headroom proxy attivo') + paint('dim', ` @ ${PROXY_URL}  (pid: ${pids.join(', ') || 'n/a'})`));
    process.exit(0);
  } else {
    console.log(paint('yellow', '○ headroom proxy NON attivo') + paint('dim', ` (porta ${PORT} libera)`));
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

async function cmdProxy() {
  if (await isProxyUp()) {
    console.log(paint('green', '✓ headroom proxy già attivo ') + paint('dim', `@ ${PROXY_URL}`));
    return;
  }
  startProxy();
  await waitForProxy();
  console.log(paint('green', '\n✓ headroom proxy pronto ') + paint('dim', `@ ${PROXY_URL}`));
  console.log(paint('dim', '  il proxy resterà attivo. Lancia opencode con:'));
  console.log(paint('dim', `    $env:OPENAI_BASE_URL="${PROXY_URL}"; opencode`));
}

const cmd = process.argv[2] || 'start';
const handlers = { start: cmdStart, status: cmdStatus, stop: cmdStop, proxy: cmdProxy };
const handler = handlers[cmd];
if (!handler) {
  console.error(paint('red', `comando sconosciuto: ${cmd}`));
  console.error(paint('dim', '  uso: node scripts/start-agent.mjs [start|proxy|stop|status]'));
  process.exit(2);
}
handler().catch((err) => {
  console.error(paint('red', '✗ ' + (err?.message || String(err))));
  process.exit(1);
});
