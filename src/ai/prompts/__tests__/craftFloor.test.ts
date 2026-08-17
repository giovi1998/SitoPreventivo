import { describe, it, expect } from 'vitest';
import { buildCardSystemPrompt } from '../cardSystem';
import { buildWebsiteSystemPrompt } from '../websiteSystem';
import { buildLogoSystemPrompt } from '../logoSystem';
import { buildFlyerSystemPrompt } from '../flyerSystem';

describe('System prompts — impeccable craft floor + named rules (2026-08-17)', () => {
  it('card system includes craft floor + named rules', () => {
    const p = buildCardSystemPrompt();
    expect(p).toMatch(/CRAFT FLOOR/i);
    expect(p).toMatch(/NAMED RULES/i);
    expect(p).toMatch(/The Print Floor Rule/i);
    expect(p).toMatch(/The Cover Quiet Zone Rule/i);
  });

  it('website system includes craft floor', () => {
    const p = buildWebsiteSystemPrompt();
    expect(p).toMatch(/CRAFT FLOOR/i);
    expect(p).toMatch(/4\.5:1/); // contrasto WCAG
    expect(p).toMatch(/Spacing rhythm/);
  });

  it('logo system includes craft floor + named rules', () => {
    const p = buildLogoSystemPrompt();
    expect(p).toMatch(/CRAFT FLOOR/i);
    expect(p).toMatch(/The Wordmark is the Signal Rule/i);
    expect(p).toMatch(/The One Decoration Rule/i);
  });

  it('flyer system includes craft floor + named rules', () => {
    const p = buildFlyerSystemPrompt();
    expect(p).toMatch(/CRAFT FLOOR/i);
    expect(p).toMatch(/The One Message Rule/i);
    expect(p).toMatch(/The Concrete CTA Rule/i);
  });
});
