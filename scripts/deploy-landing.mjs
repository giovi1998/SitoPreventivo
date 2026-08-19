#!/usr/bin/env node
/**
 * TB-012: deploy Netlify della landing bozza (1 comando).
 * Uso: npm run deploy:landing -- <cartella-zip-estratta>
 * Esempio: npm run deploy:landing -- "C:\Users\Giovanni\Downloads\sito-Panetteria Rossi"
 * Deploy preview (draft) di default; --prod per produzione.
 */
import { existsSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const prod = args.includes('--prod');
const dirArg = args.find((a) => !a.startsWith('--'));

if (!dirArg) {
  console.error('Uso: npm run deploy:landing -- <cartella-zip-estratta> [--prod]');
  process.exit(1);
}

const src = resolve(dirArg);
if (!existsSync(src)) {
  console.error(`Cartella non trovata: ${src}`);
  process.exit(1);
}

const out = join(process.cwd(), 'dist', 'landing');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(src, out, { recursive: true });

const args2 = ['netlify', 'deploy', '--dir', out, ...(prod ? ['--prod'] : [])];
const res = spawnSync('npx', args2, { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(res.status ?? 1);
