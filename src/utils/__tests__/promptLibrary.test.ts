import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadPromptLibrary,
  addPromptEntry,
  removePromptEntry,
  savePromptLibrary,
  PROMPT_LIBRARY_KEYS,
} from '../promptLibrary';

const KEY = PROMPT_LIBRARY_KEYS.cardPhoto;

describe('promptLibrary', () => {
  beforeEach(() => {
    localStorage.removeItem(KEY);
  });

  it('starts empty', () => {
    expect(loadPromptLibrary(KEY)).toEqual([]);
  });

  it('adds and loads entries', () => {
    addPromptEntry(KEY, { label: 'Dogsitter', prompt: 'stylized dog', module: 'card-photo' });
    const items = loadPromptLibrary(KEY);
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Dogsitter');
    expect(items[0].prompt).toBe('stylized dog');
    expect(items[0].id).toBeTruthy();
  });

  it('removes by id', () => {
    const [a] = addPromptEntry(KEY, { label: 'A', prompt: 'a' });
    addPromptEntry(KEY, { label: 'B', prompt: 'b' });
    const after = removePromptEntry(KEY, a.id);
    expect(after.every((e) => e.id !== a.id)).toBe(true);
  });

  it('caps at 50 entries', () => {
    for (let i = 0; i < 55; i++) {
      addPromptEntry(KEY, { label: `L${i}`, prompt: `p${i}` });
    }
    expect(loadPromptLibrary(KEY).length).toBe(50);
  });

  it('survives save/load roundtrip', () => {
    savePromptLibrary(KEY, [{ id: 'x', label: 'X', createdAt: 1, prompt: 'hello' }]);
    expect(loadPromptLibrary(KEY)[0].prompt).toBe('hello');
  });
});
