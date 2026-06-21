import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../system';

describe('buildSystemPrompt', () => {
  it('compact prompt contains all tool names', () => {
    const p = buildSystemPrompt(true);
    expect(p).toContain('apply_discount');
    expect(p).toContain('adjust_margin');
    expect(p).toContain('round_prices');
    expect(p).toContain('check_consistency');
  });
  it('compact prompt mentions response is JSON only', () => {
    const p = buildSystemPrompt(true);
    expect(p).toMatch(/JSON/);
    expect(p).toMatch(/Solo/);
  });
  it('full prompt contains all editable fields', () => {
    const p = buildSystemPrompt(false);
    expect(p).toContain('project.title');
    expect(p).toContain('paymentTerms');
    expect(p).toContain('uiPreferences');
  });
});
