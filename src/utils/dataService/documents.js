// Documents/quotes CRUD + migration + templates.
// Storage canonico FLAT per logo/card/flyer in IS_LOCAL (gotcha §23): mai
// chiave `data`; QR/quote mantengono `data` legittimamente.
// `svc` è la facade dataService (riferimenti cross-modulo a call time).
import { IS_LOCAL, lsGet, lsSet, api, hydrateDocument, toApiDocument } from './core.js';
import { compressDocumentImages } from './images.js';

export function createDocumentsMethods(svc) {
  return {
    // ─── GET QUOTES ──────────────────────────────────
    async getQuotes(email, page = 1, limit = 50) {
      if (IS_LOCAL) {
        const all = lsGet('precisionQuote_quotes') || [];
        // Match by owner OR userEmail (owner used to be issuer display name).
        const filtered = all.filter(q => q.owner === email || q.userEmail === email);
        const start = (page - 1) * limit;
        return { quotes: filtered.slice(start, start + limit), total: filtered.length, page, limit };
      }
      const result = await api('GET', `/quotes?email=${encodeURIComponent(email)}&page=${page}&limit=${limit}`);
      if (result.error) return { quotes: [], total: 0, page, limit };
      return { quotes: Array.isArray(result) ? result : (result.data || []), total: result.total || 0, page, limit };
    },

    // ─── SAVE QUOTE ─────────────────────────────────
    async saveQuote(email, quote) {
      // Always stamp owner/userEmail as the account email so local
      // getQuotes filter works (toLegacyFormat used issuer.name as owner).
      const owned = { ...quote, owner: email, userEmail: email };
      if (IS_LOCAL) {
        const all = lsGet('precisionQuote_quotes') || [];
        const existing = all.findIndex(q => q.id === owned.id);
        if (existing >= 0) {
          all[existing] = { ...all[existing], ...owned };
        } else {
          all.push(owned);
        }
        lsSet('precisionQuote_quotes', all);
        return { success: true, ...owned };
      }
      const result = await api('POST', '/quotes', { email, quote: owned });
      if (result.error) return { success: false, error: result.error };
      return { success: true, ...owned };
    },

    // ─── DELETE QUOTE ───────────────────────────────
    async deleteQuote(quoteId, email) {
      if (IS_LOCAL) {
        const all = lsGet('precisionQuote_quotes') || [];
        lsSet('precisionQuote_quotes', all.filter(q => q.id !== quoteId));
        return { success: true };
      }
      const result = await api('DELETE', `/quotes/${quoteId}`, { email });
      if (result.error) return { success: false, error: result.error };
      return { success: true };
    },

    // ─── DOCUMENTS (QR, card, flyer, logo) ───────
    async getDocument(email, docId, documentType) {
      if (!email || !docId) return null;
      if (IS_LOCAL) {
        const all = lsGet('precisionQuote_documents:v1') || [];
        const doc = all.find(d => d.id === docId && d.userEmail === email && d.documentType === documentType);
        return doc ? hydrateDocument(doc) : null;
      }
      const qs = new URLSearchParams({ email });
      if (documentType) qs.set('type', documentType);
      const result = await api('GET', `/documents/${encodeURIComponent(docId)}?${qs.toString()}`);
      if (result.error) {
        return null;
      }
      const isRow = result && typeof result === 'object' && (result.id != null || result.documentType != null);
      const raw = isRow ? result : (result?.data || result);
      return hydrateDocument(raw);
    },

    async saveDocument(email, document) {
      if (IS_LOCAL) {
        const all = lsGet('precisionQuote_documents:v1') || [];
        const ownerEmail = email || document.userEmail;
        // Storage canonico locale FLAT per logo/card/flyer: un save envelope
        // (CRM "Genera bozze AI" via saveDraft) senza flatten lascerebbe nel
        // record sia i campi flat stale dell'existing sia il `data` fresco,
        // e CollectionView (che legge flat) mostrerebbe il contenuto vecchio.
        // QR/quote/altri tipi mantengono `data` (payload QR legittimo).
        const isFlatDomainType = document.documentType === 'logo'
          || document.documentType === 'businessCard'
          || document.documentType === 'flyer'
          || document.documentType === 'website';
        let incoming = document;
        if (isFlatDomainType && incoming.data && typeof incoming.data === 'object' && !Array.isArray(incoming.data)) {
          incoming = { ...incoming, ...incoming.data };
          delete incoming.data;
        }
        // Preserva customerId dal documento esistente se il caller non lo passa
        // (editor che salvano senza conoscere il customerId).
        const existing = all.find((d) => d.id === incoming.id);
        const toStore = await compressDocumentImages({
          ...existing,
          ...incoming,
          userEmail: ownerEmail,
          customerId: incoming.customerId ?? existing?.customerId,
          // Sempre "now": senza bump il CRM auto-build risalva con lo stesso
          // updatedAt del draft e l'editor (LogoEditor reset effect) non
          // rileva l'aggiornamento → UI stale (background AI perso).
          updatedAt: new Date().toISOString(),
        });
        // Rimuove anche il rimasuglio envelope stale ereditato dall'existing.
        if (isFlatDomainType) delete toStore.data;
        const isNew = !all.some(d => d.id === toStore.id);
        const owned = all.filter(d => d.userEmail === ownerEmail);
        const others = all.filter(d => d.userEmail !== ownerEmail);
        const updated = [toStore, ...owned.filter(d => d.id !== toStore.id), ...others];
        const write = lsSet('precisionQuote_documents:v1', updated);
        if (write && write.error) {
          return { success: false, error: write.error };
        }
        if (isNew) {
          // fire-and-forget; failure here is non-fatal (best-effort counting)
          svc.incrementDocumentCount(ownerEmail).catch(() => {});
        }
        return { success: true, data: toStore };
      }
      // Production: wrap flat editor payload → { id, documentType, title, data }
      // so API never stores null for logo/card/flyer content.
      const apiDoc = toApiDocument({ ...document, userEmail: email || document.userEmail });
      const result = await api('POST', '/documents', { email, document: apiDoc });
      if (result.error) {
        console.warn('[doc-save] POST /documents fallito', { id: apiDoc.id, type: apiDoc.documentType, email, error: result.error, status: result.status });
        return { success: false, error: result.error };
      }
      const row = result.data || result;
      return { success: true, data: hydrateDocument(row) };
    },

    // Solo i tipi "editor" con stato complesso sono duplicabili.
    // qrCode: è solo un payload, duplicare = rifare → no.
    // generatedImage: sono asset AI, l'originale rimane in collezione → no (l'utente
    // può già scaricare e ri-importare se vuole).
    // quote: ha numerazione + cliente → duplicazione manuale dall'interno editor.
    canDuplicate(doc) {
      if (!doc || !doc.documentType) return false;
      return doc.documentType === 'businessCard'
        || doc.documentType === 'logo'
        || doc.documentType === 'flyer'
        || doc.documentType === 'website';
    },

    async duplicateDocument(doc, userEmail) {
      if (!doc || !doc.id) return { success: false, error: 'Documento mancante' };
      if (!userEmail) return { success: false, error: 'Email mancante' };
      if (!this.canDuplicate(doc)) {
        return { success: false, error: 'Tipo non duplicabile' };
      }
      const baseTitle = doc.title || 'Senza titolo';
      const newDoc = {
        ...doc,
        id: `dup_${doc.id}_${Date.now()}`,
        title: `${baseTitle} (copia)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Mantieni lo stesso userEmail, NON toccare userEmail qui (dataService.saveDocument lo aggiunge)
      };
      const result = await this.saveDocument(userEmail, newDoc);
      return result;
    },

    async getDocuments(email, documentType) {
      if (IS_LOCAL) {
        const all = lsGet('precisionQuote_documents:v1') || [];
        let filtered = all.filter(d => d.userEmail === email);
        if (documentType) {
          filtered = filtered.filter(d => d.documentType === documentType);
        }
        // Idrata anche in locale: i draft CRM sono salvati envelope
        // (data.builder/...) mentre CollectionView legge flat (doc.builder).
        // I doc flat degli editor passano invariati (branch hasFlatDomain).
        const hydrated = filtered.map(hydrateDocument);
        return { documents: hydrated };
      }
      const qs = new URLSearchParams({ email });
      if (documentType) qs.set('type', documentType);
      const result = await api('GET', `/documents?${qs.toString()}`);
      if (result.error) return { documents: [] };
      const rows = Array.isArray(result) ? result : (result.data || []);
      // Rehydrate DB rows (data jsonb) → flat editor shape.
      return { documents: rows.map(hydrateDocument) };
    },

    // ─── MIGRATION (phase 6) ───────────────────────
    // Copy legacy quotes from `precisionQuote_quotes` to the unified
    // `precisionQuote_documents:v1` storage with `documentType='quote'`.
    // Idempotent: uses stable `migrate_<oldid>` IDs (no timestamp) so
    // re-runs never duplicate. Flag `pq_migration_v1_done_<email>` skips
    // already-migrated users. On `QuotaExceeded` the function throws so
    // the caller can decide (e.g. AppShell shows a recovery toast).
    async migrateLegacyQuotes(email) {
      if (!email) return { migrated: 0, skipped: true };
      if (IS_LOCAL) {
        const flag = `pq_migration_v1_done_${email}`;
        if (localStorage.getItem(flag)) return { migrated: 0, skipped: true };
        const legacy = lsGet('precisionQuote_quotes') || [];
        const mine = legacy.filter((q) => q && q.owner === email);
        const docs = lsGet('precisionQuote_documents:v1') || [];
        const existingIds = new Set(docs.map((d) => d && d.id));
        let migrated = 0;
        for (const q of mine) {
          const newId = `migrate_${q.id}`;
          if (existingIds.has(newId)) continue;
          docs.push({
            ...q,
            id: newId,
            userEmail: email,
            documentType: 'quote',
            data: null,
          });
          migrated += 1;
        }
        // Direct setItem (not lsSet) so QuotaExceeded propagates and the
        // caller can show a recovery toast instead of silently losing data.
        localStorage.setItem('precisionQuote_documents:v1', JSON.stringify(docs));
        localStorage.setItem(flag, '1');
        return { migrated, skipped: false };
      }
      // Production: DB was already migrated in phase 1 (rename
      // `quotes` → `documents`). Just mark flag for consistency.
      try { localStorage.setItem(`pq_migration_v1_done_${email}`, '1'); } catch {}
      return { migrated: 0, skipped: true };
    },

    async deleteDocument(documentId, email) {
      if (IS_LOCAL) {
        const all = lsGet('precisionQuote_documents:v1') || [];
        lsSet('precisionQuote_documents:v1', all.filter(d => d.id !== documentId));
        return { success: true };
      }
      const result = await api('DELETE', `/documents/${documentId}`, { email });
      if (result.error && result.error === 'Documento non trovato') {
        return { success: true };
      }
      if (result.error) return { success: false, error: result.error };
      return { success: true };
    },

    async cleanupGhostDocuments() {
      if (IS_LOCAL) {
        const all = lsGet('precisionQuote_documents:v1') || [];
        const before = all.length;
        const kept = all.filter(d => d.data != null || d.front != null || d.builder != null || d.content != null);
        lsSet('precisionQuote_documents:v1', kept);
        return { deleted: before - kept.length };
      }
      const result = await api('POST', '/documents/cleanup-ghosts', { adminEmail: 'admin@gmail.com' });
      if (result.error) return { error: result.error };
      return result;
    },

    // ─── TEMPLATES ──────────────────────────────────
    async getTemplates(email) {
      if (IS_LOCAL) {
        const all = lsGet('precisionQuote_quotes') || [];
        return { quotes: all.filter(q => q.isTemplate && (q.isGlobal || q.owner === email)) };
      }
      const result = await api('GET', `/quotes/templates?email=${encodeURIComponent(email)}`);
      if (result.error) return { quotes: [] };
      return { quotes: Array.isArray(result) ? result : [] };
    },
  };
}
