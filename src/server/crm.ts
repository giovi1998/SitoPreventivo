// TB-027 CRM server-side: research, Firecrawl, knowledge, ai-fill, logo detection.
import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { getDb, customersTable, customerKnowledgeTable, documentsTable } from './db.ts';
import { clampDataUrl } from './core.ts';
import { ingestLangfuse } from './langfuse.ts';
import { topKChunks } from '../utils/knowledgeTopK.js';
import type { FirecrawlResult } from './types.ts';
// TB-030 sync customer→website: aggiorna i doc website del cliente con i
// campi brand (font/colori/contatti/social). Last-write-wins con confronto
// updatedAt: il doc vince se è più recente del customer. Best-effort: un
// errore non deve rompere il PATCH customer.
export async function syncCustomerToWebsiteDocs(customerId: string, cust: Record<string, unknown>): Promise<number> {
  const db = await getDb();
  const docs = await db.select().from(documentsTable).where(and(
    eq(documentsTable.customerId, customerId),
    eq(documentsTable.documentType, 'website'),
  ));
  if (docs.length === 0) return 0;
  const contacts = (cust.contacts || {}) as Record<string, unknown>;
  const socials = Array.isArray(cust.socials) ? cust.socials as Array<{ platform?: string; url?: string }> : [];
  const font = typeof cust.font === 'string' ? cust.font : '';
  const preferredColors = typeof cust.preferredColors === 'string' ? cust.preferredColors : '';
  // Indirizzo per la mappa: preferisce l'indirizzo COMPLETO dal research
  // Firecrawl (webData.json.addresses, es. "Via Dante 5/A, Cagliari") —
  // contacts.address è spesso solo via senza città → Google risolve male.
  const webData = (cust.webData || {}) as Record<string, unknown>;
  const webJson = (webData.json || {}) as Record<string, unknown>;
  const webAddresses = Array.isArray(webJson.addresses) ? webJson.addresses.filter((a): a is string => typeof a === 'string') : [];
  const address = webAddresses[0] || String(contacts.address || '');
  const phone = String(contacts.phone || '');
  const email = String(contacts.email || '');
  const custUpdated = cust.updatedAt ? new Date(cust.updatedAt as string).getTime() : Date.now();
  let synced = 0;
  for (const doc of docs) {
    const docUpdated = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
    // Last-write-wins: il doc personalizzato dopo l'ultima modifica del
    // customer vince (l'utente ha modificato il website dopo).
    if (docUpdated > custUpdated) continue;
    const data = (doc.data as Record<string, unknown> | null) || {};
    const brief = (data.brief as Record<string, unknown> | null) || {};
    const nextBrief = {
      ...brief,
      font: font || brief.font,
      preferredColors: preferredColors || brief.preferredColors,
      address,
      phone,
      email,
      contacts: [address, phone, email].filter(Boolean).join(', '),
      socials: socials.length > 0 ? socials : brief.socials,
    };
    await db.update(documentsTable).set({
      data: { ...data, brief: nextBrief } as never,
      updatedAt: new Date(),
    }).where(eq(documentsTable.id, doc.id));
    synced++;
  }
  return synced;
}

export function buildBriefContextApi(cust: Record<string, unknown>): string {  const c = cust || {};
  const contacts = (c.contacts || {}) as Record<string, unknown>;
  const webData = (c.webData || {}) as Record<string, unknown>;
  const webJson = (webData.json || {}) as Record<string, unknown>;
  const brandingColors = webData.brandingColors || (webData.branding as Record<string, unknown>)?.colors;
  const parts: string[] = [];
  if (c.businessName) parts.push(`Attività: ${c.businessName}`);
  if (c.ownerName) parts.push(`Referente: ${c.ownerName}`);
  if (c.sector) parts.push(`Settore: ${c.sector}`);
  if (c.activity) parts.push(`Descrizione: ${c.activity}`);
  if (c.mood) parts.push(`Mood: ${c.mood}`);
  if (c.target) parts.push(`Target: ${c.target}`);
  if (brandingColors) parts.push(`Colori sito (USA QUESTI per logo/card/flyer): ${JSON.stringify(brandingColors)}`);
  if (c.preferredColors) parts.push(`Palette preferita cliente (secondaria): ${c.preferredColors}`);
  if (contacts.address) parts.push(`Indirizzo: ${contacts.address}`);
  if (contacts.website) parts.push(`Sito: ${contacts.website}`);
  if (contacts.phone) parts.push(`Telefono: ${contacts.phone}`);
  if (contacts.email) parts.push(`Email: ${contacts.email}`);
  // TB-027f: contesto Firecrawl (webData) per orchestratori AI.
  if (webData.title) parts.push(`Titolo sito: ${webData.title}`);
  if (webData.description) parts.push(`Descrizione sito: ${webData.description}`);
  if (webJson.company_description) parts.push(`Descrizione attività (AI): ${webJson.company_description}`);
  if (Array.isArray(webData.brandingFonts) && webData.brandingFonts.length) {
    parts.push(`Font sito: ${webData.brandingFonts.join(', ')}`);
  }
  if (Array.isArray(webData.links) && webData.links.length) {
    parts.push(`Link sito: ${webData.links.slice(0, 5).join(', ')}`);
  }
  if (typeof webData.markdownPreview === 'string' && webData.markdownPreview) {
    parts.push(`Contenuto sito: ${webData.markdownPreview.slice(0, 300)}`);
  }
  return parts.join('\n');
}

// Estrae il primo blocco {...} da una risposta AI e lo parsa. Null se non valido.
export function extractJsonObjectApi(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const p = JSON.parse(m[0]);
    return p && typeof p === 'object' && !Array.isArray(p) ? p as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

// TB-027 ai-fill: chiamata DeepSeek server-side (stesso pattern fetch di /ai/chat).
// Null su qualunque fallimento: il chiamante fa fallback alla tabella lookup.
export async function callDeepSeekAiFill(prompt: string): Promise<{ fields: Record<string, unknown>; costUsd: number; usage?: { promptTokens: number; completionTokens: number } } | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: 'Sei un consulente di branding. Rispondi SOLO con un oggetto JSON valido, senza testo extra.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        reasoning_effort: 'max',
        extra_body: { thinking: { type: 'enabled' } },
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content;
    const fields = content ? extractJsonObjectApi(content) : null;
    if (!fields) return null;
    // Mirror providerPricing.ts deepseek-v4-flash ($0.14/$0.28 per 1M tok) — inline:
    // src/ non importabile da api/ (gotcha §1 cross-boundary).
    const costUsd = Math.round((((data.usage?.prompt_tokens || 0) * 0.14 + (data.usage?.completion_tokens || 0) * 0.28) / 1_000_000) * 1_000_000) / 1_000_000;
    return { fields, costUsd, usage: { promptTokens: data.usage?.prompt_tokens || 0, completionTokens: data.usage?.completion_tokens || 0 } };
  } catch {
    return null;
  }
}

// TB-027 RAG: chunking semplice per customer knowledge.
export function chunkMarkdown(markdown: string, maxLen = 1000): string[] {
  if (!markdown) return [];
  const chunks: string[] = [];
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

export async function saveCustomerKnowledge(customerId: string, chunks: string[], source: string, metadata?: Record<string, unknown>): Promise<number> {
  if (!chunks.length) return 0;
  const db = await getDb();
  let inserted = 0;
  for (const chunk of chunks) {
    await db.insert(customerKnowledgeTable).values({
      customerId,
      chunk,
      source,
      metadata: metadata || {},
      embedding: await embedText(chunk, customerId),
    });
    inserted++;
  }
  return inserted;
}

// RAG: embedding Gemini server-side (chiave mai nel browser). [] se non
// configurato o errore: il chunk resta salvato senza embedding (retrieval
// fallback all'ordine di inserimento). Best-effort, mai throw. Tracciato
// su Langfuse con observation type `embedding` (v4 docs).
export async function embedText(text: string, customerId?: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];
  const startTime = Date.now();
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.embedContent({
      model: 'models/gemini-embedding-2',
      contents: text.slice(0, 8000),
    });
    // SDK @google/genai ritorna `embeddings: [{values}]` (plurale); la REST
    // v1beta e i vecchi mock usano `embedding` singolare. Prima leggevamo
    // solo il singolare → sempre vuoto → 502 "Embedding vuoto" (2026-08-13).
    const r = result as unknown as { embeddings?: Array<{ values?: number[] }>; embedding?: { values?: number[] } };
    const values = r?.embeddings?.[0]?.values ?? r?.embedding?.values;
    const embedding = Array.isArray(values) && values.length > 0 ? values : [];
    void ingestLangfuse({
      name: 'embed-chunk',
      requestId: `rag-${customerId ?? 'anon'}`,
      model: 'gemini-embedding-2',
      provider: 'gemini',
      customerId,
      sessionId: customerId,
      feature: 'crm',
      subfeature: 'embedding',
      observationType: 'embedding',
      input: { text: text.slice(0, 500) },
      output: { dimensions: embedding.length },
      startTime,
    });
    return embedding;
  } catch (err) {
    console.warn('[knowledge] embedding fallito, chunk salvato senza', (err as Error)?.message);
    return [];
  }
}

// RAG retrieval: top-k chunk per similarità cosine (modulo condiviso
// client/server). queryText = descrizione attività/settore del customer.
// Senza embedding (o tutti ortogonali) → fallback ordine di inserimento.
export async function getBestKnowledgeChunks(customerId: string, queryText: string, k = 3): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select().from(customerKnowledgeTable).where(eq(customerKnowledgeTable.customerId, customerId));
  if (rows.length === 0) return [];
  const chunks = rows.map((r: { chunk?: unknown; source?: unknown; embedding?: unknown }) => ({
    chunk: String(r.chunk ?? ''),
    source: r.source ? String(r.source) : undefined,
    embedding: Array.isArray(r.embedding) ? r.embedding as number[] : undefined,
  }));
  const queryEmbedding = await embedText(queryText.slice(0, 2000), customerId);
  const topK = topKChunks(chunks, queryEmbedding, k);
  return topK.map((c) => c.chunk);
}

// TB-027 auto-research: Firecrawl website scrape. Best-effort, no crash.
// Requires env FIRECRAWL_API_KEY. SEC-002: key server-side only.

export const FIRECRAWL_WEBDATA_SCHEMA = {
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

export function extractFirecrawlScreenshot(scraped: Record<string, unknown>): string | null {
  const s = scraped.screenshot;
  if (typeof s === 'string') return s;
  if (s && typeof s === 'object') {
    const so = s as Record<string, unknown>;
    if (typeof so.url === 'string') return so.url;
    if (typeof so.base64 === 'string') return so.base64;
    if (typeof so.data === 'string') return so.data;
  }
  return null;
}

export function extractFirecrawlLinks(scraped: Record<string, unknown>, max = 200): string[] {
  const links = scraped.links;
  if (!Array.isArray(links)) return [];
  return links
    .slice(0, max)
    .map((l): string => {
      if (typeof l === 'string') return l;
      const o = l as Record<string, unknown> | undefined;
      const v = o?.url || o?.href;
      return typeof v === 'string' ? v : String(l);
    })
    .filter(Boolean);
}

export function extractFirecrawlJson(scraped: Record<string, unknown>): Record<string, unknown> | undefined {
  const j = scraped.json;
  if (j && typeof j === 'object' && !Array.isArray(j)) return j as Record<string, unknown>;
  if (typeof j === 'string') {
    try {
      return JSON.parse(j) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export async function fetchFirecrawlPage(url?: string): Promise<FirecrawlResult> {
  if (!url) return { status: 'no_website' };
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return { status: 'no_key' };
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return { status: 'fail' };
    if (/^(127\.|10\.|192\.168\.|169\.254\.|localhost$)/.test(u.hostname)) return { status: 'fail' };

    const run = async (payload: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
      const resp = await fetch('https://api.firecrawl.dev/v2/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120000),
      });
      if (!resp.ok) return null;
      const data = await resp.json() as Record<string, unknown>;
      return (data.data || data) as Record<string, unknown>;
    };

    let scraped = await run({
      url,
      onlyMainContent: true,
      parsers: ['pdf'],
      formats: ['markdown', 'screenshot', 'branding', 'images', { type: 'json', schema: FIRECRAWL_WEBDATA_SCHEMA }, 'links'],
    });
    if (!scraped) {
      scraped = await run({ url, onlyMainContent: true, formats: ['markdown', 'branding', 'screenshot', 'links'] });
    }
    if (!scraped) return { status: 'fail' };

    const metadata = (scraped.metadata || {}) as Record<string, unknown>;
    const markdown = typeof scraped.markdown === 'string' ? scraped.markdown : '';
    const branding = (scraped.branding || {}) as FirecrawlResult['branding'];
    const title = typeof metadata.title === 'string' ? metadata.title : '';
    const description = typeof metadata.description === 'string' ? metadata.description : '';
    const images = Array.isArray(scraped.images)
      ? scraped.images
          .map((i) => (typeof i === 'string' ? i : (i as Record<string, unknown>)?.url || (i as Record<string, unknown>)?.src))
          .filter((i): i is string => typeof i === 'string' && /^https?:\/\//.test(i))
      : [];
    const links = extractFirecrawlLinks(scraped, 200);
    const json = extractFirecrawlJson(scraped);
    const screenshot = extractFirecrawlScreenshot(scraped);
    return { markdown, branding, images, links, json, screenshot, title, description, status: 'ok' };
  } catch (err) {
    console.error('[research] Firecrawl error', (err as Error)?.message);
    return { status: 'fail' };
  }
}

// TB-027+ TB-019 auto: pipeline research condivisa (endpoint admin + intake auto).
// Best-effort: mai lanciare eccezioni — ritorna researchStatus per il caller.
export async function runCustomerResearch(cust: any): Promise<{
  researchStatus: Record<string, string>;
  knowledgeCount: number;
  webData: Record<string, unknown>;
}> {
  const contacts = (cust.contacts || {}) as { address?: string; website?: string };
  const website = contacts.website || cust.googleMapsUrl;
  const researchStatus: Record<string, string> = {};
  let knowledgeCount = 0;
  let webData: Record<string, unknown> = {};
  let detectedLogoUrl: string | null = null;
  if (!website) {
    researchStatus.web = 'no_website';
  } else {
    const firecrawl = await fetchFirecrawlPage(website);
    researchStatus.web = firecrawl.status;
    if (firecrawl.status === 'ok') {
      const chunks = chunkMarkdown(firecrawl.markdown || '');
      knowledgeCount = await saveCustomerKnowledge(cust.id, chunks, 'firecrawl:homepage', {
        title: firecrawl.title,
        description: firecrawl.description,
        url: website,
      });
      webData = {
        title: firecrawl.title,
        description: firecrawl.description,
        markdownPreview: (firecrawl.markdown || '').slice(0, 500),
        markdownFull: firecrawl.markdown || '',
        screenshot: firecrawl.screenshot,
        links: firecrawl.links,
        json: firecrawl.json,
        branding: firecrawl.branding,
        brandingColors: firecrawl.branding?.colors,
        brandingFonts: firecrawl.branding?.fonts,
        brandingLogo: firecrawl.branding?.logo,
        images: firecrawl.images,
      };
      detectedLogoUrl = firecrawl.branding?.logo || (typeof firecrawl.json?.logo === 'string' ? firecrawl.json.logo : null) || null;
    }
  }
  if (!detectedLogoUrl) {
    detectedLogoUrl = await detectLogo(contacts.website);
  }
  // Logo manuale (upload admin) vince SEMPRE: status 'manual' e
  // detectedLogoUrl non viene sovrascritto.
  researchStatus.logo = cust.logoUrl ? 'manual' : detectedLogoUrl ? 'ok' : 'no_logo';
  // TB-030 prefill: se il customer non ha social, popolali dai social_links
  // Firecrawl (piattaforma dal dominio). Se non ha font, usa brandingFonts[0].
  const webLinks = Array.isArray(webData.links) ? webData.links.filter((l): l is string => typeof l === 'string') : [];
  const socials = Array.isArray(cust.socials) && cust.socials.length > 0
    ? cust.socials
    : webLinks.filter((l) => /instagram|facebook|linkedin|tiktok|youtube|twitter|x\.com|pinterest/i.test(l)).slice(0, 5).map((l) => ({ platform: socialPlatformFromUrl(l), url: l }));
  const webFonts = Array.isArray(webData.brandingFonts) ? webData.brandingFonts.filter((f): f is string => typeof f === 'string') : [];
  const font = typeof cust.font === 'string' && cust.font
    ? cust.font
    : (webFonts.length > 0 ? webFonts[0] : null);
  const db = await getDb();
  await db.update(customersTable).set({
    detectedLogoUrl: cust.logoUrl ? cust.detectedLogoUrl : (detectedLogoUrl || cust.detectedLogoUrl),
    researchStatus,
    webData,
    status: 'researched',
    ...(socials.length > 0 ? { socials } : {}),
    ...(font ? { font } : {}),
    updatedAt: new Date(),
  }).where(eq(customersTable.id, cust.id));
  return { researchStatus, knowledgeCount, webData };
}

/** Piattaforma social dal dominio URL (instagram.com → Instagram). */
function socialPlatformFromUrl(url: string): string {
  const m = url.match(/https?:\/\/(?:www\.)?([^/]+)/i);
  const host = m ? m[1] : url;
  const known: Record<string, string> = {
    'instagram.com': 'Instagram',
    'facebook.com': 'Facebook',
    'linkedin.com': 'LinkedIn',
    'tiktok.com': 'TikTok',
    'youtube.com': 'YouTube',
    'twitter.com': 'X',
    'x.com': 'X',
    'pinterest.com': 'Pinterest',
  };
  for (const [k, v] of Object.entries(known)) {
    if (host === k || host.endsWith('.' + k)) return v;
  }
  return host.split('.')[0] || 'Social';
}

// TB-027 logo detection: fetch homepage, estrai favicon/img candidate.
// SEC-003: no SSRF verso IP interni. Best-effort: favicon prima, poi <img> con
// src contenente "logo"/classe "logo" (spec REQ-AR-004).
export async function detectLogo(website?: string): Promise<string | null> {
  if (!website) return null;
  try {
    const url = new URL(website);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const host = url.hostname;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|localhost$)/.test(host)) return null;
    // Step 1: favicon.ico (semplice, spesso presente)
    const fav = await fetchFavicon(host);
    if (fav) return fav;
    // Step 2: parse homepage HTML, cerca <img> con src/class/id contenente "logo"
    const img = await detectLogoFromHomepage(host, url.pathname || '/');
    if (img) return img;
  } catch {
    return null;
  }
  return null;
}

export async function fetchFavicon(host: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://${host}/favicon.ico`, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > 0 && buf.byteLength < 200 * 1024) {
      const b64 = Buffer.from(buf).toString('base64');
      return clampDataUrl('data:image/x-icon;base64,' + b64, 200 * 1024);
    }
  } catch {
    return null;
  }
  return null;
}

export async function detectLogoFromHomepage(host: string, path: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://${host}${path}`, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const html = await resp.text();
    // Cerca <img src="..." alt="..."> con src/alt/class/id che match "logo"
    const imgRegex = /<img[^>]+(?:src|alt|class|id)\s*=\s*["']([^"']*logo[^"']*)["'][^>]*>/gi;
    const srcRegex = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/i;
    let match = imgRegex.exec(html);
    if (!match) {
      const srcMatch = srcRegex.exec(html);
      if (!srcMatch) return null;
      const src = srcMatch[1];
      if (!/logo/i.test(src)) return null;
      return await fetchLogoImage(host, src);
    }
    // match[1] è il valore di src/alt/class/id contenente "logo". Estrai src reale.
    const fullTag = match[0];
    const srcMatch = /src\s*=\s*["']([^"']+)["']/i.exec(fullTag);
    if (!srcMatch) return null;
    return await fetchLogoImage(host, srcMatch[1]);
  } catch {
    return null;
  }
}

export async function fetchLogoImage(host: string, src: string): Promise<string | null> {
  let imgUrl: string;
  try {
    if (src.startsWith('http')) {
      const u = new URL(src);
      if (/^(127\.|10\.|192\.168\.|169\.254\.|localhost$)/.test(u.hostname)) return null;
      imgUrl = src;
    } else if (src.startsWith('//')) {
      imgUrl = 'https:' + src;
    } else if (src.startsWith('/')) {
      imgUrl = `https://${host}${src}`;
    } else {
      imgUrl = `https://${host}/${src}`;
    }
    const resp = await fetch(imgUrl, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength >= 200 * 1024) return null;
    const mime = resp.headers.get('content-type') || 'image/png';
    const b64 = Buffer.from(buf).toString('base64');
    return clampDataUrl(`data:${mime};base64,${b64}`, 200 * 1024);
  } catch {
    return null;
  }
}

