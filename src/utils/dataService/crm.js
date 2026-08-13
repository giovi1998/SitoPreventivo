// CRM TB-027/TB-019: customers, research, ai-fill, auto-build, intakes, config.
// Shim getCustomer `{...d, data: d}` e draft auto-build FLAT: NON rompere
// (gotcha §23). Import dinamici extensionless (.ts) solo dentro le funzioni:
// mai a module load, così il require() CJS dei test resta sicuro (§23).
// `svc` è la facade dataService (riferimenti cross-modulo a call time).
import { IS_LOCAL, lsGet, lsSet, api, cryptoRandomId, buildBriefContext, buildAiFillPrompt, extractJsonObject } from './core.js';
import { chunkMarkdown, scrapeFirecrawlLocal, extractLogoFromFirecrawl, extractWebImages, saveKnowledgeChunks, getKnowledgeChunks } from '../firecrawlLocal.js';
import { topKChunks } from '../knowledgeTopK.js';

// TB-030 sync customer→website (locale): aggiorna i doc website del cliente
// con i campi brand. Last-write-wins con confronto updatedAt: il doc vince
// se è più recente del customer. Mirror di syncCustomerToWebsiteDocs (server).
function syncCustomerToWebsiteLocal(cust) {
  const docs = lsGet('precisionQuote_documents:v1') || [];
  const contacts = cust.contacts || {};
  const socials = Array.isArray(cust.socials) ? cust.socials : [];
  const font = typeof cust.font === 'string' ? cust.font : '';
  const preferredColors = typeof cust.preferredColors === 'string' ? cust.preferredColors : '';
  // Indirizzo per la mappa: preferisce l'indirizzo COMPLETO dal research
  // Firecrawl (webData.json.addresses) — contacts.address è spesso solo via
  // senza città → Google risolve male (Monza/Rozzano).
  const webJson = (cust.webData?.json || {});
  const webAddresses = Array.isArray(webJson.addresses) ? webJson.addresses.filter((a) => typeof a === 'string') : [];
  const address = webAddresses[0] || String(contacts.address || '');
  const phone = String(contacts.phone || '');
  const email = String(contacts.email || '');
  const custUpdated = new Date(cust.updatedAt || Date.now()).getTime();
  let changed = false;
  for (const d of docs) {
    if (d.customerId !== cust.id || d.documentType !== 'website') continue;
    const docUpdated = new Date(d.updatedAt || 0).getTime();
    if (docUpdated > custUpdated) continue;
    const data = d.data || {};
    const brief = data.brief || {};
    d.data = {
      ...data,
      brief: {
        ...brief,
        font: font || brief.font,
        preferredColors: preferredColors || brief.preferredColors,
        address,
        phone,
        email,
        contacts: [address, phone, email].filter(Boolean).join(', '),
        socials: socials.length > 0 ? socials : brief.socials,
      },
    };
    d.updatedAt = new Date().toISOString();
    changed = true;
  }
  if (changed) lsSet('precisionQuote_documents:v1', docs);
}

/** Piattaforma social dal dominio URL (instagram.com → Instagram). */
function socialPlatformFromUrl(url) {
  const m = url.match(/https?:\/\/(?:www\.)?([^/]+)/i);
  const host = m ? m[1] : url;
  const known = {
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

export function createCrmMethods(svc) {
  return {
    // ─── TB-027 CRM: customers ──────────────────────────
    // Admin-only. LOCAL usa localStorage (key pq_customers:v1), PROD API.
    // lean-code: localStorage come cache/seed per dev, POST crea su API.

    async getCustomers(status) {
      if (IS_LOCAL) {
        const all = lsGet('pq_customers:v1') || [];
        const filtered = status ? all.filter((c) => c.status === status) : all;
        return { data: filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)) };
      }
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      params.set('adminEmail', 'admin@gmail.com');
      return api('GET', `/customers?${params}`);
    },

    async createCustomer(payload) {
      if (IS_LOCAL) {
        const all = lsGet('pq_customers:v1') || [];
        const cust = {
          id: 'cust_' + cryptoRandomId(),
          ...payload,
          source: 'manual',
          status: 'new',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        all.push(cust);
        lsSet('pq_customers:v1', all);
        return { data: cust };
      }
      return api('POST', '/customers', { adminEmail: 'admin@gmail.com', ...payload });
    },

    async getCustomer(id) {
      if (IS_LOCAL) {
        const all = lsGet('pq_customers:v1') || [];
        const cust = all.find((c) => c.id === id);
        if (!cust) return { error: 'Cliente non trovato' };
        const customerDocs = (lsGet('precisionQuote_documents:v1') || []).filter((d) => d.customerId === id);
        // Shim CRM: CustomerDetail legge doc.data.builder / autoGeneratePending /
        // aiStats. Con storage canonico flat i campi dominio sono top-level →
        // espongo `data` come alias del doc stesso (i QR hanno già un data
        // legittimo e passano invariati).
        const docsForCrm = customerDocs.map((d) => (d.data ? d : { ...d, data: d }));
        return { data: { ...cust, documents: docsForCrm } };
      }
      return api('GET', `/customers/${id}?adminEmail=${encodeURIComponent('admin@gmail.com')}`);
    },

    async updateCustomer(id, patch) {
      if (IS_LOCAL) {
        const all = lsGet('pq_customers:v1') || [];
        const idx = all.findIndex((c) => c.id === id);
        if (idx < 0) return { error: 'Cliente non trovato' };
        const updated = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
        all[idx] = updated;
        lsSet('pq_customers:v1', all);
        // TB-030 sync customer→website (locale): aggiorna i doc website del
        // cliente con i campi brand. Last-write-wins con confronto updatedAt.
        if (!patch.skipSync) {
          try {
            syncCustomerToWebsiteLocal(updated);
          } catch (e) {
            console.warn('[sync] customer→website fallito (locale)', e?.message || e);
          }
        }
        return { data: updated };
      }
      return api('PATCH', `/customers/${id}`, { adminEmail: 'admin@gmail.com', ...patch });
    },

    async deleteCustomer(id) {
      if (IS_LOCAL) {
        const all = lsGet('pq_customers:v1') || [];
        const idx = all.findIndex((c) => c.id === id);
        if (idx < 0) return { error: 'Cliente non trovato' };
        all.splice(idx, 1);
        lsSet('pq_customers:v1', all);
        // scollega documenti
        const docs = lsGet('precisionQuote_documents:v1') || [];
        let changed = false;
        for (const d of docs) {
          if (d.customerId === id) { d.customerId = null; changed = true; }
        }
        if (changed) lsSet('precisionQuote_documents:v1', docs);
        return { data: { id, deleted: true } };
      }
      return api('DELETE', `/customers/${id}`, { adminEmail: 'admin@gmail.com' });
    },

    async researchCustomer(id) {
      if (IS_LOCAL) {
        const all = lsGet('pq_customers:v1') || [];
        const idx = all.findIndex((c) => c.id === id);
        if (idx < 0) return { error: 'Cliente non trovato' };
        const cust = all[idx];
        const apiKey = import.meta.env?.VITE_FIRECRAWL_API_KEY;
        const website = cust.contacts?.website;
        const persist = (researchStatus, extra = {}) => {
          // Logo manuale (upload admin) vince SEMPRE: status 'manual', mai
          // sovrascritto da detection Firecrawl né da path di errore.
          if (cust.logoUrl) researchStatus.logo = 'manual';
          all[idx] = {
            ...cust, ...extra, researchStatus,
            status: 'researched', updatedAt: new Date().toISOString(),
          };
          lsSet('pq_customers:v1', all);
          return {
            data: {
              id, researchStatus,
              knowledgeCount: extra.knowledgeCount || 0,
              webData: extra.webData || {},
            },
          };
        };
        // Stub originale: senza key dev non si chiama Firecrawl.
        if (!apiKey) {
          return persist({ web: 'no_key', logo: 'no_logo' });
        }
        if (!website) {
          return persist({ web: 'no_website', logo: cust.logoUrl ? 'manual' : 'no_logo' });
        }
        // Research reale dev-only: chiama Firecrawl dal browser (CORS consentito
        // da api.firecrawl.dev). Fallimento → status error, mai throw.
        const scraped = await scrapeFirecrawlLocal(website, apiKey);
        if (scraped.status !== 'ok') {
          return persist({ web: 'error', logo: 'no_logo' });
        }
        const page = scraped.scraped || {};
        const metadata = page.metadata || {};
        const markdown = typeof page.markdown === 'string' ? page.markdown : '';
        const chunks = chunkMarkdown(markdown);
        const knowledgeCount = saveKnowledgeChunks(id, chunks);
        // Logo manuale (upload admin) ha priorità: status 'manual', mai sovrascritto.
        const detectedLogoUrl = extractLogoFromFirecrawl(page);
        const logoStatus = cust.logoUrl ? 'manual' : detectedLogoUrl ? 'detected' : 'no_logo';
        // TB-030 prefill: se il customer non ha social, popolali dai
        // social_links Firecrawl (piattaforma dal dominio). Se non ha font,
        // usa brandingFonts[0].
        const links = Array.isArray(page.links) ? page.links.filter((l) => typeof l === 'string') : [];
        const socials = Array.isArray(cust.socials) && cust.socials.length > 0
          ? cust.socials
          : links.filter((l) => /instagram|facebook|linkedin|tiktok|youtube|twitter|x\.com|pinterest/i.test(l)).slice(0, 5).map((l) => ({ platform: socialPlatformFromUrl(l), url: l }));
        const fonts = Array.isArray(page.branding?.fonts) ? page.branding.fonts.filter((f) => typeof f === 'string') : [];
        const font = typeof cust.font === 'string' && cust.font ? cust.font : (fonts.length > 0 ? fonts[0] : null);
        return persist({ web: 'ok', logo: logoStatus }, {
          ...(detectedLogoUrl ? { detectedLogoUrl } : {}),
          ...(socials.length > 0 ? { socials } : {}),
          ...(font ? { font } : {}),
          knowledgeCount,
          webData: {
            title: typeof page.title === 'string' ? page.title : (typeof metadata.title === 'string' ? metadata.title : ''),
            description: typeof page.description === 'string' ? page.description : (typeof metadata.description === 'string' ? metadata.description : ''),
            markdownPreview: markdown.slice(0, 500),
            markdownFull: markdown,
            screenshot: page.screenshot ?? null,
            links: page.links ?? [],
            json: page.json ?? null,
            branding: page.branding ?? null,
            colors: page.branding?.colors ?? null,
            images: extractWebImages(page, 12),
          },
        });
      }
      // Timeout esteso: il server chiama Firecrawl (fino a 120s). Col default
      // 5s il client abortiva e il server consumava lo slot rate-limit orario.
      return api('POST', `/customers/${id}/research`, { adminEmail: 'admin@gmail.com' }, { timeoutMs: 130000 });
    },

    async getCustomerKnowledge(id) {
      if (IS_LOCAL) return { data: getKnowledgeChunks(id) };
      return api('GET', `/customers/${id}/knowledge?adminEmail=${encodeURIComponent('admin@gmail.com')}`);
    },

    async generateEmbedding(text) {
      return api('POST', '/ai/embeddings', { input: text });
    },

    async aiFillCustomer(id) {
      if (IS_LOCAL) {
        const all = lsGet('pq_customers:v1') || [];
        const idx = all.findIndex((c) => c.id === id);
        if (idx < 0) return { error: 'Cliente non trovato' };
        const c = all[idx];
        // Fallback lookup (comportamento pre-AI): riempie i campi mancanti.
        const sector = c.sector || 'generico';
        const ai = {};
        if (!c.mood) ai.mood = 'moderno';
        if (!c.target) ai.target = 'Clienti locali settore ' + sector;
        if (!c.preferredColors) ai.preferredColors = 'palette settore';
        if (!c.activity) ai.activity = 'Attività settore ' + sector;
        let costUsd = 0;
        const missing = Object.keys(ai);
        if (missing.length > 0) {
          try {
            // Import dinamici: evitano ciclo dataService↔providers a valutazione modulo.
            const [{ providerRegistry }, { resolveProviderId }, { calculateCostUsd }] = await Promise.all([
              import('../../ai/providers/registry'),
              import('../resolveProviderId'),
              import('../../ai/providerPricing'),
            ]);
            const providerId = resolveProviderId();
            const provider = providerRegistry.getProvider(providerId);
            const knowledge = getKnowledgeChunks(id);
            // RAG locale: embedding via dev proxy (chiave server-side), poi
            // top-k cosine (modulo condiviso server/client). Senza embedding
            // → fallback ordine di inserimento.
            const queryText = [c.sector, c.activity].filter(Boolean).join(' ');
            const queryEmbedding = queryText ? await this.generateEmbedding(queryText) : null;
            const chunk = topKChunks(knowledge, queryEmbedding?.data?.embedding ?? null, 1)[0]?.chunk || '';
            const response = await provider.chat([
              { role: 'system', content: 'Sei un consulente di branding. Rispondi SOLO con un oggetto JSON valido, senza testo extra.' },
              { role: 'user', content: buildAiFillPrompt(c, missing, chunk) },
            ], { temperature: 0.7, responseFormat: { type: 'json_object' } });
            const parsed = response?.content ? extractJsonObject(response.content) : null;
            if (!parsed) throw new Error('Risposta AI non parsabile');
            // AI vince sul lookup per i campi che ha effettivamente compilato.
            for (const k of missing) {
              if (typeof parsed[k] === 'string' && parsed[k].trim()) ai[k] = parsed[k].trim();
            }
            costUsd = calculateCostUsd(providerId, response.usage);
            all[idx] = { ...c, ...ai, aiSuggestedFields: ai, updatedAt: new Date().toISOString() };
            lsSet('pq_customers:v1', all);
            return { data: { id, aiSuggestedFields: ai, costUsd, fromAI: true } };
          } catch (err) {
            console.warn('[ai-fill] AI fallita, fallback tabella lookup:', err?.message || err);
          }
        }
        all[idx] = { ...c, ...ai, aiSuggestedFields: ai, updatedAt: new Date().toISOString() };
        lsSet('pq_customers:v1', all);
        return { data: { id, aiSuggestedFields: ai, costUsd, fromAI: false } };
      }
      // Timeout esteso: il server chiama il provider AI (può superare i 5s default).
      return api('POST', `/customers/${id}/ai-fill`, { adminEmail: 'admin@gmail.com' }, { timeoutMs: 60000 });
    },

    async autoBuildCustomer(id, autoGenerate = false) {
      if (IS_LOCAL) {
        const all = lsGet('pq_customers:v1') || [];
        const cust = all.find((c) => c.id === id);
        if (!cust) return { error: 'Cliente non trovato' };
        let docs = lsGet('precisionQuote_documents:v1') || [];
        const now = new Date().toISOString();
        const ids = [];
        const contacts = cust.contacts || {};
        // Indirizzo per la mappa: preferisce l'indirizzo completo dal research
        // Firecrawl (webData.json.addresses) — contacts.address è spesso solo
        // via senza città → Google risolve male (Monza/Rozzano).
        const webJson = (cust.webData?.json || {});
        const webAddresses = Array.isArray(webJson.addresses) ? webJson.addresses.filter((a) => typeof a === 'string') : [];
        const mapAddress = webAddresses[0] || String(contacts.address || '');
        const photos = Array.isArray(cust.customerPhotos) ? cust.customerPhotos : [];
        const firstPhoto = photos.length > 0 ? photos[0] : null;
        // Logo: se già caricato/detected → NON creare draft logo (l'admin ha già il logo)
        const detectedLogo = cust.detectedLogoUrl || cust.logoUrl || null;
        const hasManualLogo = !!detectedLogo;
        const autoGeneratePending = autoGenerate ? true : false;
        // Brief context stringa per AI (passato ai draft come briefContext)
        const briefContext = buildBriefContext(cust);
        // RAG: top-k chunk knowledge del sito cliente iniettati nel briefContext
        // di TUTTI i draft (logo/card/flyer/website usano lo stesso contesto).
        const knowledge = getKnowledgeChunks(id);
        const queryText = [cust.sector, cust.activity].filter(Boolean).join(' ');
        const queryEmbedding = queryText ? await this.generateEmbedding(queryText) : null;
        const topChunks = topKChunks(knowledge, queryEmbedding?.data?.embedding ?? null, 3);
        const briefContextWithKnowledge = topChunks.length > 0
          ? `${briefContext}\nContenuto sito web:\n${topChunks.map((c) => c.chunk).join('\n')}`
          : briefContext;
        // Shape allineate a createEmpty*() factories (documentSchemas.ts).
        // Deve rimanere identico al path PROD api/index.ts auto-build.
        const drafts = [
          {
            type: 'logo',
            title: `Logo ${cust.businessName}`,
            data: {
              documentType: 'logo',
              title: `Logo ${cust.businessName}`,
              source: 'builder',
              builder: {
                primaryText: cust.businessName, tagline: cust.activity || '',
                iconType: 'lucide', iconGlyph: 'sparkles', iconShape: 'circle',
                primaryColor: '#01696F', secondaryColor: '#1a1a2e',
                fontFamily: 'Inter', layout: 'horizontal', icons: [],
                backgroundImage: detectedLogo, backgroundColor: null, gradientFill: false,
                decorativeElements: [], imagePrompt: null, textBackdrop: 'none',
                textColorMode: 'auto', textOffsetX: 0, textOffsetY: 0, textScale: 1,
                taglineOffsetX: 0, taglineOffsetY: 0, textPosition: 'overlay',
              },
              brief: cust.activity || '', briefContext: briefContextWithKnowledge, concepts: [], selected: -1,
              edits: { primaryText: cust.businessName, primaryColor: '#01696F', secondaryColor: '#1a1a2e' },
              aiStats: { totalCostUsd: '0', calls: {} },
              autoGeneratePending: !detectedLogo,
              createdAt: now, updatedAt: now,
            },
          },
          {
            type: 'businessCard',
            title: `Card ${cust.businessName}`,
            data: {
              documentType: 'businessCard',
              title: `Card ${cust.businessName}`,
              front: {
                name: cust.ownerName || '', title: cust.sector || '', company: cust.businessName,
                photoUrl: firstPhoto, logoUrl: detectedLogo, coverImageUrl: null,
                logoBackground: 'none', layout: 'left', useGrid: false,
              },
              back: {
                phone: String(contacts.phone || ''), email: String(contacts.email || ''),
                website: String(contacts.website || ''), address: String(contacts.address || ''),
                vatNumber: '', services: [], servicesLabel: 'Servizi', socials: [],
                qrPayload: String(contacts.website || ''), qrLabel: 'Scansiona per visitare il sito',
                qrSize: 'medium', coverImageUrl: null, useGrid: false,
              },
              style: {
                sizePreset: 'eu-85x55', bgColor: '#FFFFFF', textColor: '#1a1a2e',
                accentColor: '#01696F', fontFamily: 'Inter', borderStyle: 'accent-strip-left', fontScale: 1,
              },
              decorations: { pattern: null, opacity: 0.2, palette: { primary: '#01696F', secondary: '#E11D48', accent: null }, userLocked: false },
              grid: {}, backGrid: {},
              aiStats: { totalCostUsd: '0', calls: {} },
              autoGeneratePending,
              briefContext: briefContextWithKnowledge,
              createdAt: now, updatedAt: now,
            },
          },
          {
            type: 'flyer',
            title: `Flyer ${cust.businessName}`,
            data: {
              documentType: 'flyer',
              title: `Flyer ${cust.businessName}`,
              size: 'A5', orientation: 'portrait',
              content: {
                headline: cust.businessName, subheadline: cust.mood || '', body: cust.activity || '',
                cta: { label: 'Scopri di più', url: String(contacts.website || '') },
                heroImage: firstPhoto, qrPayload: '', qrLabel: '',
              },
              style: {
                bgColor: '#FFFFFF', textColor: '#1a1a2e', accentColor: '#01696F',
                layout: 'classic', fontFamily: 'Inter', fontScale: 1,
              },
              decorations: { pattern: null, opacity: 0.2, palette: { primary: '#01696F', secondary: '#E11D48', accent: null }, userLocked: false },
              sector: cust.sector || 'generico',
              aiStats: { totalCostUsd: '0', calls: {} },
              autoGeneratePending,
              briefContext: briefContextWithKnowledge,
              createdAt: now, updatedAt: now,
            },
          },
          {
            type: 'website',
            title: `Sito ${cust.businessName}`,
            data: {
              documentType: 'website',
              title: `Sito ${cust.businessName}`,
              brief: {
                businessName: cust.businessName || '',
                sector: String(cust.sector || ''),
                description: String(cust.activity || ''),
                tone: String(cust.mood || ''),
                target: String(cust.target || ''),
                pages: 'index',
                preferredColors: String(cust.preferredColors || ''),
                font: String(cust.font || ''),
                cta: '',
                sections: 'hero, chi_siamo, contatti',
                features: '',
                contacts: [mapAddress, contacts.phone, contacts.email].filter(Boolean).join(', '),
                address: mapAddress,
                phone: String(contacts.phone || ''),
                email: String(contacts.email || ''),
                socials: Array.isArray(cust.socials) ? cust.socials : [],
                mapsUrl: '',
                notes: '',
              },
              briefContext: briefContextWithKnowledge,
              html: '', css: '', js: '',
              framework: 'vanilla', style: 'modern', pages: ['index'],
              source: 'ai',
              aiStats: { totalCostUsd: '0', calls: {} },
              autoGeneratePending,
              createdAt: now, updatedAt: now,
            },
          },
        ];
        // Replace semantics: un rerun sostituisce le BOZZE esistenti degli
        // stessi tipi (i documenti non-BOZZA non vengono toccati).
        const createdTypes = drafts.filter((d) => !(d.type === 'logo' && hasManualLogo)).map((d) => d.type);
        docs = docs.filter((d) => !(d.customerId === id && d.status === 'BOZZA' && createdTypes.includes(d.documentType)));
        for (const d of drafts) {
          // Skip logo draft se admin ha già caricato un logo manuale/detected
          if (d.type === 'logo' && hasManualLogo) continue;
          const did = d.type + '_' + cryptoRandomId();
          // Draft FLAT (storage canonico locale): dominio al top level, meta
          // DOPO lo spread così id/userEmail/customerId/status/documentTheme
          // sovrascrivono eventuali omonimi dentro d.data.
          docs.push({
            ...d.data,
            id: did, userEmail: 'admin@gmail.com', customerId: id,
            documentType: d.type, title: d.title,
            status: 'BOZZA', documentTheme: 'corporate',
            createdAt: now, updatedAt: now,
          });
          ids.push(did);
        }
        try { lsSet('precisionQuote_documents:v1', docs); } catch (e) {
          return { error: 'Quota storage locale piena. Rimuovi vecchi documenti.' };
        }
        cust.status = 'done';
        cust.updatedAt = now;
        lsSet('pq_customers:v1', all);
        return { data: { customerId: id, createdDocuments: ids } };
      }
      return api('POST', `/customers/${id}/auto-build`, { adminEmail: 'admin@gmail.com', autoGenerate });
    },

    // ─── TB-019 intake ──────────────────────────────────

    async getIntakes(status) {
      if (IS_LOCAL) {
        const all = lsGet('pq_intakes:v1') || [];
        const filtered = status ? all.filter((i) => i.status === status) : all;
        return { data: filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) };
      }
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      params.set('adminEmail', 'admin@gmail.com');
      return api('GET', `/intakes?${params}`);
    },

    async getIntake(id) {
      if (IS_LOCAL) {
        const all = lsGet('pq_intakes:v1') || [];
        const intake = all.find((i) => i.id === id);
        return intake ? { data: intake } : { error: 'Brief non trovato' };
      }
      return api('GET', `/intakes/${id}?adminEmail=${encodeURIComponent('admin@gmail.com')}`);
    },

    async updateIntake(id, patch) {
      if (IS_LOCAL) {
        const all = lsGet('pq_intakes:v1') || [];
        const idx = all.findIndex((i) => i.id === id);
        if (idx < 0) return { error: 'Brief non trovato' };
        all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
        lsSet('pq_intakes:v1', all);
        return { data: all[idx] };
      }
      return api('PATCH', `/intakes/${id}`, { adminEmail: 'admin@gmail.com', ...patch });
    },

    // ─── TB-027 config pubblica ──────────────────────────
    async getConfig() {
      if (IS_LOCAL) {
        // LOCAL: leggiamo env client Vite. Default false (CRM admin-only).
        // WHITELABEL: impostare VITE_REGISTRATION_ENABLED=true in .env
        // IMPORTANTE: riavviare `npm run dev` dopo aver modificato .env
        // (Vite non reloada env a caldo).
        let enabled = false;
        try {
          if (typeof import.meta !== 'undefined' && import.meta.env) {
            const v = import.meta.env.VITE_REGISTRATION_ENABLED;
            enabled = v === true || v === 'true';
          }
        } catch { /* import.meta non disponibile */ }
        if (typeof console !== 'undefined') {
          console.log('[getConfig] VITE_REGISTRATION_ENABLED →', enabled);
        }
        return { data: { registrationEnabled: enabled } };
      }
      return api('GET', '/config');
    },
  };
}
