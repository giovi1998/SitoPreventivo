// Core condiviso dai moduli dataService/* e dalla facade dataService.js.
// IS_LOCAL è un singleton valutato una sola volta al primo import (come nel
// monolite originale). Solo import relativi .js: mai .ts (gotcha §23, CJS
// require() in alcuni test fallisce sulla risoluzione extensionless).

export const API_BASE = '/api';
export const IS_LOCAL = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// ─── HELPERS ──────────────────────────────────────────
export function lsGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) {
    // Guard solo localhost: in prod i documenti sono su Postgres, nessun limite localStorage.
    if (e?.name === 'QuotaExceededError' && IS_LOCAL && key === 'precisionQuote_documents:v1' && Array.isArray(val)) {
      try {
        const pruned = pruneOrphanedBozza(val);
        if (pruned.length < val.length) {
          localStorage.setItem(key, JSON.stringify(pruned));
          console.warn(`[guard] localhost quota: rimossi ${val.length - pruned.length} doc orfani BOZZA (solo localhost, in prod Postgres`);
          return true;
        }
      } catch {}
    }
    return { error: e?.name === 'QuotaExceededError' ? 'Spazio locale esaurito (solo localhost — in produzione Postgres, nessun limite. Pulisci i documenti orfani)' : 'Errore scrittura locale' };
  }
}

// lean-code: solo localhost — in prod i documenti sono su Postgres, mai su localStorage.
function pruneOrphanedBozza(docs) {
  const keep = [];
  const orphaned = [];
  for (const d of docs) {
    if (d.customerId == null && d.status === 'BOZZA' && ['logo','businessCard','flyer','website'].includes(d.documentType)) orphaned.push(d);
    else keep.push(d);
  }
  orphaned.sort((a,b) => new Date(a.updatedAt||0) - new Date(b.updatedAt||0));
  // tieni i 10 orfani più recenti, scarta i più vecchi
  const keepOrphaned = orphaned.slice(-10);
  return [...keep, ...keepOrphaned];
}

// TB-029: email utente loggato per attribuzione Langfuse (user.id).
// Mai trust-boundary: server-side è solo metadata di osservabilità.
export function currentUserEmail() {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('userEmail') : null;
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw);
    return typeof v === 'string' && v.includes('@') ? v : undefined;
  } catch {
    return undefined;
  }
}

// Metadata columns stored beside jsonb `data` on the server.
export const DOC_META_KEYS = new Set([
  'id', 'documentType', 'title', 'userEmail', 'createdAt', 'updatedAt',
  'isTemplate', 'data',
]);

/**
 * Client editors send a FLAT document (builder/front/content at top level).
 * The API stores payload in jsonb `data`. Convert flat → API envelope so
 * production never persists `data: null`.
 */
export function toApiDocument(document) {
  if (!document || typeof document !== 'object') return document;
  const {
    id,
    documentType,
    title = '',
    createdAt,
    updatedAt,
    data,
    style,
    ...rest
  } = document;

  if (documentType === 'qrCode') {
    // QR keeps payload in `data` and style as sibling (API schema).
    return {
      id,
      documentType,
      title,
      data: data ?? { type: 'url', payload: '' },
      style,
      createdAt,
      updatedAt,
    };
  }

  // Strip meta from rest; whatever remains is domain payload.
  const domain = { ...rest };
  delete domain.userEmail;
  delete domain.isTemplate;

  // Already wrapped (tests / older clients): only `data`, no flat fields.
  if (data != null && Object.keys(domain).length === 0) {
    return { id, documentType, title, data, createdAt, updatedAt };
  }

  // Flat client shape (logo/card/flyer): nest domain under `data`.
  // If both exist, prefer flat fields and merge optional `data`.
  const payload = data && typeof data === 'object' && !Array.isArray(data)
    ? { ...data, ...domain }
    : domain;

  return { id, documentType, title, data: payload, createdAt, updatedAt };
}

/**
 * Rehydrate a DB row (or already-flat local doc) into the flat shape
 * editors and CollectionView expect.
 */
export function hydrateDocument(row) {
  if (!row || typeof row !== 'object') return row;
  const {
    id,
    userEmail,
    documentType,
    title,
    data,
    createdAt,
    updatedAt,
    ...rest
  } = row;

  if (documentType === 'qrCode') {
    // Stored as { type, payload } or { type, payload, style } or nested data.
    const payload = data && typeof data === 'object' ? data : {};
    const qrData = payload.type != null || payload.payload != null
      ? { type: payload.type ?? 'url', payload: payload.payload ?? '' }
      : (payload.data ?? { type: 'url', payload: '' });
    return {
      documentType: 'qrCode',
      id,
      userEmail,
      title: title ?? '',
      data: qrData,
      style: payload.style ?? rest.style,
      createdAt,
      updatedAt,
    };
  }

  // logo / businessCard / flyer / quote: preferisci jsonb `data` se presente
  // (righe PROD). In LOCAL i campi dominio vivono top-level e `data` è assente.
  // ATTENZIONE: non usare colonne legacy (client, options, project, vat...)
  // come euristica flat-domain: esistono in tutte le righe e nasconderebbero
  // il vero contenuto dentro `data` (bug prod 2026-07-30).
  const body = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  if (Object.keys(body).length > 0) {
    return {
      documentType,
      id,
      userEmail,
      customerId: rest.customerId,
      status: rest.status,
      documentTheme: rest.documentTheme,
      title: title ?? '',
      ...body,
      createdAt: createdAt ?? body.createdAt,
      updatedAt: updatedAt ?? body.updatedAt,
    };
  }

  // Already flat (localStorage path): domain fields live on the row.
  // quote può usare colonne legacy come client/options/project direttamente.
  return {
    id,
    userEmail,
    documentType,
    title: title ?? '',
    ...rest,
    createdAt,
    updatedAt,
  };
}

// ─── API CALL ─────────────────────────────────────────
export async function api(method, path, body, options = {}) {
  const timeoutMs = options.timeoutMs ?? 5000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${API_BASE}${path}`;
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (options.requestId) headers['X-Request-Id'] = options.requestId;
    const res = await fetch(url, {
      method,
      headers: Object.keys(headers).length ? headers : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      return { error: err.error || `Errore server (${res.status})`, status: res.status, detail: `${method} ${url} → ${res.status}` };
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return { error: `Richiesta timeout: ${method} ${path}`, detail: `Il server non ha risposto entro ${Math.round(timeoutMs / 1000)} secondi` };
    }
    return { error: `Errore di rete: ${err.message}`, detail: `Impossibile contattare ${API_BASE}${path}` };
  }
}

// ─── SIMPLE CACHE (30s TTL) ─────────────────────────
const cache = new Map();
export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > 30000) { cache.delete(key); return null; }
  return entry.data;
}
export function setCache(key, data) { cache.set(key, { data, ts: Date.now() }); }

// ─── HELPERS ─────────────────────────────────────────
function randomHex(n) {
  let s = '';
  const chars = '0123456789ABCDEF';
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

// TB-027 B2: costruisce stringa brief contesto per AI dagli dati cliente.
// Passato ai draft come `briefContext` così gli orchestratori AI hanno il contesto.
export function buildBriefContext(cust) {
  const c = cust || {};
  const contacts = c.contacts || {};
  const parts = [];
  if (c.businessName) parts.push(`Attività: ${c.businessName}`);
  if (c.ownerName) parts.push(`Referente: ${c.ownerName}`);
  if (c.sector) parts.push(`Settore: ${c.sector}`);
  if (c.activity) parts.push(`Descrizione: ${c.activity}`);
  if (c.mood) parts.push(`Mood: ${c.mood}`);
  if (c.target) parts.push(`Target: ${c.target}`);
  if (c.preferredColors) parts.push(`Palette: ${c.preferredColors}`);
  if (contacts.address) parts.push(`Indirizzo: ${contacts.address}`);
  if (contacts.website) parts.push(`Sito: ${contacts.website}`);
  if (contacts.phone) parts.push(`Telefono: ${contacts.phone}`);
  if (contacts.email) parts.push(`Email: ${contacts.email}`);
  return parts.join('\n');
}

// TB-027 ai-fill: prompt JSON per compilare solo i campi mancanti del profilo
// brand. Stesso significato del prompt prod (api/index.ts ai-fill).
export function buildAiFillPrompt(c, missing, chunk) {
  const parts = [
    `Compila il profilo brand. Rispondi SOLO con un oggetto JSON con queste chiavi: ${missing.join(', ')}.`,
    buildBriefContext(c),
  ];
  if (chunk) parts.push(`Contenuto sito web:\n${chunk}`);
  return parts.filter(Boolean).join('\n');
}

// Estrae il primo blocco {...} da una risposta AI e lo parsa. Null se non valido.
export function extractJsonObject(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const p = JSON.parse(m[0]);
    return p && typeof p === 'object' && !Array.isArray(p) ? p : null;
  } catch {
    return null;
  }
}

export function cryptoRandomId() {
  try {
    return (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) ;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

export function generateUnlockCode() {
  // Phase 13b: prefisso QB- per i nuovi codici. I codici PQ- esistenti
  // restano validi (redeem confronta solo la stringa normalizzata).
  return `QB-${randomHex(8)}-${randomHex(8)}-${randomHex(8)}`;
}
