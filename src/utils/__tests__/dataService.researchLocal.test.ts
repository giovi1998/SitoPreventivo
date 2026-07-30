import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const CUSTOMER = {
  id: 'cust_1', businessName: 'Bar Da Mario', ownerName: 'Mario', sector: 'bar',
  contacts: { website: 'https://bardamario.example.it' },
};

const LONG_MARKDOWN = ('Paragrafo di testo del sito. '.repeat(30) + '\n\n').repeat(6);

function firecrawlResponse(overrides = {}) {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: {
        markdown: LONG_MARKDOWN,
        branding: { logo: 'https://cdn.example.it/logo.png' },
        metadata: { title: 'Bar Da Mario', description: 'Cucina sarda a Cagliari' },
        ...overrides,
      },
    }),
  };
}

describe('TB-027 researchCustomer LOCAL con VITE_FIRECRAWL_API_KEY (dev)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('pq_customers:v1', JSON.stringify([{ ...CUSTOMER }]));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('senza key → stub no_key (comportamento esistente preservato)', async () => {
    vi.stubEnv('VITE_FIRECRAWL_API_KEY', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const ds = (await import('../dataService')).default;
    const res = await ds.researchCustomer('cust_1');
    expect(res.data.researchStatus).toEqual({ web: 'no_key', logo: 'no_logo' });
    expect(res.data.knowledgeCount).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    const cust = JSON.parse(localStorage.getItem('pq_customers:v1') || '[]')[0];
    expect(cust.status).toBe('researched');
  });

  it('con key + website → scrape reale, chunks in pq_customer_knowledge:v1, logo detected', async () => {
    vi.stubEnv('VITE_FIRECRAWL_API_KEY', 'fc-test-key');
    const fetchSpy = vi.fn().mockResolvedValue(firecrawlResponse());
    vi.stubGlobal('fetch', fetchSpy);
    const ds = (await import('../dataService')).default;
    const res = await ds.researchCustomer('cust_1');
    expect(res.data.researchStatus).toEqual({ web: 'ok', logo: 'detected' });
    expect(res.data.knowledgeCount).toBeGreaterThan(1);
    expect(res.data.webData.title).toBe('Bar Da Mario');
    expect(res.data.webData.description).toBe('Cucina sarda a Cagliari');
    expect(res.data.webData.markdownPreview).toHaveLength(500);
    // request mirror prod: Bearer key + formats completi v2
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.firecrawl.dev/v2/scrape');
    expect(opts.headers.Authorization).toBe('Bearer fc-test-key');
    const payload = JSON.parse(opts.body);
    expect(payload.url).toBe(CUSTOMER.contacts.website);
    expect(payload.formats).toContain('markdown');
    expect(payload.formats).toContain('branding');
    expect(payload.formats).toContain('screenshot');
    expect(payload.formats).toContain('links');
    expect(payload.formats).toContain('images');
    expect(payload.formats.some((f: unknown) => f && typeof f === 'object' && (f as { type?: string }).type === 'json' && (f as { schema?: unknown }).schema)).toBe(true);
    // chunks persistiti
    const knowledge = JSON.parse(localStorage.getItem('pq_customer_knowledge:v1') || '{}');
    expect(knowledge.cust_1.length).toBe(res.data.knowledgeCount);
    expect(knowledge.cust_1[0].source).toBe('firecrawl:homepage');
    expect(knowledge.cust_1[0].createdAt).toBeTruthy();
    // customer aggiornato
    const cust = JSON.parse(localStorage.getItem('pq_customers:v1') || '[]')[0];
    expect(cust.status).toBe('researched');
    expect(cust.detectedLogoUrl).toBe('https://cdn.example.it/logo.png');
    expect(cust.webData.title).toBe('Bar Da Mario');
    expect(cust.updatedAt).toBeTruthy();
    // getCustomerKnowledge legge i chunks
    const kn = await ds.getCustomerKnowledge('cust_1');
    expect(kn.data).toHaveLength(res.data.knowledgeCount);
  });

  it('fallback logo: metadata.ogImage quando branding.logo assente', async () => {
    vi.stubEnv('VITE_FIRECRAWL_API_KEY', 'fc-test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(firecrawlResponse({
      branding: {},
      metadata: { title: 'T', ogImage: 'https://cdn.example.it/og.png' },
    })));
    const ds = (await import('../dataService')).default;
    const res = await ds.researchCustomer('cust_1');
    expect(res.data.researchStatus.logo).toBe('detected');
    const cust = JSON.parse(localStorage.getItem('pq_customers:v1') || '[]')[0];
    expect(cust.detectedLogoUrl).toBe('https://cdn.example.it/og.png');
  });

  it('fetch rigettata → web:error, no throw', async () => {
    vi.stubEnv('VITE_FIRECRAWL_API_KEY', 'fc-test-key');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const ds = (await import('../dataService')).default;
    const res = await ds.researchCustomer('cust_1');
    expect(res.data.researchStatus).toEqual({ web: 'error', logo: 'no_logo' });
    expect(localStorage.getItem('pq_customer_knowledge:v1')).toBeNull();
  });

  it('logoUrl manuale → logo status manual, logoUrl non toccato', async () => {
    localStorage.setItem('pq_customers:v1', JSON.stringify([{
      ...CUSTOMER, logoUrl: 'data:image/png;base64,manual',
    }]));
    vi.stubEnv('VITE_FIRECRAWL_API_KEY', 'fc-test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(firecrawlResponse()));
    const ds = (await import('../dataService')).default;
    const res = await ds.researchCustomer('cust_1');
    expect(res.data.researchStatus).toEqual({ web: 'ok', logo: 'manual' });
    const cust = JSON.parse(localStorage.getItem('pq_customers:v1') || '[]')[0];
    expect(cust.logoUrl).toBe('data:image/png;base64,manual');
  });

  it('logoUrl manuale + scrape fallita → logo resta manual, logoUrl non toccato', async () => {
    localStorage.setItem('pq_customers:v1', JSON.stringify([{
      ...CUSTOMER, logoUrl: 'data:image/png;base64,manual',
    }]));
    vi.stubEnv('VITE_FIRECRAWL_API_KEY', 'fc-test-key');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const ds = (await import('../dataService')).default;
    const res = await ds.researchCustomer('cust_1');
    expect(res.data.researchStatus).toEqual({ web: 'error', logo: 'manual' });
    const cust = JSON.parse(localStorage.getItem('pq_customers:v1') || '[]')[0];
    expect(cust.logoUrl).toBe('data:image/png;base64,manual');
  });

  it('branding colors + images salvati in webData', async () => {
    vi.stubEnv('VITE_FIRECRAWL_API_KEY', 'fc-test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(firecrawlResponse({
      branding: {
        logo: 'https://cdn.example.it/logo.png',
        colors: { primary: '#01696F', accent: '#E11D48' },
        images: ['https://cdn.example.it/1.png', 'https://cdn.example.it/2.png'],
      },
    })));
    const ds = (await import('../dataService')).default;
    const res = await ds.researchCustomer('cust_1');
    expect(res.data.webData.colors).toEqual({ primary: '#01696F', accent: '#E11D48' });
    expect(res.data.webData.images).toEqual(['https://cdn.example.it/1.png', 'https://cdn.example.it/2.png']);
    const cust = JSON.parse(localStorage.getItem('pq_customers:v1') || '[]')[0];
    expect(cust.webData.images).toHaveLength(2);
  });

  it('immagini da markdown se branding.images assente (max 6, solo http)', async () => {
    const markdown = 'Testo ![a](https://cdn.example.it/a.png) ![b](non-url) ![c](https://cdn.example.it/c.png) ![dup](https://cdn.example.it/a.png) ![d](https://cdn.example.it/d.png) ![e](https://cdn.example.it/e.png) ![f](https://cdn.example.it/f.png) ![g](https://cdn.example.it/g.png)';
    vi.stubEnv('VITE_FIRECRAWL_API_KEY', 'fc-test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(firecrawlResponse({ markdown, branding: {} })));
    const ds = (await import('../dataService')).default;
    const res = await ds.researchCustomer('cust_1');
    expect(res.data.webData.images).toEqual([
      'https://cdn.example.it/a.png',
      'https://cdn.example.it/c.png',
      'https://cdn.example.it/d.png',
      'https://cdn.example.it/e.png',
      'https://cdn.example.it/f.png',
      'https://cdn.example.it/g.png',
    ]);
    expect(res.data.webData.colors).toBeNull();
  });

  it('key presente ma nessun website → no_website, nessuna chiamata', async () => {
    localStorage.setItem('pq_customers:v1', JSON.stringify([{ ...CUSTOMER, contacts: {} }]));
    vi.stubEnv('VITE_FIRECRAWL_API_KEY', 'fc-test-key');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const ds = (await import('../dataService')).default;
    const res = await ds.researchCustomer('cust_1');
    expect(res.data.researchStatus).toEqual({ web: 'no_website', logo: 'no_logo' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
