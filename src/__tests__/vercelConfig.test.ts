import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const vercelJsonPath = path.resolve(__dirname, '..', '..', 'vercel.json');
const serverTsPath = path.resolve(__dirname, '..', '..', 'server.ts');

function loadVercelConfig() {
  return JSON.parse(fs.readFileSync(vercelJsonPath, 'utf-8'));
}

describe('vercel.json structure (regression)', () => {
  it('vercel.json exists and is valid JSON', () => {
    expect(fs.existsSync(vercelJsonPath)).toBe(true);
    expect(() => loadVercelConfig()).not.toThrow();
  });

  it('has buildCommand running db:migrate + build', () => {
    const cfg = loadVercelConfig();
    expect(cfg.buildCommand).toContain('db:migrate');
    expect(cfg.buildCommand).toContain('build');
  });

  it('has NO outputDirectory (server.ts serves dist/ at runtime)', () => {
    const cfg = loadVercelConfig();
    expect(cfg.outputDirectory, 'outputDirectory must be removed: server.ts serves dist/ at runtime').toBeUndefined();
  });

  it('has NO rewrites (server entrypoint handles /api/* + SPA fallback)', () => {
    const cfg = loadVercelConfig();
    expect(cfg.rewrites, 'rewrites must be removed: server.ts routes everything').toBeUndefined();
  });

  it('has the server entrypoint at root (server.ts)', () => {
    expect(fs.existsSync(serverTsPath), 'server.ts missing — Vercel needs it as the single function').toBe(true);
    const src = fs.readFileSync(serverTsPath, 'utf-8');
    expect(src).toContain('server.listen(');
  });

  it('server.ts delegates to src/server/handler.ts (no api/ monolith)', () => {
    const src = fs.readFileSync(serverTsPath, 'utf-8');
    expect(src).toContain('src/server/handler');
    expect(fs.existsSync(path.resolve(__dirname, '..', '..', 'api', 'index.ts'))).toBe(false);
  });
});
