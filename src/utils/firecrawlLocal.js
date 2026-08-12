// TB-027 dev-only: research Firecrawl diretta dal browser (IS_LOCAL).
// Usata solo quando VITE_FIRECRAWL_API_KEY è presente in .env; in prod la
// ricerca resta server-side (POST /customers/:id/research in api/index.ts).
// NOTA: chunkMarkdown è DUPLICATO da api/index.ts — il codice in api/ non è
// importabile lato client (boundary Vercel: api/ non è bundled per il browser).
// Tenere allineato a mano se cambia la logica di chunking.

const KNOWLEDGE_KEY = 'pq_customer_knowledge:v1';
const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v2/scrape';
const FETCH_TIMEOUT_MS = 120000;

const WEBDATA_JSON_SCHEMA = {
  type: 'object',
  required: [],
  properties: {
    company_name: { type: 'string' },
    company_description: { type: 'string' },
    emails: { type: 'array', items: { type: 'string' } },
    phones: { type: 'array', items: { type: 'string' } },
    addresses: { type: 'array', items: { type: 'string' } },
    colors: { type: 'array', items: { type: 'string' } },
    fonts: { type: 'array', items: { type: 'string' } },
    social_links: { type: 'array', items: { type: 'string' } },
  },
};

export function chunkMarkdown(markdown, maxLen = 1000) {
  if (!markdown) return [];
  const chunks = [];
  let start = 0;
  while (start < markdown.length) {
    let end = Math.min(start + maxLen, markdown.length);
    if (end < markdown.length) {
      const breakAt = markdown.lastIndexOf('\n\n', end);
      if (breakAt > start) end = breakAt;
    }
    chunks.push(markdown.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(Boolean);
}

function extractScreenshot(scraped) {
  const s = scraped?.screenshot;
  if (typeof s === 'string') return s;
  if (s && typeof s === 'object') {
    if (typeof s.url === 'string') return s.url;
    if (typeof s.base64 === 'string') return s.base64;
    if (typeof s.data === 'string') return s.data;
  }
  return null;
}

function extractLinks(scraped, max = 200) {
  const links = scraped?.links;
  if (!Array.isArray(links)) return [];
  return links
    .slice(0, max)
    .map((l) => (typeof l === 'string' ? l : l?.url || l?.href || String(l)))
    .filter(Boolean);
}

function extractJson(scraped) {
  const j = scraped?.json;
  if (j && typeof j === 'object' && !Array.isArray(j)) return j;
  if (typeof j === 'string') {
    try {
      return JSON.parse(j);
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeScraped(raw) {
  const metadata = raw?.metadata || {};
  return {
    markdown: typeof raw?.markdown === 'string' ? raw.markdown : '',
    screenshot: extractScreenshot(raw),
    branding: raw?.branding || {},
    images: extractWebImages(raw, 50),
    links: extractLinks(raw, 200),
    json: extractJson(raw),
    title: typeof metadata.title === 'string' ? metadata.title : '',
    description: typeof metadata.description === 'string' ? metadata.description : '',
    metadata,
  };
}

async function doScrape(url, apiKey, payload) {
  const resp = await fetch(FIRECRAWL_SCRAPE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return normalizeScraped(data.data || data);
}

// Mirror di fetchFirecrawlPage (api/index.ts): stessa request, ma con
// AbortSignal.timeout (il browser non ha il parametro `timeout` lato client)
// e senza SSRF guard (in dev l'URL lo mette l'admin, best-effort).
// Firecrawl v2 supporta oggetto json in `formats` e formato `images`.
// Fallback: se v2 con json/images fallisce, retry con payload minimale.
export async function scrapeFirecrawlLocal(url, apiKey) {
  try {
    const fullPayload = {
      url,
      onlyMainContent: true,
      parsers: ['pdf'],
      formats: ['markdown', 'screenshot', 'branding', 'images', { type: 'json', schema: WEBDATA_JSON_SCHEMA }, 'links'],
    };
    let scraped = await doScrape(url, apiKey, fullPayload);
    if (!scraped) {
      scraped = await doScrape(url, apiKey, { url, onlyMainContent: true, formats: ['markdown', 'branding', 'screenshot', 'links'] });
    }
    if (!scraped) return { status: 'fail' };
    return { status: 'ok', scraped };
  } catch {
    return { status: 'fail' };
  }
}

// Logo detection best-effort: il browser non può fetchare HTML arbitrario
// cross-origin, quindi si usa solo ciò che la risposta Firecrawl fornisce.
// Niente download base64 (evita CORS): gli <img> caricano URL remoti senza problemi.
export function extractLogoFromFirecrawl(scraped) {
  const metadata = scraped?.metadata || {};
  const candidates = [
    scraped?.branding?.logo,
    scraped?.json?.logo,
    metadata.logo,
    metadata.ogImage,
    metadata['og:image'],
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//.test(c)) return c;
  }
  return null;
}

// Immagini sito: branding.images / response.images / markdown
// (sintassi ![alt](url)). Max 6 default, solo http(s), senza duplicati.
export function extractWebImages(scraped, max = 6) {
  const fromResponse = scraped?.images;
  if (Array.isArray(fromResponse) && fromResponse.length) {
    const urls = fromResponse
      .map((u) => (typeof u === 'string' ? u : u?.url || u?.src))
      .filter((u) => typeof u === 'string' && /^https?:\/\//.test(u));
    if (urls.length) return urls.slice(0, max);
  }
  const fromBranding = scraped?.branding?.images;
  if (Array.isArray(fromBranding) && fromBranding.length) {
    const urls = fromBranding.filter((u) => typeof u === 'string' && /^https?:\/\//.test(u));
    if (urls.length) return urls.slice(0, max);
  }
  const markdown = typeof scraped?.markdown === 'string' ? scraped.markdown : '';
  const urls = [];
  const re = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;
  let m;
  while ((m = re.exec(markdown)) && urls.length < max) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }
  return urls;
}

// Knowledge chunks in localStorage: { [customerId]: [{ chunk, source, createdAt }] }.
// Replace per customer (una research sovrascrive la precedente). Try/catch quota.
export function saveKnowledgeChunks(customerId, chunks, source = 'firecrawl:homepage') {
  if (!chunks.length) return 0;
  try {
    const raw = localStorage.getItem(KNOWLEDGE_KEY);
    const store = raw ? JSON.parse(raw) : {};
    const createdAt = new Date().toISOString();
    store[customerId] = chunks.map((chunk) => ({ chunk, source, createdAt }));
    localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(store));
    return chunks.length;
  } catch (err) {
    const reason = err?.name === 'QuotaExceededError' ? 'quota localStorage esaurita' : (err?.message || String(err));
    console.warn(`[knowledge] salvataggio chunk fallito per ${customerId} (${chunks.length} chunk persi): ${reason}`);
    return 0;
  }
}

export function getKnowledgeChunks(customerId) {
  try {
    const raw = localStorage.getItem(KNOWLEDGE_KEY);
    const store = raw ? JSON.parse(raw) : {};
    return Array.isArray(store[customerId]) ? store[customerId] : [];
  } catch {
    return [];
  }
}
