import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const CUSTOMER = {
  id: 'cust_1', businessName: 'Bar Da Mario', ownerName: 'Mario', sector: 'bar',
  mood: null, target: null, preferredColors: null, activity: null,
  contacts: { website: 'https://bardamario.example.it' },
};

function aiChatResponse(content: string) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { role: 'assistant', content } }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    }),
  };
}

describe('TB-027 aiFillCustomer LOCAL: AI reale via dev proxy + fallback lookup', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('pq_customers:v1', JSON.stringify([{ ...CUSTOMER }]));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('AI ok → valori AI usati, costUsd presente, prompt include knowledge chunk', async () => {
    localStorage.setItem('pq_customer_knowledge:v1', JSON.stringify({
      cust_1: [{ chunk: 'Cocktail bar in centro a Cagliari, aperto tutti i giorni.', source: 'firecrawl:homepage', createdAt: '2026-07-29' }],
    }));
    const fetchSpy = vi.fn().mockImplementation(async (url, opts) => {
      if (url === '/api/ai/embeddings') {
        return { ok: true, json: async () => ({ data: { embedding: [1, 0] } }) };
      }
      return aiChatResponse(
        '{"mood":"caldo familiare","target":"famiglie del quartiere","preferredColors":"bordeaux e crema","activity":"Trattoria tipica sarda"}',
      );
    });
    vi.stubGlobal('fetch', fetchSpy);
    const ds = (await import('../dataService')).default;
    const res = await ds.aiFillCustomer('cust_1');
    expect(res.error).toBeUndefined();
    expect(res.data.aiSuggestedFields).toEqual({
      mood: 'caldo familiare',
      target: 'famiglie del quartiere',
      preferredColors: 'bordeaux e crema',
      activity: 'Trattoria tipica sarda',
    });
    expect(typeof res.data.costUsd).toBe('number');
    // prima la query embedding al dev proxy, poi la chat AI
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/ai/embeddings');
    expect(String(fetchSpy.mock.calls[0][1].body)).toContain('bar');
    const [, chatOpts] = fetchSpy.mock.calls[1];
    expect(String(chatOpts.body)).toContain('Cocktail bar in centro a Cagliari');
    // persistito sul customer
    const cust = JSON.parse(localStorage.getItem('pq_customers:v1') || '[]')[0];
    expect(cust.mood).toBe('caldo familiare');
    expect(cust.aiSuggestedFields.target).toBe('famiglie del quartiere');
  });

  it('AI fallisce (rete) → fallback tabella lookup, nessun throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('proxy down')));
    const ds = (await import('../dataService')).default;
    const res = await ds.aiFillCustomer('cust_1');
    expect(res.error).toBeUndefined();
    expect(res.data.aiSuggestedFields.mood).toBe('moderno');
    expect(res.data.aiSuggestedFields.target).toBe('Clienti locali settore bar');
    expect(res.data.costUsd).toBe(0);
  });

  it('AI risponde JSON non valido → fallback lookup', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(aiChatResponse('non è json affatto')));
    const ds = (await import('../dataService')).default;
    const res = await ds.aiFillCustomer('cust_1');
    expect(res.data.aiSuggestedFields.mood).toBe('moderno');
    expect(res.data.costUsd).toBe(0);
  });

  it('campi già compilati non vengono toccati, nessuna chiamata AI', async () => {
    localStorage.setItem('pq_customers:v1', JSON.stringify([{
      ...CUSTOMER, mood: 'elegante', target: 'turisti', preferredColors: 'oro', activity: 'Bar storico',
    }]));
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const ds = (await import('../dataService')).default;
    const res = await ds.aiFillCustomer('cust_1');
    expect(res.data.aiSuggestedFields).toEqual({});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('cliente non trovato → error', async () => {
    localStorage.setItem('pq_customers:v1', JSON.stringify([]));
    const ds = (await import('../dataService')).default;
    const res = await ds.aiFillCustomer('nope');
    expect(res.error).toBe('Cliente non trovato');
  });
});
