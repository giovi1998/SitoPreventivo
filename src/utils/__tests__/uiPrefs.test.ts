import { describe, it, expect, beforeEach } from 'vitest';
import {
  getUiPrefs,
  getSidebarCollapsed,
  setSidebarCollapsed,
  getAiConsoleExpanded,
  setAiConsoleExpanded,
} from '../uiPrefs';

const KEY = 'pq_ui:v1';

describe('uiPrefs (pq_ui:v1, REQ-DS-006 + REQ-AI-003)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('default: sidebar espansa, nessuna pref AI Console', () => {
    expect(getSidebarCollapsed()).toBe(false);
    expect(getAiConsoleExpanded('card')).toBeUndefined();
    expect(getUiPrefs().version).toBe(1);
  });

  it('sidebar collapsed persiste tra letture', () => {
    setSidebarCollapsed(true);
    expect(getSidebarCollapsed()).toBe(true);
    const raw = JSON.parse(localStorage.getItem(KEY)!);
    expect(raw.sidebarCollapsed).toBe(true);
    expect(raw.version).toBe(1);
  });

  it('aiConsoleExpanded per editor indipendenti', () => {
    setAiConsoleExpanded('card', false);
    setAiConsoleExpanded('logo', true);
    expect(getAiConsoleExpanded('card')).toBe(false);
    expect(getAiConsoleExpanded('logo')).toBe(true);
    expect(getAiConsoleExpanded('flyer')).toBeUndefined();
  });

  it('JSON corrotto → fallback ai default senza crash', () => {
    localStorage.setItem(KEY, '{invalid json');
    expect(getSidebarCollapsed()).toBe(false);
    expect(getAiConsoleExpanded('card')).toBeUndefined();
  });

  it('setItem che lancia (quota) → nessun crash', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => setSidebarCollapsed(true)).not.toThrow();
    spy.mockRestore();
  });
});
