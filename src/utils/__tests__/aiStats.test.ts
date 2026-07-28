import { describe, it, expect } from 'vitest';
import {
  EMPTY_AI_STATS,
  incrementAiStats,
  aiStatsTotalCalls,
  formatAiStatsCompact,
  mergeAiStats,
  withAiCall,
  AI_CALL_LABELS,
  type AiCallKind,
} from '../aiStats';

describe('aiStats', () => {
  it('EMPTY_AI_STATS has zero total and empty calls', () => {
    expect(EMPTY_AI_STATS.totalCostUsd).toBe(0);
    expect(Object.keys(EMPTY_AI_STATS.calls)).toHaveLength(0);
  });

  it('incrementAiStats adds a new kind and accumulates cost', () => {
    const s1 = incrementAiStats(EMPTY_AI_STATS, 'icon', 0.02);
    expect(s1.calls.icon).toEqual({ count: 1, costUsd: 0.02 });
    expect(s1.totalCostUsd).toBe(0.02);

    const s2 = incrementAiStats(s1, 'icon', 0.02);
    expect(s2.calls.icon).toEqual({ count: 2, costUsd: 0.04 });
    expect(s2.totalCostUsd).toBe(0.04);
  });

  it('incrementAiStats handles undefined input', () => {
    const s = incrementAiStats(undefined, 'cover', 0.04);
    expect(s.calls.cover).toEqual({ count: 1, costUsd: 0.04 });
    expect(s.totalCostUsd).toBe(0.04);
  });

  it('incrementAiStats accumulates across multiple kinds', () => {
    let s = EMPTY_AI_STATS;
    s = incrementAiStats(s, 'text', 0.001);
    s = incrementAiStats(s, 'icon', 0.02);
    s = incrementAiStats(s, 'icon', 0.02);
    s = incrementAiStats(s, 'cover', 0.04);
    expect(s.calls.text.count).toBe(1);
    expect(s.calls.icon.count).toBe(2);
    expect(s.calls.cover.count).toBe(1);
    expect(s.totalCostUsd).toBeCloseTo(0.081, 6);
  });

  it('incrementAiStats ignores negative cost', () => {
    const s = incrementAiStats(EMPTY_AI_STATS, 'icon', -1);
    expect(s.calls.icon.costUsd).toBe(0);
  });

  it('incrementAiStats rounds to 6 decimals', () => {
    const s = incrementAiStats(EMPTY_AI_STATS, 'text', 0.0000015);
    expect(s.calls.text.costUsd).toBe(0.000002);
  });

  it('incrementAiStats sets updatedAt', () => {
    const s = incrementAiStats(EMPTY_AI_STATS, 'icon', 0.02);
    expect(s.updatedAt).toBeTruthy();
    expect(() => new Date(s.updatedAt!).toISOString()).not.toThrow();
  });

  it('aiStatsTotalCalls sums all kind counts', () => {
    let s = EMPTY_AI_STATS;
    s = incrementAiStats(s, 'text', 0.001);
    s = incrementAiStats(s, 'icon', 0.02);
    s = incrementAiStats(s, 'icon', 0.02);
    expect(aiStatsTotalCalls(s)).toBe(3);
  });

  it('aiStatsTotalCalls handles undefined', () => {
    expect(aiStatsTotalCalls(undefined)).toBe(0);
  });

  it('formatAiStatsCompact returns empty string for empty stats', () => {
    expect(formatAiStatsCompact(undefined)).toBe('');
    expect(formatAiStatsCompact(EMPTY_AI_STATS)).toBe('');
  });

  it('formatAiStatsCompact shows counts and total cost', () => {
    let s = EMPTY_AI_STATS;
    s = incrementAiStats(s, 'icon', 0.02);
    s = incrementAiStats(s, 'icon', 0.02);
    s = incrementAiStats(s, 'cover', 0.04);
    const out = formatAiStatsCompact(s);
    expect(out).toContain('2 icone');
    expect(out).toContain('1 cover');
    expect(out).toContain('$0.08');
  });

  it('formatAiStatsCompact uses singular label for count=1', () => {
    const s = incrementAiStats(EMPTY_AI_STATS, 'icon', 0.02);
    expect(formatAiStatsCompact(s)).toContain('1 icona');
  });

  it('formatAiStatsCompact formats small cost with 4 decimals', () => {
    const s = incrementAiStats(EMPTY_AI_STATS, 'text', 0.001);
    expect(formatAiStatsCompact(s)).toContain('$0.001');
  });

  it('formatAiStatsCompact formats large cost with 2 decimals', () => {
    const s = incrementAiStats(EMPTY_AI_STATS, 'text', 1.5);
    expect(formatAiStatsCompact(s)).toContain('$1.50');
  });

  it('AI_CALL_LABELS covers all kinds', () => {
    const kinds: AiCallKind[] = [
      'text', 'cover', 'photo', 'icon', 'hero', 'background',
      'flyerCopy', 'logoConcept', 'socialCopy', 'quoteCopy', 'visionReview',
    ];
    for (const k of kinds) {
      expect(AI_CALL_LABELS[k]).toBeDefined();
      expect(AI_CALL_LABELS[k].singular.length).toBeGreaterThan(0);
      expect(AI_CALL_LABELS[k].plural.length).toBeGreaterThan(0);
    }
  });

  it('mergeAiStats merges two stats objects', () => {
    const a = incrementAiStats(EMPTY_AI_STATS, 'icon', 0.02);
    const b = incrementAiStats(EMPTY_AI_STATS, 'icon', 0.03);
    const merged = mergeAiStats(a, b);
    expect(merged.calls.icon).toEqual({ count: 2, costUsd: 0.05 });
    expect(merged.totalCostUsd).toBe(0.05);
  });

  it('mergeAiStats handles undefined args', () => {
    expect(mergeAiStats(undefined, undefined)).toEqual(EMPTY_AI_STATS);
    const a = incrementAiStats(EMPTY_AI_STATS, 'icon', 0.02);
    expect(mergeAiStats(a, undefined)).toBe(a);
    expect(mergeAiStats(undefined, a)).toBe(a);
  });

  it('withAiCall returns a new object with aiStats set', () => {
    const doc = { id: 'x', aiStats: undefined } as { id: string; aiStats?: typeof EMPTY_AI_STATS };
    const next = withAiCall(doc, 'icon', 0.02);
    expect(next.aiStats).toBeDefined();
    expect(next.aiStats!.calls.icon.count).toBe(1);
    expect(next.id).toBe('x');
    expect(doc.aiStats).toBeUndefined();
  });

  it('withAiCall preserves existing aiStats and increments', () => {
    const s = incrementAiStats(EMPTY_AI_STATS, 'icon', 0.02);
    const doc = { id: 'x', aiStats: s };
    const next = withAiCall(doc, 'icon', 0.02);
    expect(next.aiStats!.calls.icon.count).toBe(2);
    expect(next.aiStats!.calls.icon.costUsd).toBe(0.04);
  });
});