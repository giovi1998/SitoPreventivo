import { describe, it, expect } from 'vitest';
import { LogoAIOrchestrator } from '../logoOrchestrator';
import { z } from 'zod';

// Minimal concrete subclass for testing protected helpers.
class TestOrchestrator extends LogoAIOrchestrator {
  testSanitize(raw: string): string {
    return this.sanitizeAIResponse(raw);
  }
  testParse(raw: string): { ok: true; data: unknown } | { ok: false; error: string } {
    return this.parseJsonResponse(raw);
  }
  testParseWithSchema<T>(raw: string, schema: z.ZodType<T>): { ok: true; data: T } | { ok: false; error: string } {
    return this.parseJsonResponse(raw, schema);
  }
}

describe('BaseOrchestrator JSON extraction v2.2', () => {
  it('extracts a JSON array from surrounding text', () => {
    const o = new TestOrchestrator();
    const raw = 'Ecco i concept:\n```json\n[{\n  "primaryText": "A",\n  "tagline": "B",\n  "iconType": "shape",\n  "primaryColor": "#01696F",\n  "secondaryColor": "#1a1a2e",\n  "layout": "horizontal"\n}]\n```\nSpero ti piacciano!';
    const clean = o.testSanitize(raw);
    expect(clean.trim().startsWith('[')).toBe(true);
    const parsed = o.testParse(clean);
    expect(parsed.ok).toBe(true);
  });

  it('extracts a JSON object from surrounding text', () => {
    const o = new TestOrchestrator();
    const raw = 'Certo, ecco il logo:\n{"a":1}\nFine.';
    const clean = o.testSanitize(raw);
    expect(clean).toBe('{"a":1}');
  });

  it('parses a balanced nested array with escaped quotes', () => {
    const o = new TestOrchestrator();
    const raw = '[{"x":"say \\"hi\\""},{"y":2}] extra';
    const clean = o.testSanitize(raw);
    const parsed = o.testParse(clean);
    expect(parsed.ok).toBe(true);
    expect(Array.isArray((parsed as any).data)).toBe(true);
    expect((parsed as any).data.length).toBe(2);
  });

  it('returns error for unparseable content', () => {
    const o = new TestOrchestrator();
    const parsed = o.testParse('not json here');
    expect(parsed.ok).toBe(false);
  });

  it('validates an array schema after extraction', () => {
    const o = new TestOrchestrator();
    const schema = z.array(z.object({ a: z.number() })).length(2);
    const raw = 'intro [{"a":1},{"a":2}] outro';
    const clean = o.testSanitize(raw);
    const parsed = o.testParseWithSchema(clean, schema);
    expect(parsed.ok).toBe(true);
  });
});
