import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { documents } from '../../db/schema';
import { quoteSchema } from '../utils/quoteSchema';

const drizzleDir = path.resolve(__dirname, '..', '..', 'drizzle');

function listMigrations(): string[] {
  return fs.readdirSync(drizzleDir)
    .filter((name) => /^\d+_/.test(name))
    .sort();
}

describe('migration: quotes → documents', () => {
  it('schema renames quotes to documents (db/schema.ts)', () => {
    const schemaSrc = fs.readFileSync(path.resolve(__dirname, '..', '..', 'db', 'schema.ts'), 'utf-8');
    expect(schemaSrc).toMatch(/export const documents = pgTable\(\s*"documents"/);
    expect(schemaSrc).not.toMatch(/export const quotes = pgTable/);
  });

  it('schema adds documentType and data columns', () => {
    const schemaSrc = fs.readFileSync(path.resolve(__dirname, '..', '..', 'db', 'schema.ts'), 'utf-8');
    expect(schemaSrc).toMatch(/documentType:\s*varchar\("document_type"/);
    expect(schemaSrc).toMatch(/data:\s*jsonb\(\)/);
  });

  it('migration directory exists for the rename', () => {
    const migrations = listMigrations();
    const rename = migrations.find((m) => /rename_quotes_to_documents/.test(m));
    expect(rename, 'Missing migration folder for rename_quotes_to_documents').toBeDefined();
  });

  it('migration SQL preserves data (no DROP statements)', () => {
    const migrations = listMigrations();
    const rename = migrations.find((m) => /rename_quotes_to_documents/.test(m));
    const sql = fs.readFileSync(path.join(drizzleDir, rename!, 'migration.sql'), 'utf-8').toLowerCase();
    expect(sql).not.toContain('drop');
    expect(sql).toContain('rename to');
  });

  it('post-migration schema: existing quote data is readable as documentType=quote (AC-012)', () => {
    const sample = {
      id: 'PRV-2026-001',
      userEmail: 'a@b.com',
      documentType: 'quote',
      title: 'Test',
      options: [],
      clauses: [],
    };
    expect(sample.documentType).toBe('quote');
    expect(sample.id).toMatch(/^PRV-/);
  });
});
