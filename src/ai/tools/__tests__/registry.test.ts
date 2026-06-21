import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../registry';
import { TOOL_DEFINITIONS, getToolNames } from '../definitions';

describe('ToolRegistry', () => {
  it('initializes with definitions', () => {
    const r = new ToolRegistry();
    expect(r.getDefinitions().length).toBeGreaterThan(0);
  });
  it('registers and executes an executor', () => {
    const r = new ToolRegistry();
    r.register('apply_discount', () => ({ quote: { items: [] } as any, changes: 'ok' }));
    const result = r.execute('apply_discount', {}, { options: [] } as any);
    expect(result.changes).toBe('ok');
  });
  it('returns unknown tool message for missing executor', () => {
    const r = new ToolRegistry();
    const result = r.execute('non_existent', {}, {} as any);
    expect(result.changes).toContain('sconosciuto');
  });
});

describe('TOOL_DEFINITIONS', () => {
  it('contains expected tools', () => {
    const names = getToolNames();
    expect(names).toContain('apply_discount');
    expect(names).toContain('adjust_margin');
    expect(names).toContain('recalculate_totals');
  });
  it('all definitions have required structure', () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(def.type).toBe('function');
      expect(def.function.name).toBeTruthy();
      expect(def.function.description).toBeTruthy();
      expect(def.function.parameters).toBeDefined();
    }
  });

  it('does NOT expose validate_quote (executor is deliberately excluded, bug #1)', () => {
    const names = getToolNames();
    expect(names).not.toContain('validate_quote');
  });

  it('exposes split_quote and merge_options (new tools for Phase 8)', () => {
    const names = getToolNames();
    expect(names).toContain('split_quote');
    expect(names).toContain('merge_options');
  });
});
