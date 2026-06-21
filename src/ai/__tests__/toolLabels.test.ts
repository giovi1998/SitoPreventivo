import { describe, it, expect } from 'vitest';
import { formatToolCall, formatToolResult, TOOL_LABELS } from '../toolLabels';

describe('TOOL_LABELS', () => {
  it('has Italian labels for all known tools', () => {
    expect(TOOL_LABELS.apply_discount).toBe('Applica sconto');
    expect(TOOL_LABELS.adjust_margin).toBe('Ricalcola margine');
    expect(TOOL_LABELS.round_prices).toBe('Arrotonda prezzi');
    expect(TOOL_LABELS.check_consistency).toBe('Verifica coerenza');
  });
});

describe('formatToolCall', () => {
  it('formats percentage discount on all options', () => {
    expect(formatToolCall('apply_discount', { type: 'percentage', value: 10, scope: 'all' })).toBe('Sconto 10% su tutte le opzioni');
  });
  it('formats absolute discount', () => {
    expect(formatToolCall('apply_discount', { type: 'absolute', value: 100, scope: 'all' })).toBe('Sconto 100€ su tutte le opzioni');
  });
  it('formats margin', () => {
    expect(formatToolCall('adjust_margin', { targetMarginPercent: 30 })).toBe('Ricalcolo margine target 30%');
  });
  it('formats reorder by price asc', () => {
    expect(formatToolCall('reorder_options', { sortBy: 'price_asc' })).toContain('prezzo crescente');
  });
  it('formats round prices', () => {
    expect(formatToolCall('round_prices', { nearest: 5 })).toBe('Arrotondamento prezzi a 5€');
  });
  it('formats duplicate option', () => {
    expect(formatToolCall('duplicate_option', { optionId: 'opt-1' })).toContain('opt-1');
  });
  it('returns name for unknown tool', () => {
    expect(formatToolCall('unknown_tool', {})).toBe('unknown_tool');
  });
});

describe('formatToolResult', () => {
  it('returns OK for empty result', () => {
    expect(formatToolResult(undefined, 'apply_discount')).toBe('OK');
  });
  it('returns OK for plain OK', () => {
    expect(formatToolResult('OK', 'recalculate_totals')).toBe('OK');
  });
  it('passes through meaningful result', () => {
    expect(formatToolResult('3 opzioni modificate', 'apply_discount')).toBe('3 opzioni modificate');
  });
});
