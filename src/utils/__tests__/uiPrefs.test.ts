import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getUiPrefs,
  getSidebarCollapsed,
  setSidebarCollapsed,
  getAiConsoleExpanded,
  setAiConsoleExpanded,
  getAiReasoningEffort,
  setAiReasoningEffort,
  getAiProviderDefault,
  setAiProviderDefault,
  getValidatedProviderDefault,
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

  it('aiReasoningEffort default è max', () => {
    expect(getAiReasoningEffort()).toBe('max');
  });

  it('aiReasoningEffort persiste e ritorna il valore salvato', () => {
    setAiReasoningEffort('low');
    expect(getAiReasoningEffort()).toBe('low');
    const raw = JSON.parse(localStorage.getItem(KEY)!);
    expect(raw.aiReasoningEffort).toBe('low');
  });

  it('aiReasoningEffort valido resta, invalido non crasha', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, aiReasoningEffort: 'medium' }));
    expect(getAiReasoningEffort()).toBe('medium');
  });

  it('getValidatedProviderDefault: pref valida → ritorna la pref', () => {
    setAiProviderDefault('ollama-minimax-m3');
    const registry = { listProviders: () => [{ id: 'ollama-minimax-m3' }, { id: 'deepseek-v4-flash' }], getDefaultId: () => 'ollama-minimax-m3' };
    expect(getValidatedProviderDefault(registry)).toBe('ollama-minimax-m3');
  });

  it('getValidatedProviderDefault: pref stale → default registry + pref ripulita', () => {
    setAiProviderDefault('provider-rimosso');
    const registry = { listProviders: () => [{ id: 'ollama-minimax-m3' }], getDefaultId: () => 'ollama-minimax-m3' };
    expect(getValidatedProviderDefault(registry)).toBe('ollama-minimax-m3');
    expect(getAiProviderDefault()).toBe('ollama-minimax-m3');
  });

  it('getValidatedProviderDefault: nessuna pref → default registry senza scrittura', () => {
    const registry = { listProviders: () => [{ id: 'ollama-minimax-m3' }], getDefaultId: () => 'ollama-minimax-m3' };
    expect(getValidatedProviderDefault(registry)).toBe('ollama-minimax-m3');
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
