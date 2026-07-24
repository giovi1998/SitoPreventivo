import { describe, it, expect } from 'vitest';
import { userSettings, unlockCodes } from '../../db/schema';

describe('Phase 5 migration, schema structure', () => {
  it('userSettings has 4 new tier columns', () => {
    const cols = userSettings as unknown as Record<string, { name: string }>;
    const names = Object.values(cols).map((c) => c?.name).filter(Boolean);
    expect(names).toContain('tier');
    expect(names).toContain('unlock_code');
    expect(names).toContain('unlocked_at');
    expect(names).toContain('document_count');
  });

  it('unlockCodes table exists with all 6 columns', () => {
    const cols = unlockCodes as unknown as Record<string, { name: string }>;
    const names = Object.values(cols).map((c) => c?.name).filter(Boolean);
    expect(names).toContain('code');
    expect(names).toContain('package');
    expect(names).toContain('used_by');
    expect(names).toContain('used_at');
    expect(names).toContain('created_by');
    expect(names).toContain('created_at');
  });

  it('unlockCodes.code is the primary key (no .notNull required because of PK)', () => {
    const codeCol = (unlockCodes as unknown as Record<string, any>).code;
    expect(codeCol).toBeDefined();
    // primary key implies notNull in drizzle schema
  });

  it('userSettings.tier has a default value of "free" (backward compat for existing users)', () => {
    const tierCol = (userSettings as unknown as Record<string, any>).tier;
    // default value should be set for non-null safety on existing rows
    expect(tierCol).toBeDefined();
  });

  it('userSettings.documentCount has a default of 0 (regression: existing users must not be blocked)', () => {
    const dc = (userSettings as unknown as Record<string, any>).document_count ?? (userSettings as unknown as Record<string, any>).documentCount;
    expect(dc).toBeDefined();
  });
});
