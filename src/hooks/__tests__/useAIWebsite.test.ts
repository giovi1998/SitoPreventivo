import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../utils/dataService', () => ({
  default: {
    trackTokens: vi.fn(),
    getUserProfile: vi.fn().mockResolvedValue({ tokensUsed: 0, tokenLimit: 1000000 }),
  },
}));

const orchestratorInstances = vi.hoisted(() => [] as { generateSite: ReturnType<typeof vi.fn>; refineSite: ReturnType<typeof vi.fn>; resetSession: ReturnType<typeof vi.fn> }[]);

vi.mock('../../ai/websiteOrchestrator', () => ({
  WebsiteOrchestrator: vi.fn().mockImplementation(function () {
    const instance = {
      generateSite: vi.fn(),
      refineSite: vi.fn(),
      resetSession: vi.fn(),
      getCurrentSessionId: vi.fn(() => 's1'),
      getProviderList: vi.fn(() => [{ id: 'mock', name: 'Mock', model: 'mock-model', supportsStreaming: true, supportsTools: false, supportsVision: false }]),
    };
    orchestratorInstances.push(instance);
    return instance;
  }),
}));

import { useAIWebsite } from '../useAIWebsite';

const brief = {
  businessName: 'Panetteria',
  sector: 'food',
  description: 'Panetteria artigianale con forno a legna nel centro storico',
  tone: 'caldo',
  target: 'famiglie',
  pages: 'index',
  preferredColors: '',
  font: '',
  cta: 'Ordina ora',
  sections: 'hero, contatti',
  features: '',
  contacts: '',
  socials: [],
  mapsUrl: '',
  notes: '',
};

function baseResult() {
  return {
    site: { html: '<h1>ok</h1>', css: 'body{}', js: '', pages: ['index'], pagesHtml: {} },
    response: { content: '{}', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
    sessionId: 's1',
    changes: ['html:generated:pages=1', 'css:5chars', 'js:0chars', 'verify:ok'],
    heroImages: [],
    aiCall: { kind: 'websiteCode', costUsd: 0.003 },
  };
}

describe('useAIWebsite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orchestratorInstances.length = 0;
    localStorage.clear();
  });

  it('stato iniziale: idle, nessuno step, nessun log', () => {
    const { result } = renderHook(() => useAIWebsite('user@test.com'));
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.currentStep).toBeNull();
    expect(result.current.logs).toEqual([]);
    expect(result.current.availableModels.length).toBeGreaterThan(0);
  });

  it('generate: onStep per i 4 step, currentStep resettato a fine, costo salvato', async () => {
    const { result } = renderHook(() => useAIWebsite('user@test.com'));
    const instance = orchestratorInstances[0];
    let capturedSteps: string[] = [];
    instance.generateSite.mockImplementation(async (_b, options) => {
      capturedSteps = [];
      for (const step of ['html', 'css', 'js', 'verify']) {
        options.onStep?.(step, `prompt ${step}`);
        capturedSteps.push(step);
      }
      await Promise.resolve();
      for (const step of ['html', 'css', 'js', 'verify']) options.onStepResult?.(step, '{}', { durationMs: 10, tokens: 5 });
      return baseResult();
    });
    await act(async () => {
      await result.current.generate(brief);
    });
    expect(capturedSteps).toEqual(['html', 'css', 'js', 'verify']);
    expect(result.current.currentStep).toBeNull();
    expect(result.current.lastCostUsd).toBe(0.003);
  });

  it('generate: logga step, costo e success; ritorna result', async () => {
    const { result } = renderHook(() => useAIWebsite('user@test.com'));
    orchestratorInstances[0].generateSite.mockResolvedValue(baseResult());
    let res: unknown;
    await act(async () => {
      res = await result.current.generate(brief);
    });
    expect(res).toMatchObject({ site: { pages: ['index'] } });
    expect(result.current.logs.some((l) => l.msg === 'Sito generato')).toBe(true);
    expect(result.current.logs.some((l) => l.msg === 'HTML generato')).toBe(true);
    expect(result.current.logs.some((l) => l.msg === 'Verifica completata')).toBe(true);
    expect(result.current.lastCostUsd).toBe(0.003);
  });

  it('generate: errore → mappa hint, isProcessing false', async () => {
    const { result } = renderHook(() => useAIWebsite('user@test.com'));
    orchestratorInstances[0].generateSite.mockRejectedValue(new Error('errore di rete'));
    await expect(act(async () => {
      await result.current.generate(brief);
    })).rejects.toThrow(/rete|Errore|errore/i);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.currentStep).toBeNull();
  });

  it('refine: step refine, log modifiche, costo', async () => {
    const { result } = renderHook(() => useAIWebsite('user@test.com'));
    const instance = orchestratorInstances[0];
    instance.refineSite.mockImplementation(async (_site, _instr, options) => {
      options.onStep?.('refine', 'prompt refine');
      options.onStepResult?.('refine', '{}', { durationMs: 10, tokens: 3 });
      return {
        site: { html: '<h1>ok</h1>', css: 'body{color:red}', js: '', pages: ['index'], pagesHtml: {} },
        changes: ['refine:css:changed:5->18chars'],
        response: { content: '{}', usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 } },
      };
    });
    await act(async () => {
      await result.current.refine({ html: '<h1>ok</h1>', css: 'body{}', js: '', pages: ['index'], pagesHtml: {} }, 'cambia colore');
    });
    expect(result.current.logs.some((l) => l.msg === 'Modifica CSS')).toBe(true);
    expect(result.current.logs.some((l) => l.msg === 'Sito raffinato')).toBe(true);
    expect(result.current.currentStep).toBeNull();
  });

  it('reset: azzera log, step e session', () => {
    const { result } = renderHook(() => useAIWebsite('user@test.com'));
    act(() => {
      result.current.reset();
    });
    expect(result.current.logs).toEqual([]);
    expect(result.current.currentStep).toBeNull();
    expect(orchestratorInstances[0].resetSession).toHaveBeenCalled();
  });
});
