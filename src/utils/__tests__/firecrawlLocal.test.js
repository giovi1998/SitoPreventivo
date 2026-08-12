import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  chunkMarkdown,
  scrapeFirecrawlLocal,
  extractLogoFromFirecrawl,
  extractWebImages,
  saveKnowledgeChunks,
  getKnowledgeChunks,
} from '../firecrawlLocal';

describe('firecrawlLocal', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('chunkMarkdown split on paragraphs', () => {
    const md = 'A\n\nB\n\nC';
    expect(chunkMarkdown(md, 3)).toEqual(['A', 'B', 'C']);
  });

  it('scrapeFirecrawlLocal richiede formati completi e normalizza risposta', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            markdown: 'Hello',
            screenshot: 'https://example.com/s.png',
            branding: { logo: 'https://example.com/logo.png', colors: { primary: '#000' }, fonts: ['Inter'] },
            images: ['https://example.com/a.jpg'],
            links: ['https://example.com/about'],
            json: { company_name: 'Acme' },
            metadata: { title: 'Acme' },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const res = await scrapeFirecrawlLocal('https://example.com', 'fc_test');
    expect(res.status).toBe('ok');
    expect(res.scraped.markdown).toBe('Hello');
    expect(res.scraped.screenshot).toBe('https://example.com/s.png');
    expect(res.scraped.links).toEqual(['https://example.com/about']);
    expect(res.scraped.json.company_name).toBe('Acme');
    expect(res.scraped.images).toEqual(['https://example.com/a.jpg']);
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(globalThis.fetch.mock.calls[0][0]).toBe('https://api.firecrawl.dev/v2/scrape');
    expect(body.formats).toContain('screenshot');
    expect(body.formats).toContain('links');
    expect(body.formats).toContain('images');
    expect(body.formats.some((f) => f && f.type === 'json' && f.schema)).toBe(true);
  });

  it('scrapeFirecrawlLocal fallback se richiesta completa fallisce', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('bad request', { status: 400 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { markdown: 'Fallback', branding: {}, metadata: {} } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    const res = await scrapeFirecrawlLocal('https://example.com', 'fc_test');
    expect(res.status).toBe('ok');
    expect(res.scraped.markdown).toBe('Fallback');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('extractLogoFromFirecrawl preferisce branding.logo', () => {
    expect(extractLogoFromFirecrawl({ branding: { logo: 'https://x/logo.png' } })).toBe('https://x/logo.png');
    expect(extractLogoFromFirecrawl({ json: { logo: 'https://x/json-logo.png' }, metadata: {} })).toBe('https://x/json-logo.png');
    expect(extractLogoFromFirecrawl({ metadata: { 'og:image': 'https://x/og.png' } })).toBe('https://x/og.png');
    expect(extractLogoFromFirecrawl({})).toBeNull();
  });

  it('extractWebImages raccoglie URL da response, branding e markdown', () => {
    expect(extractWebImages({ images: ['https://x/a.jpg'] }, 2)).toEqual(['https://x/a.jpg']);
    expect(extractWebImages({ branding: { images: ['https://x/b.jpg'] } }, 2)).toEqual(['https://x/b.jpg']);
    expect(extractWebImages({ markdown: '![alt](https://x/c.jpg)' }, 2)).toEqual(['https://x/c.jpg']);
  });

  it('saveKnowledgeChunks e getKnowledgeChunks roundtrip', () => {
    expect(saveKnowledgeChunks('c1', ['a', 'b'])).toBe(2);
    expect(getKnowledgeChunks('c1')).toHaveLength(2);
    expect(getKnowledgeChunks('c2')).toHaveLength(0);
  });

  it('saveKnowledgeChunks quota esaurita → 0 con warn esplicito (mai silenzioso)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(saveKnowledgeChunks('c1', ['a', 'b'])).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('quota localStorage esaurita'));
    setItem.mockRestore();
  });

  it('getKnowledgeChunks con chiave corrotta → [] senza crash', () => {
    localStorage.setItem('pq_customer_knowledge:v1', '{corrotto');
    expect(getKnowledgeChunks('c1')).toEqual([]);
  });

  it('saveKnowledgeChunks con store esistente corrotto → 0 con warn', () => {
    localStorage.setItem('pq_customer_knowledge:v1', '{corrotto');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(saveKnowledgeChunks('c1', ['a'])).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('salvataggio chunk fallito'));
  });
});
