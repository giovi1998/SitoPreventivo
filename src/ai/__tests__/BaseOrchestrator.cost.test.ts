import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogoAIOrchestrator } from '../logoOrchestrator';
import dataService from '../../utils/dataService';

vi.mock('../../utils/dataService', () => ({
  default: {
    trackTokens: vi.fn(),
  },
}));

// Minimal concrete subclass for testing the protected trackUsage helper.
class TestOrchestrator extends LogoAIOrchestrator {
  testTrackUsage(
    usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined,
    userEmail?: string,
    providerId?: string,
  ): number {
    return this.trackUsage(usage, userEmail, providerId);
  }
}

const mockTrackTokens = dataService.trackTokens as unknown as ReturnType<typeof vi.fn>;

describe('BaseOrchestrator trackUsage cost tracking (spec TB-023 §6.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes the computed costUsd to dataService.trackTokens (deepseek-v4-flash)', () => {
    const o = new TestOrchestrator();
    const usage = { promptTokens: 600, completionTokens: 400, totalTokens: 1000 };
    const cost = o.testTrackUsage(usage, 'user@test.com', 'deepseek-v4-flash');
    expect(cost).toBe(0.000196);
    expect(mockTrackTokens).toHaveBeenCalledWith('user@test.com', 1000, 0.000196);
  });

  it('Ollama Pro flat: tracks tokens with costUsd 0', () => {
    const o = new TestOrchestrator();
    const usage = { promptTokens: 2000, completionTokens: 1000, totalTokens: 3000 };
    const cost = o.testTrackUsage(usage, 'user@test.com', 'ollama-minimax-m3');
    expect(cost).toBe(0);
    expect(mockTrackTokens).toHaveBeenCalledWith('user@test.com', 3000, 0);
  });

  it('without providerId the cost is 0 (legacy callers)', () => {
    const o = new TestOrchestrator();
    const cost = o.testTrackUsage({ promptTokens: 600, completionTokens: 400, totalTokens: 1000 }, 'user@test.com');
    expect(cost).toBe(0);
    expect(mockTrackTokens).toHaveBeenCalledWith('user@test.com', 1000, 0);
  });

  it('admin is never charged: trackTokens not called', () => {
    const o = new TestOrchestrator();
    const cost = o.testTrackUsage({ promptTokens: 600, completionTokens: 400, totalTokens: 1000 }, 'admin@gmail.com', 'deepseek-v4-flash');
    expect(cost).toBe(0);
    expect(mockTrackTokens).not.toHaveBeenCalled();
  });

  it('missing userEmail or usage: no tracking, cost 0', () => {
    const o = new TestOrchestrator();
    expect(o.testTrackUsage({ promptTokens: 1, completionTokens: 1, totalTokens: 2 }, undefined, 'deepseek-v4-flash')).toBe(0);
    expect(o.testTrackUsage(undefined, 'user@test.com', 'deepseek-v4-flash')).toBe(0);
    expect(mockTrackTokens).not.toHaveBeenCalled();
  });

  it('is silent when trackTokens throws and still returns the cost', () => {
    mockTrackTokens.mockImplementationOnce(() => {
      throw new Error('network down');
    });
    const o = new TestOrchestrator();
    const cost = o.testTrackUsage({ promptTokens: 600, completionTokens: 400, totalTokens: 1000 }, 'user@test.com', 'deepseek-v4-flash');
    expect(cost).toBe(0.000196);
  });
});
