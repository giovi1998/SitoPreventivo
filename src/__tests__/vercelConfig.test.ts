import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const vercelJsonPath = path.resolve(__dirname, '..', '..', 'vercel.json');

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

  it('has outputDirectory set to dist', () => {
    const cfg = loadVercelConfig();
    expect(cfg.outputDirectory).toBe('dist');
  });

  it('has the canonical monolith rewrite /api/(.*) -> /api', () => {
    const cfg = loadVercelConfig();
    expect(cfg.rewrites).toBeDefined();
    const apiRewrite = cfg.rewrites.find(
      (r: { source: string; destination: string }) =>
        r.source === '/api/(.*)' && r.destination === '/api'
    );
    expect(apiRewrite, 'Missing /api/(.*) -> /api rewrite (monolith routing)').toBeDefined();
  });

  it('has the SPA fallback rewrite /(.*) -> /index.html', () => {
    const cfg = loadVercelConfig();
    const spaRewrite = cfg.rewrites.find(
      (r: { source: string; destination: string }) =>
        r.source === '/(.*)' && r.destination === '/index.html'
    );
    expect(spaRewrite, 'Missing /(.*) -> /index.html SPA fallback').toBeDefined();
  });

  it('puts the /api rewrite BEFORE the /(.*) SPA fallback (order is critical)', () => {
    const cfg = loadVercelConfig();
    const apiIdx = cfg.rewrites.findIndex(
      (r: { source: string }) => r.source === '/api/(.*)'
    );
    const spaIdx = cfg.rewrites.findIndex(
      (r: { source: string }) => r.source === '/(.*)'
    );
    expect(apiIdx).toBeGreaterThanOrEqual(0);
    expect(spaIdx).toBeGreaterThanOrEqual(0);
    expect(apiIdx).toBeLessThan(spaIdx);
  });
});
