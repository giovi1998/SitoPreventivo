import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../utils/dataService', () => ({
  default: {
    saveDocument: mocks.saveDocument,
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('../../ai/providerPricing', () => ({
  calculateCostUsd: vi.fn(() => 0.001),
}));

vi.mock('../../utils/resolveProviderId', () => ({
  resolveProviderId: vi.fn(() => 'ollama-minimax-m3'),
  providerSupportsVision: mocks.providerSupportsVision,
}));

vi.mock('../../utils/uiPrefs', () => ({
  getAiImageModelDefault: vi.fn(() => 'gemini-3.1-flash-image'),
  getAiVisionEnabled: mocks.getAiVisionEnabled,
}));

vi.mock('../../utils/logoGenerator', () => ({
  builderToSvg: vi.fn(() => '<svg viewBox="0 0 1024 340"><text>Bar</text></svg>'),
  svgToPng: mocks.svgToPng,
}));

vi.mock('../../utils/card/photoBrief', () => ({
  buildCardPhotoBrief: vi.fn(() => ({ prompt: 'icona bar', context: 'contesto' })),
}));

vi.mock('../../utils/card/imageCompress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/card/imageCompress')>();
  return { ...actual, compressDataUrl: mocks.compressDataUrl };
});

const mocks = vi.hoisted(() => ({
  generateLogo: vi.fn(),
  processPrompt: vi.fn(),
  generateCopy: vi.fn(),
  generateSite: vi.fn(),
  providerSupportsVision: vi.fn(() => false),
  getAiVisionEnabled: vi.fn(() => false),
  svgToPng: vi.fn(),
  compressDataUrl: vi.fn(async (v: string) => v),
  saveDocument: vi.fn(),
  agentRun: vi.fn(),
  buildAgentBrief: vi.fn(() => ({ businessName: 'Bar' })),
  agentResultData: vi.fn(() => ({ builder: {} })),
  docTypeOfTool: vi.fn((name: unknown) => (name === 'generate_logo' ? 'logo' : 'businessCard')),
}));

vi.mock('../../ai/agentOrchestrator', () => ({
  AgentOrchestrator: vi.fn().mockImplementation(function () {
    return { run: mocks.agentRun };
  }),
}));

vi.mock('../../ai/agentSave', () => ({
  buildAgentBrief: mocks.buildAgentBrief,
  agentResultData: mocks.agentResultData,
  docTypeOfTool: mocks.docTypeOfTool,
}));

vi.mock('../../ai/logoOrchestrator', () => ({
  LogoAIOrchestrator: vi.fn().mockImplementation(function () {
    return { generateLogo: mocks.generateLogo };
  }),
}));

vi.mock('../../ai/cardOrchestrator', () => ({
  CardAIOrchestrator: vi.fn().mockImplementation(function () {
    return { processPrompt: mocks.processPrompt };
  }),
}));

vi.mock('../../ai/flyerOrchestrator', () => ({
  FlyerAIOrchestrator: vi.fn().mockImplementation(function () {
    return { generateCopy: mocks.generateCopy };
  }),
}));

vi.mock('../../ai/websiteOrchestrator', () => ({
  WebsiteOrchestrator: vi.fn().mockImplementation(function () {
    return { generateSite: mocks.generateSite };
  }),
}));

import { useAutoBuildGenerate, type AutoBuildDoc, type AutoBuildCustomer, type AutoBuildGenerateSummary } from '../useAutoBuildGenerate';
import dataService from '../../utils/dataService';

const mockSave = dataService.saveDocument as unknown as ReturnType<typeof vi.fn>;
const mockFetch = vi.fn();
(globalThis as Record<string, unknown>).fetch = mockFetch;

const usage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 };

const logoBuilder = { primaryText: 'Bar Da Mario', layout: 'horizontal', primaryColor: '#01696F' };

const customer: AutoBuildCustomer = {
  businessName: 'Bar Da Mario',
  detectedLogoUrl: null,
  aiSuggestedFields: { mood: 'giovane e dinamico' },
};

const makeDocs = (): AutoBuildDoc[] => [
  { id: 'flyer_1', documentType: 'flyer', title: 'Flyer', data: { briefContext: 'bar', content: {}, autoGeneratePending: true } },
  { id: 'card_1', documentType: 'businessCard', title: 'Card', data: { briefContext: 'bar', front: { name: 'Mario', photoUrl: null }, autoGeneratePending: true } },
  { id: 'logo_1', documentType: 'logo', title: 'Logo', data: { briefContext: 'bar', builder: {}, autoGeneratePending: true } },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.providerSupportsVision.mockReturnValue(false);
  mocks.getAiVisionEnabled.mockReturnValue(false);
  mocks.svgToPng.mockResolvedValue(new Uint8Array([65, 66, 67]));
  mocks.compressDataUrl.mockImplementation(async (v: string) => v);
  mockSave.mockResolvedValue({ success: true });
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ data: { imageBase64: 'QUJD', mimeType: 'image/png' } }),
  });
  mocks.generateLogo.mockResolvedValue({
    applied: true,
    concepts: [logoBuilder, { ...logoBuilder }, { ...logoBuilder }],
    selected: -1,
    response: { content: '{}', usage },
    changes: ['logo:generated:concepts=3'],
  });
  mocks.processPrompt.mockResolvedValue({
    card: { front: { name: 'Mario AI' }, back: {}, style: {} },
    response: { content: '{}', usage },
    changes: ['Fronte: nome'],
    costUsd: 0.002,
  });
  mocks.generateCopy.mockResolvedValue({
    flyer: { content: { headline: 'H', subheadline: 'S', body: 'B', cta: { label: 'C' } } },
    response: { content: '{}', usage },
    applied: true,
    changes: ['copy:generated'],
  });
  mocks.generateSite.mockResolvedValue({
    site: { html: '<h1>x</h1>', css: 'body{}', js: '//', pages: ['index'], pagesHtml: {} },
    response: { content: '{}', usage },
    changes: ['html:generated'],
    aiCall: { costUsd: 0 },
  });
});

describe('useAutoBuildGenerate', () => {
  it('stato iniziale: non running, nessuno status', () => {
    const { result } = renderHook(() => useAutoBuildGenerate());
    expect(result.current.state.running).toBe(false);
    expect(result.current.state.statuses).toEqual({});
    expect(result.current.state.currentStep).toBeNull();
  });

  it('generateAll esegue logo → card → flyer in ordine', async () => {
    const { result } = renderHook(() => useAutoBuildGenerate());
    await act(async () => {
      await result.current.generateAll(makeDocs(), customer);
    });
    expect(mocks.generateLogo).toHaveBeenCalledTimes(1);
    expect(mocks.processPrompt).toHaveBeenCalledTimes(1);
    expect(mocks.generateCopy).toHaveBeenCalledTimes(1);
    expect(mocks.generateLogo.mock.invocationCallOrder[0]).toBeLessThan(mocks.processPrompt.mock.invocationCallOrder[0]);
    expect(mocks.processPrompt.mock.invocationCallOrder[0]).toBeLessThan(mocks.generateCopy.mock.invocationCallOrder[0]);
    expect(result.current.state.statuses).toEqual({ logo_1: 'done', card_1: 'done', flyer_1: 'done' });
    expect(result.current.state.running).toBe(false);
  });

  it('logo generato applicato a front.logoUrl come data URL SVG', async () => {
    const { result } = renderHook(() => useAutoBuildGenerate());
    await act(async () => {
      await result.current.generateAll(makeDocs(), customer);
    });
    const cardSave = mockSave.mock.calls.find((c) => c[1].id === 'card_1')!;
    expect(cardSave).toBeTruthy();
    const logoUrl = cardSave[1].data.front.logoUrl as string;
    expect(logoUrl.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    expect(decodeURIComponent(logoUrl)).toContain('<svg');
  });

  it('usa customer.detectedLogoUrl se il logo non è stato generato', async () => {
    const docs = makeDocs().filter((d) => d.documentType !== 'logo');
    const cust = { ...customer, detectedLogoUrl: 'https://example.com/logo.png' };
    const { result } = renderHook(() => useAutoBuildGenerate());
    await act(async () => {
      await result.current.generateAll(docs, cust);
    });
    const cardSave = mockSave.mock.calls.find((c) => c[1].id === 'card_1')!;
    expect(cardSave[1].data.front.logoUrl).toBe('https://example.com/logo.png');
  });

  it('genera icona AI in photoUrl se photoUrl vuoto dopo merge (CON-IS-001)', async () => {
    const { result } = renderHook(() => useAutoBuildGenerate());
    await act(async () => {
      await result.current.generateAll(makeDocs(), customer);
    });
    expect(mockFetch).toHaveBeenCalledWith('/api/ai/card-photo', expect.objectContaining({ method: 'POST' }));
    const cardSave = mockSave.mock.calls.find((c) => c[1].id === 'card_1')!;
    expect(cardSave[1].data.front.photoUrl).toBe('data:image/png;base64,QUJD');
  });

  it('card AI senza style → icona generata col card merged, non crasha (regression auto-build prod)', async () => {
    mocks.processPrompt.mockResolvedValue({
      card: { front: { name: 'Mario AI' }, back: {} },
      response: { content: '{}', usage },
      changes: ['Fronte: nome'],
      costUsd: 0.002,
    });
    const { result } = renderHook(() => useAutoBuildGenerate());
    await act(async () => {
      await result.current.generateAll(makeDocs(), customer);
    });
    expect(mockFetch).toHaveBeenCalledWith('/api/ai/card-photo', expect.objectContaining({ method: 'POST' }));
    const cardSave = mockSave.mock.calls.find((c) => c[1].id === 'card_1')!;
    expect(cardSave[1].data.front.photoUrl).toBe('data:image/png;base64,QUJD');
  });

  it('errore flyer → card già salvata, logo done, flyer error, nessun throw', async () => {
    mocks.generateCopy.mockRejectedValue(new Error('AI down'));
    const { result } = renderHook(() => useAutoBuildGenerate());
    await act(async () => {
      await result.current.generateAll(makeDocs(), customer);
    });
    expect(result.current.state.statuses.logo_1).toBe('done');
    expect(result.current.state.statuses.card_1).toBe('done');
    expect(result.current.state.statuses.flyer_1).toBe('error');
    expect(mockSave.mock.calls.some((c) => c[1].id === 'card_1')).toBe(true);
    expect(mockSave.mock.calls.some((c) => c[1].id === 'flyer_1')).toBe(false);
  });

  it('errore registrato in state.errors e nel summary ritornato da generateAll', async () => {
    mocks.generateCopy.mockRejectedValue(new Error('AI down'));
    const { result } = renderHook(() => useAutoBuildGenerate());
    let summary: AutoBuildGenerateSummary | undefined;
    await act(async () => {
      summary = await result.current.generateAll(makeDocs(), customer);
    });
    expect(result.current.state.errors.flyer_1).toBe('AI down');
    expect(summary?.statuses).toEqual({ logo_1: 'done', card_1: 'done', flyer_1: 'error' });
    expect(summary?.errors).toEqual({ flyer_1: 'AI down' });
  });

  it('generateOne: errore in state.errors, cancellato al retry riuscito', async () => {
    const doc: AutoBuildDoc = { id: 'logo_1', documentType: 'logo', title: 'Logo', data: { briefContext: 'bar', builder: {} } };
    const { result } = renderHook(() => useAutoBuildGenerate());
    mocks.generateLogo.mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      await result.current.generateOne(doc, customer);
    });
    expect(result.current.state.statuses.logo_1).toBe('error');
    expect(result.current.state.errors.logo_1).toBe('boom');
    await act(async () => {
      await result.current.generateOne(doc, customer);
    });
    expect(result.current.state.statuses.logo_1).toBe('done');
    expect(result.current.state.errors.logo_1).toBeUndefined();
  });

  it('generateOne: ritorna il messaggio errore (log non bugiardo), null se ok', async () => {
    const doc: AutoBuildDoc = { id: 'logo_1', documentType: 'logo', title: 'Logo', data: { briefContext: 'bar', builder: {} } };
    const { result } = renderHook(() => useAutoBuildGenerate());
    mocks.generateLogo.mockRejectedValueOnce(new Error('quota piena'));
    let err: string | null = 'sentinel';
    await act(async () => {
      err = await result.current.generateOne(doc, customer);
    });
    expect(err).toBe('quota piena');
    mocks.generateLogo.mockResolvedValueOnce({
      applied: true,
      concepts: [logoBuilder, { ...logoBuilder }, { ...logoBuilder }],
      selected: -1,
      response: { content: '{}', usage },
      changes: ['logo:generated:concepts=3'],
    });
    await act(async () => {
      err = await result.current.generateOne(doc, customer);
    });
    expect(err).toBeNull();
  });

  it('T12: generateSite riceve SOLO logoBase64, mai la card/flyer (vision rule)', async () => {
    const { result } = renderHook(() => useAutoBuildGenerate());
    const docs: AutoBuildDoc[] = [
      { id: 'card_1', documentType: 'businessCard', title: 'Card', data: { briefContext: 'bar', front: { name: 'Mario', photoUrl: 'data:image/png;base64,CARD' }, autoGeneratePending: true } },
      { id: 'flyer_1', documentType: 'flyer', title: 'Flyer', data: { briefContext: 'bar', content: { heroImage: 'data:image/png;base64,FLYER' }, autoGeneratePending: true } },
      { id: 'website_1', documentType: 'website', title: 'Sito', data: { briefContext: 'bar', autoGeneratePending: true } },
    ];
    await act(async () => {
      await result.current.generateAll(docs, customer);
    });
    const siteOpts = mocks.generateSite.mock.calls[0][1];
    // logoBase64 è l'UNICO input visivo accettato (regola T12: card/flyer MAI al website)
    const html = String(siteOpts.logoBase64 ?? '');
    expect(html).not.toContain('CARD');
    expect(html).not.toContain('FLYER');
    // il websiteOrchestrator non riceve mai immagini card/flyer nelle options
    expect(siteOpts.visionPreviews ?? []).toHaveLength(0);
    expect(mocks.generateSite).toHaveBeenCalledTimes(1);
  });

  it('T12: vision card/flyer non viene MAI passata nemmeno in agentMode', async () => {
    const { result } = renderHook(() => useAutoBuildGenerate());
    mocks.agentRun.mockImplementation(async (_brief: any, _docs: any, _ctx: any, opts: any) => {
      await opts.onToolResult({ name: 'generate_website', ok: true, summary: 'Sito', data: { site: { html: 'x', css: '', js: '', pages: ['index'], pagesHtml: {} } } });
    });
    await act(async () => {
      await result.current.generateAll(makeDocs(), customer, { agentMode: true });
    });
    // generateSite (sub-orchestratore) mai chiamato → card/flyer mai arrivate
    expect(mocks.generateSite).not.toHaveBeenCalled();
  });

  it('autoGeneratePending azzerato nei dati salvati', async () => {
    const { result } = renderHook(() => useAutoBuildGenerate());
    await act(async () => {
      await result.current.generateAll(makeDocs(), customer);
    });
    for (const call of mockSave.mock.calls) {
      expect(call[1].data.autoGeneratePending).toBe(false);
    }
  });

  it('T11: agentMode delega all\'AgentOrchestrator e salva i tool result', async () => {
    const { result } = renderHook(() => useAutoBuildGenerate());
    mocks.agentRun.mockImplementation(async (_brief: any, _docs: any, _ctx: any, opts: any) => {
      await opts.onToolResult({ name: 'generate_logo', ok: true, summary: 'Logo generato', data: { concepts: [{}], selected: 0 } });
      await opts.onToolResult({ name: 'generate_card', ok: false, summary: 'Card fallita' });
    });
    await act(async () => {
      const summary = await result.current.generateAll(makeDocs(), customer, { agentMode: true });
      expect(mocks.agentRun).toHaveBeenCalledTimes(1);
      expect(summary.statuses.logo_1).toBe('done');
      expect(summary.statuses.card_1).toBe('error');
      expect(summary.errors.card_1).toBe('Card fallita');
    });
    // il result ok → saveDraft chiamato col data mappato
    expect(mockSave.mock.calls.some((c) => String(c[1].id).includes('logo'))).toBe(true);
  });

  it('saveDocument preserva customerId del draft', async () => {
    const docs = makeDocs().map((d) => ({ ...d, customerId: 'cust_123' }));
    const { result } = renderHook(() => useAutoBuildGenerate());
    await act(async () => {
      await result.current.generateAll(docs, customer);
    });
    for (const call of mockSave.mock.calls) {
      expect(call[1].customerId).toBe('cust_123');
    }
  });

  it('flyer senza size/style/content non va in errore', async () => {
    const doc: AutoBuildDoc = { id: 'flyer_1', documentType: 'flyer', title: 'Flyer', customerId: 'cust_123', data: { briefContext: 'bar', autoGeneratePending: true } };
    const { result } = renderHook(() => useAutoBuildGenerate());
    await act(async () => {
      await result.current.generateOne(doc, customer);
    });
    expect(result.current.state.statuses.flyer_1).toBe('done');
  });

  it('flyer salvato mantiene style/size/content anche se draft incompleto', async () => {
    const doc: AutoBuildDoc = { id: 'flyer_1', documentType: 'flyer', title: 'Flyer', customerId: 'cust_123', data: { briefContext: 'bar', autoGeneratePending: true } };
    const { result } = renderHook(() => useAutoBuildGenerate());
    await act(async () => {
      await result.current.generateOne(doc, customer);
    });
    const save = mockSave.mock.calls.find((c) => c[1].id === 'flyer_1')!;
    expect(save[1].data.size).toBe('A5');
    expect(save[1].data.style).toBeDefined();
    expect(save[1].data.content).toBeDefined();
  });

  it('generateAll salta i doc senza autoGeneratePending', async () => {
    const docs = makeDocs().map((d) => ({ ...d, data: { ...d.data, autoGeneratePending: false } }));
    const { result } = renderHook(() => useAutoBuildGenerate());
    await act(async () => {
      await result.current.generateAll(docs, customer);
    });
    expect(mocks.generateLogo).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('generateOne rigenera un singolo doc anche senza pending', async () => {
    const doc: AutoBuildDoc = { id: 'logo_1', documentType: 'logo', title: 'Logo', data: { briefContext: 'bar', builder: {} } };
    const { result } = renderHook(() => useAutoBuildGenerate());
    await act(async () => {
      await result.current.generateOne(doc, customer);
    });
    expect(mocks.generateLogo).toHaveBeenCalledTimes(1);
    expect(mocks.processPrompt).not.toHaveBeenCalled();
    expect(result.current.state.statuses.logo_1).toBe('done');
    const save = mockSave.mock.calls.find((c) => c[1].id === 'logo_1')!;
    expect(save[1].data.builder).toEqual({ ...logoBuilder, backgroundImage: 'data:image/png;base64,QUJD' });
  });

  it('storage quota: NON strippa builder.backgroundImage, fallisce e logga errore', async () => {
    // La policy cambia: il background logo è contenuto essenziale,
    // rimuoverlo silenziosamente produceva un logo diverso nel CRM.
    mockSave
      .mockResolvedValueOnce({ success: false, error: 'Spazio locale esaurito (immagine troppo grande)' })
      .mockResolvedValueOnce({ success: false, error: 'Spazio locale esaurito (immagine troppo grande)' });
    const doc: AutoBuildDoc = { id: 'logo_1', documentType: 'logo', title: 'Logo', data: { briefContext: 'bar', builder: {} } };
    const { result } = renderHook(() => useAutoBuildGenerate());
    await act(async () => {
      await result.current.generateOne(doc, customer);
    });
    expect(result.current.state.statuses.logo_1).toBe('error');
    // L'errore è esplicito (non più silenzioso con strip)
    expect(result.current.state.errors.logo_1).toMatch(/Spazio locale esaurito|Storage pieno/i);
    // backgroundImage NON deve essere mai rimosso dai dati salvati
    const save = mockSave.mock.calls.find((c) => c[1].id === 'logo_1')!;
    expect(save[1].data.builder.backgroundImage).toBe('data:image/png;base64,QUJD');
  });

  it('mood del cliente mappato a tone flyer', async () => {
    const { result } = renderHook(() => useAutoBuildGenerate());
    await act(async () => {
      await result.current.generateAll(makeDocs().filter((d) => d.documentType === 'flyer'), customer);
    });
    expect(mocks.generateCopy.mock.calls[0][2]).toBe('giovanile');
  });

  describe('providerId (selezione provider CRM)', () => {
    it('generateAll passa providerId come modelId a tutti gli orchestratori', async () => {
      const { result } = renderHook(() => useAutoBuildGenerate());
      await act(async () => {
        await result.current.generateAll(makeDocs(), customer, { providerId: 'deepseek-v4-flash' });
      });
      expect(mocks.generateLogo.mock.calls[0][2]).toEqual(expect.objectContaining({ modelId: 'deepseek-v4-flash' }));
      expect(mocks.processPrompt.mock.calls[0][2].modelId).toBe('deepseek-v4-flash');
      expect(mocks.generateCopy.mock.calls[0][3]).toEqual(expect.objectContaining({ modelId: 'deepseek-v4-flash' }));
    });

    it('generateOne passa providerId come modelId', async () => {
      const doc: AutoBuildDoc = { id: 'logo_1', documentType: 'logo', title: 'Logo', data: { briefContext: 'bar', builder: {} } };
      const { result } = renderHook(() => useAutoBuildGenerate());
      await act(async () => {
        await result.current.generateOne(doc, customer, { providerId: 'deepseek-v4-flash' });
      });
      expect(mocks.generateLogo.mock.calls[0][2]).toEqual(expect.objectContaining({ modelId: 'deepseek-v4-flash' }));
    });

    it('senza options gli orchestratori ricevono modelId undefined (default registry)', async () => {
      const { result } = renderHook(() => useAutoBuildGenerate());
      await act(async () => {
        await result.current.generateAll(makeDocs(), customer);
      });
      expect(mocks.generateLogo.mock.calls[0][2]).toEqual(expect.objectContaining({ modelId: undefined }));
      expect(mocks.processPrompt.mock.calls[0][2].modelId).toBeUndefined();
      expect(mocks.generateCopy.mock.calls[0][3]).toEqual(expect.objectContaining({ modelId: undefined }));
    });
  });

  describe('immagini AI (cover card + hero flyer)', () => {
    it('card senza coverImageUrl: genera cover via /api/ai/image-flash kind hero', async () => {
      const { result } = renderHook(() => useAutoBuildGenerate());
      await act(async () => {
        await result.current.generateAll(makeDocs().filter((d) => d.documentType === 'businessCard'), customer);
      });
      const flashCalls = mockFetch.mock.calls.filter((c) => c[0] === '/api/ai/image-flash');
      expect(flashCalls).toHaveLength(1);
      expect(flashCalls[0][1].body).toContain('"kind":"hero"');
      const cardSave = mockSave.mock.calls.find((c) => c[1].id === 'card_1')!;
      expect(cardSave[1].data.front.coverImageUrl).toBe('data:image/png;base64,QUJD');
    });

    it('card con coverImageUrl esistente: nessuna chiamata image-flash', async () => {
      const docs = makeDocs()
        .filter((d) => d.documentType === 'businessCard')
        .map((d) => ({ ...d, data: { ...d.data, front: { ...(d.data?.front as object), coverImageUrl: 'data:image/png;base64,EXIST' } } }));
      mocks.processPrompt.mockResolvedValue({
        card: { front: { name: 'Mario AI', coverImageUrl: 'data:image/png;base64,EXIST' }, back: {}, style: {} },
        response: { content: '{}', usage },
        changes: [],
        costUsd: 0.002,
      });
      const { result } = renderHook(() => useAutoBuildGenerate());
      await act(async () => {
        await result.current.generateAll(docs, customer);
      });
      expect(mockFetch.mock.calls.some((c) => c[0] === '/api/ai/image-flash')).toBe(false);
    });

    it('flyer senza heroImage: genera hero via /api/ai/image-flash e salva in content.heroImage', async () => {
      const { result } = renderHook(() => useAutoBuildGenerate());
      await act(async () => {
        await result.current.generateAll(makeDocs().filter((d) => d.documentType === 'flyer'), customer);
      });
      const flashCalls = mockFetch.mock.calls.filter((c) => c[0] === '/api/ai/image-flash');
      expect(flashCalls).toHaveLength(1);
      const flyerSave = mockSave.mock.calls.find((c) => c[1].id === 'flyer_1')!;
      expect(flyerSave[1].data.content.heroImage).toBe('data:image/png;base64,QUJD');
    });

    it('image-flash fallisce → draft salvato comunque senza cover/hero', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/api/ai/image-flash') return { ok: false, status: 500, json: async () => ({ error: 'down' }) };
        return { ok: true, json: async () => ({ data: { imageBase64: 'QUJD', mimeType: 'image/png' } }) };
      });
      const { result } = renderHook(() => useAutoBuildGenerate());
      await act(async () => {
        await result.current.generateAll(makeDocs(), customer);
      });
      expect(result.current.state.statuses).toEqual({ logo_1: 'done', card_1: 'done', flyer_1: 'done' });
      const cardSave = mockSave.mock.calls.find((c) => c[1].id === 'card_1')!;
      expect(cardSave[1].data.front.coverImageUrl ?? null).toBeNull();
      const flyerSave = mockSave.mock.calls.find((c) => c[1].id === 'flyer_1')!;
      expect(flyerSave[1].data.content.heroImage ?? null).toBeNull();
    });

    it('image-flash 413 → retry con size più piccola', async () => {
      let call = 0;
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/api/ai/image-flash') {
          call++;
          if (call === 1) return { ok: false, status: 413, json: async () => ({ error: 'too big' }) };
          return { ok: true, json: async () => ({ data: { imageBase64: 'QUJD', mimeType: 'image/png' } }) };
        }
        return { ok: true, json: async () => ({ data: { imageBase64: 'QUJD', mimeType: 'image/png' } }) };
      });
      const { result } = renderHook(() => useAutoBuildGenerate());
      await act(async () => {
        await result.current.generateAll(makeDocs().filter((d) => d.documentType === 'businessCard'), customer);
      });
      const flashCalls = mockFetch.mock.calls.filter((c) => c[0] === '/api/ai/image-flash');
      expect(flashCalls).toHaveLength(2);
      expect(flashCalls[1][1].body).toContain('"size":"256"');
    });
  });

  describe('compressione immagini prima del save', () => {
    it('photoUrl >300KB viene compressa con compressDataUrl prima di saveDraft', async () => {
      mocks.compressDataUrl.mockResolvedValue('data:image/jpeg;base64,SMALL');
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: { imageBase64: 'A'.repeat(500_000), mimeType: 'image/png' } }) });
      const { result } = renderHook(() => useAutoBuildGenerate());
      await act(async () => {
        await result.current.generateAll(makeDocs().filter((d) => d.documentType === 'businessCard'), customer);
      });
      expect(mocks.compressDataUrl).toHaveBeenCalled();
      const cardSave = mockSave.mock.calls.find((c) => c[1].id === 'card_1')!;
      expect(cardSave[1].data.front.photoUrl).toBe('data:image/jpeg;base64,SMALL');
      expect(cardSave[1].data.front.coverImageUrl).toBe('data:image/jpeg;base64,SMALL');
    });

    it('immagini piccole non vengono toccate', async () => {
      const { result } = renderHook(() => useAutoBuildGenerate());
      await act(async () => {
        await result.current.generateAll(makeDocs().filter((d) => d.documentType === 'businessCard'), customer);
      });
      expect(mocks.compressDataUrl).not.toHaveBeenCalled();
      const cardSave = mockSave.mock.calls.find((c) => c[1].id === 'card_1')!;
      expect(cardSave[1].data.front.photoUrl).toBe('data:image/png;base64,QUJD');
    });
  });

  describe('vision (CON-MM-002)', () => {
    it('vision attiva + provider vision → card riceve imagePreviewBase64 del logo rasterizzato', async () => {
      mocks.getAiVisionEnabled.mockReturnValue(true);
      mocks.providerSupportsVision.mockReturnValue(true);
      const { result } = renderHook(() => useAutoBuildGenerate());
      await act(async () => {
        await result.current.generateAll(makeDocs(), customer);
      });
      expect(mocks.svgToPng).toHaveBeenCalled();
      expect(mocks.processPrompt.mock.calls[0][2].imagePreviewBase64).toBe('QUJD');
    });

    it('flyer generateCopy è text-only: nessun imagePreviewBase64 anche con vision attiva', async () => {
      mocks.getAiVisionEnabled.mockReturnValue(true);
      mocks.providerSupportsVision.mockReturnValue(true);
      const { result } = renderHook(() => useAutoBuildGenerate());
      await act(async () => {
        await result.current.generateAll(makeDocs(), customer);
      });
      expect(mocks.generateCopy.mock.calls[0][3]?.imagePreviewBase64).toBeUndefined();
    });

    it('vision attiva ma builder logo esistente nel draft (non generato nel run) → card usa quello', async () => {
      mocks.getAiVisionEnabled.mockReturnValue(true);
      mocks.providerSupportsVision.mockReturnValue(true);
      const docs = makeDocs().map((d) =>
        d.documentType === 'logo' ? { ...d, data: { ...d.data, autoGeneratePending: false, builder: logoBuilder } } : d,
      );
      const { result } = renderHook(() => useAutoBuildGenerate());
      await act(async () => {
        await result.current.generateAll(docs, customer);
      });
      expect(mocks.generateLogo).not.toHaveBeenCalled();
      expect(mocks.processPrompt.mock.calls[0][2].imagePreviewBase64).toBe('QUJD');
    });

    it('gating off → nessuna rasterizzazione, imagePreviewBase64 undefined per card', async () => {
      const { result } = renderHook(() => useAutoBuildGenerate());
      await act(async () => {
        await result.current.generateAll(makeDocs(), customer);
      });
      expect(mocks.svgToPng).not.toHaveBeenCalled();
      expect(mocks.processPrompt.mock.calls[0][2].imagePreviewBase64).toBeUndefined();
    });

    it('rasterizzazione fallisce → card completa comunque senza immagine; flyer text-only non ne usa', async () => {
      mocks.getAiVisionEnabled.mockReturnValue(true);
      mocks.providerSupportsVision.mockReturnValue(true);
      mocks.svgToPng.mockRejectedValue(new Error('canvas rotto'));
      const { result } = renderHook(() => useAutoBuildGenerate());
      await act(async () => {
        await result.current.generateAll(makeDocs(), customer);
      });
      expect(result.current.state.statuses).toEqual({ logo_1: 'done', card_1: 'done', flyer_1: 'done' });
      expect(mocks.processPrompt.mock.calls[0][2].imagePreviewBase64).toBeUndefined();
    });
  });
});
