import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureTokenBudget } from '../tokenBudget';

vi.mock('../../dataService', () => ({
  default: {
    getUserProfile: vi.fn().mockResolvedValue({ tokensUsed: 100, tokenLimit: 1000 }),
  },
}));

vi.mock('../../env', () => ({
  isLocalhost: vi.fn(() => false),
}));

import dataService from '../../dataService';

describe('ensureTokenBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('admin → nessuna chiamata', async () => {
    await expect(ensureTokenBudget('admin@gmail.com')).resolves.toBeUndefined();
    expect(dataService.getUserProfile).not.toHaveBeenCalled();
  });

  it('utente sotto limite → passa', async () => {
    await expect(ensureTokenBudget('u@t.com')).resolves.toBeUndefined();
  });

  it('utente a limite → throw', async () => {
    (dataService.getUserProfile as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      tokensUsed: 1000,
      tokenLimit: 1000,
    });
    await expect(ensureTokenBudget('u@t.com')).rejects.toThrow(/Limite token/);
  });
});
