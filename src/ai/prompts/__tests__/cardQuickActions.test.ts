import { describe, it, expect } from 'vitest';
import { CARD_QUICK_ACTIONS, findCardQuickAction } from '../cardQuickActions';

describe('cardQuickActions', () => {
  it('exposes decoration quick action chips (TB-023 REQ-PD-008)', () => {
    const modes = CARD_QUICK_ACTIONS.map((a) => a.mode);
    expect(modes).toContain('decorationWave');
    expect(modes).toContain('decorationBlob');
    expect(modes).toContain('decorationSplash');
    expect(modes).toContain('decorationFull');
    expect(modes).toContain('decorationClear');
  });

  it('decorationClear prompt asks to clear the pattern (null)', () => {
    const action = findCardQuickAction('decorationClear');
    expect(action).toBeDefined();
    expect(action!.prompt).toMatch(/decorations\.pattern\s*=\s*null|pattern.*null/i);
  });

  it('decorationWave prompt sets wave-bottom pattern', () => {
    const action = findCardQuickAction('decorationWave');
    expect(action).toBeDefined();
    expect(action!.prompt).toContain('wave-bottom');
  });

  it('findCardQuickAction returns undefined for unknown mode', () => {
    expect(findCardQuickAction('doesNotExist')).toBeUndefined();
  });
});