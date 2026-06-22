import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const migrationDir = path.resolve(__dirname, '..', '..', 'drizzle', '20260622000000_rename_quotes_to_documents');
const migrationSqlPath = path.join(migrationDir, 'migration.sql');

describe('documents migration SQL (regression)', () => {
  it('migration.sql exists and is non-empty', () => {
    expect(fs.existsSync(migrationSqlPath)).toBe(true);
    const content = fs.readFileSync(migrationSqlPath, 'utf-8').trim();
    expect(content.length).toBeGreaterThan(0);
  });

  it('renames the quotes table to documents (non-destructive of data)', () => {
    const sql = fs.readFileSync(migrationSqlPath, 'utf-8');
    expect(sql).toMatch(/ALTER TABLE\s+"quotes"\s+RENAME TO\s+"documents"/);
  });

  it('adds document_type column with quote default', () => {
    const sql = fs.readFileSync(migrationSqlPath, 'utf-8');
    expect(sql).toMatch(/ALTER TABLE\s+"documents"\s+ADD COLUMN\s+"document_type"\s+varchar\(30\)\s+NOT NULL\s+DEFAULT\s+'quote'/);
  });

  it('adds data jsonb column nullable', () => {
    const sql = fs.readFileSync(migrationSqlPath, 'utf-8');
    expect(sql).toMatch(/ALTER TABLE\s+"documents"\s+ADD COLUMN\s+"data"\s+jsonb/);
  });

  it('does NOT drop the table or columns (preserves data)', () => {
    const sql = fs.readFileSync(migrationSqlPath, 'utf-8').toLowerCase();
    expect(sql).not.toContain('drop');
  });

  it('uses statement-breakpoint separators (drizzle-kit convention)', () => {
    const sql = fs.readFileSync(migrationSqlPath, 'utf-8');
    expect(sql).toContain('--> statement-breakpoint');
  });
});
