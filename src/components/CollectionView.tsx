import React, { useState, useMemo, useEffect, useContext, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import Icon from './Icon';
import ConfirmModal from './ConfirmModal';
import { AppContext, AuthContext } from '../contexts';
import dataService from '../utils/dataService';
import type { DocumentType } from '../utils/documentSchemas';
import { buildPreviewSvg } from '../utils/docPreviewSvg';
import { formatAiStatsCompact, type AiStats, aiStatsTotalCalls, documentAiStatsTitle } from '../utils/aiStats';
import { useToast } from '../hooks/useToast';
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus';


type TabId = 'all' | 'quote' | 'qrCode' | 'businessCard' | 'flyer' | 'logo' | 'generatedImage';

interface TabDef {
  id: TabId;
  label: string;
  type?: DocumentType;
}

const TABS: TabDef[] = [
  { id: 'all', label: 'Tutti' },
  { id: 'quote', label: 'Preventivi', type: 'quote' },
  { id: 'qrCode', label: 'QR Code', type: 'qrCode' },
  { id: 'businessCard', label: 'Bigliettini', type: 'businessCard' },
  { id: 'flyer', label: 'Volantini', type: 'flyer' },
  { id: 'logo', label: 'Loghi', type: 'logo' },
  { id: 'generatedImage', label: 'Immagini Generate', type: 'generatedImage' },
];

const TYPE_ICONS: Record<DocumentType, string> = {
  quote: 'doc',
  qrCode: 'qr-code',
  businessCard: 'id-card',
  flyer: 'file-text',
  logo: 'sparkle',
  generatedImage: 'image',
};

const TYPE_LABELS: Record<DocumentType, string> = {
  quote: 'Preventivo',
  qrCode: 'QR Code',
  businessCard: 'Bigliettino',
  flyer: 'Volantino',
  logo: 'Logo',
  generatedImage: 'Immagine AI',
};

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

const QUOTE_STATUSES = ['BOZZA', 'INVIATO', 'ACCETTATO', 'RIFIUTATO', 'ARCHIVIATO'];

const SORT_OPTIONS: { value: 'updated' | 'created' | 'title' | 'type'; label: string }[] = [
  { value: 'updated', label: 'Data modifica ↓' },
  { value: 'created', label: 'Data creazione ↓' },
  { value: 'title', label: 'Titolo A–Z' },
  { value: 'type', label: 'Tipo' },
];

const DATE_OPTIONS: { value: 'all' | 'week' | 'month' | 'year'; label: string }[] = [
  { value: 'all', label: 'Tutto' },
  { value: 'week', label: 'Questa settimana' },
  { value: 'month', label: 'Questo mese' },
  { value: 'year', label: "Quest'anno" },
];

// Phase 6, REQ-004 cross-type search. Substring match (no regex
// escape needed) over the per-type "content" fields. Title is searched
// in all types; other fields are type-specific.
function getSearchHaystack(doc: any): string {
  const parts: string[] = [];
  if (doc.title) parts.push(String(doc.title));
  if (doc.documentType === 'quote') {
    if (doc.client) parts.push(typeof doc.client === 'string' ? doc.client : doc.client.name || '');
    if (doc.status) parts.push(String(doc.status));
  } else if (doc.documentType === 'businessCard') {
    if (doc.front?.name) parts.push(String(doc.front.name));
    if (doc.front?.title) parts.push(String(doc.front.title));
    if (doc.front?.company) parts.push(String(doc.front.company));
    if (doc.back?.email) parts.push(String(doc.back.email));
  } else if (doc.documentType === 'flyer') {
    if (doc.content?.headline) parts.push(String(doc.content.headline));
  } else if (doc.documentType === 'qrCode') {
    if (doc.data?.payload) parts.push(String(doc.data.payload));
  } else if (doc.documentType === 'logo') {
    if (doc.builder?.primaryText) parts.push(String(doc.builder.primaryText));
    if (doc.builder?.tagline) parts.push(String(doc.builder.tagline));
  }
  if (doc.id) parts.push(String(doc.id));
  return parts.join(' ').toLowerCase();
}

function getDocTimestamp(doc: any, field: 'updated' | 'created'): number {
  const raw = field === 'updated' ? doc.updatedAt : doc.createdAt;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function getDocTitle(doc: any): string {
  if (doc.title) return String(doc.title);
  // Cards often saved without title field filled — fall back to person name.
  if (doc.documentType === 'businessCard' && doc.front?.name) {
    return `Bigliettino ${doc.front.name}`;
  }
  if (doc.documentType === 'logo' && doc.builder?.primaryText) {
    return String(doc.builder.primaryText);
  }
  if (doc.documentType === 'flyer' && doc.content?.headline) {
    return String(doc.content.headline);
  }
  if (doc.documentType === 'qrCode' && doc.data?.payload) {
    return String(doc.data.payload).slice(0, 40);
  }
  return String(doc.id || 'Senza titolo');
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function formatRelative(iso: string | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diffMs = Date.now() - t;
  if (diffMs < 0) return '';
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'ora';
  if (min < 60) return `${min}m fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h fa`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}g fa`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} mesi fa`;
  return `${Math.floor(mo / 12)} anni fa`;
}

function isWithinDateFilter(iso: string | undefined, filter: 'all' | 'week' | 'month' | 'year'): boolean {
  if (filter === 'all') return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  const now = Date.now();
  const ranges = {
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
  };
  return now - t <= ranges[filter];
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(h);
  }, [value, delayMs]);
  return debounced;
}

interface CollectionViewProps {
  activeId?: string;
}

export default function CollectionView({ activeId }: CollectionViewProps) {
  const ctx = useContext(AppContext) as any;
  const { user } = useContext(AuthContext);
  const { addToast } = useToast();
  const userEmail = user?.email || '';
  const tier: 'free' | 'unlocked' | 'loading' = ctx?.tier ?? 'loading';
  // Phase 7, preventivi are admin-only. Non-admin users can still
  // create QR Code, bigliettini, loghi. The Collection view hides
  // the "Preventivi" tab for them and the empty state copy adapts.
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 200);
  const [statusFilter, setStatusFilter] = useState<string>('TUTTI');
  const [dateFilter, setDateFilter] = useState<'all' | 'week' | 'month' | 'year'>('all');
  const [sort, setSort] = useState<'updated' | 'created' | 'title' | 'type'>('updated');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Re-fetch when user changes or refreshDocuments is invoked.
  useEffect(() => {
    if (!userEmail) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      dataService.getDocuments(userEmail).catch(() => ({ documents: [] })),
      // Legacy quote fallback so a pre-migration quote still shows
      // in the "Preventivi" tab (REQ-012, AC-015).
      dataService.getQuotes(userEmail).catch(() => ({ quotes: [] })),
    ]).then(([docsRes, quotesRes]: any) => {
      if (cancelled) return;
      const docs: any[] = Array.isArray(docsRes?.documents) ? docsRes.documents : [];
      const legacy: any[] = Array.isArray(quotesRes?.quotes) ? quotesRes.quotes : [];
      // Merge: legacy quotes that don't have a migrated counterpart
      // remain visible. Migrated ones have ids starting with `migrate_`.
      const migratedIds = new Set(
        docs.filter((d) => d.documentType === 'quote').map((d) => d.id),
      );
      const mergedDocs = [...docs];
      for (const q of legacy) {
        // Skip if already represented in unified storage (by id match OR
        // by legacyId embed).
        if (migratedIds.has(q.id)) continue;
        if (migratedIds.has(`migrate_${q.id}`)) continue;
        mergedDocs.push({ ...q, documentType: 'quote', data: null });
      }
      // Deduplicate by id: keep the first occurrence (unified docs are
      // merged first, so they win over legacy entries). Duplicate ids
      // break React keys and can leave stale DOM nodes when switching
      // per-type tabs, which is what happens when production /quotes
      // accidentally returns non-quote documents (see server fix).
      const seenIds = new Set<string>();
      const uniqueDocs: any[] = [];
      for (const d of mergedDocs) {
        if (!d || !d.id || seenIds.has(d.id)) continue;
        seenIds.add(d.id);
        uniqueDocs.push(d);
      }
      // Phase 7 hotfix: non-admin users cannot see preventivi at all
      // (not in the "Tutti" tab, not in any other tab). Phase 5 made
      // the quote editor admin-only, so any quote in a non-admin's
      // collection is either legacy data or admin-shared content, and
      // we want it completely out of their view. The `quote` tab is
      // already hidden for non-admin in the TABS filter below; the
      // `mergedDocs` filter here removes the cards from "Tutti" too.
      // Admin users keep everything as before.
      const visibleDocs = isAdmin
        ? uniqueDocs
        : uniqueDocs.filter((d) => d.documentType !== 'quote');
      setDocuments(visibleDocs);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [userEmail, refreshKey, ctx?.documentsVersion, isAdmin]);

  // Refresh when collection re-mounts or context changes.
  useEffect(() => {
    setRefreshKey((k) => k + 1);
  }, [ctx?.documentsVersion]);

  useRefetchOnFocus(() => { ctx?.refreshDocuments?.(); });

  const counts = useMemo(() => {
    const c: Record<TabId, number> = { all: documents.length, quote: 0, qrCode: 0, businessCard: 0, flyer: 0, logo: 0, generatedImage: 0 };
    for (const d of documents) {
      if (d && d.documentType && c[d.documentType as DocumentType] !== undefined) {
        c[d.documentType as DocumentType] += 1;
      }
    }
    return c;
  }, [documents]);

  const filtered = useMemo(() => {
    const tab = TABS.find((t) => t.id === activeTab);
    let list = documents.filter((d) => d && d.id);
    if (activeTab !== 'all') {
      list = list.filter((d) => String(d.documentType || '').trim() === activeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) => getSearchHaystack(d).includes(q));
    }
    if (activeTab === 'quote' && statusFilter !== 'TUTTI') {
      list = list.filter((d) => (d.status || 'BOZZA').toUpperCase() === statusFilter);
    }
    if (dateFilter !== 'all') {
      list = list.filter((d) => isWithinDateFilter(d.createdAt, dateFilter));
    }
    list.sort((a, b) => {
      if (sort === 'updated') return getDocTimestamp(b, 'updated') - getDocTimestamp(a, 'updated');
      if (sort === 'created') return getDocTimestamp(b, 'created') - getDocTimestamp(a, 'created');
      if (sort === 'title') return getDocTitle(a).localeCompare(getDocTitle(b));
      if (sort === 'type') return String(a.documentType).localeCompare(String(b.documentType));
      return 0;
    });
    return list;
  }, [documents, activeTab, search, statusFilter, dateFilter, sort]);

  const onOpen = (doc: any) => {
    if (ctx?.openDocument) ctx.openDocument(doc);
    else {
      addToast('error', 'Apertura documento non disponibile');
    }
  };

  const onConfirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    const isLegacy = !target.documentType || !target.userEmail;
    const promise = isLegacy
      ? dataService.deleteQuote(target.id, userEmail)
      : dataService.deleteDocument(target.id, userEmail);
    promise.then(() => {
      addToast('success', 'Documento eliminato');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(target.id);
        return next;
      });
      if (ctx?.refreshDocuments) ctx.refreshDocuments();
      setRefreshKey((k) => k + 1);
    }).catch(() => {
      addToast('error', 'Eliminazione fallita');
    });
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(filtered.map((d) => d.id)));
  }, [filtered]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const onConfirmBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setBulkDeleteOpen(false);
      return;
    }
    setBulkDeleteOpen(false);
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      const doc = documents.find((d) => d.id === id);
      if (!doc) {
        fail += 1;
        continue;
      }
      const isLegacy = !doc.documentType || !doc.userEmail;
      try {
        if (isLegacy) await dataService.deleteQuote(id, userEmail);
        else await dataService.deleteDocument(id, userEmail);
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    setSelectedIds(new Set());
    if (ok > 0) addToast('success', ok === 1 ? '1 documento eliminato' : `${ok} documenti eliminati`);
    if (fail > 0) addToast('error', `${fail} eliminazioni fallite`);
    if (ctx?.refreshDocuments) ctx.refreshDocuments();
    setRefreshKey((k) => k + 1);
  }, [selectedIds, documents, userEmail, addToast, ctx]);

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, tabId: TabId) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setActiveTab(tabId);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const idx = TABS.findIndex((t) => t.id === activeTab);
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const nextIdx = (idx + delta + TABS.length) % TABS.length;
      setActiveTab(TABS[nextIdx].id);
    }
  };

  const startRename = useCallback((doc: any) => {
    setRenamingId(doc.id);
    setRenameValue(getDocTitle(doc));
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }, []);

  const commitRename = useCallback(async () => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    const doc = documents.find((d) => d.id === renamingId);
    if (!doc) { setRenamingId(null); return; }
    const newTitle = renameValue.trim();
    if (newTitle === getDocTitle(doc)) { setRenamingId(null); return; }
    const updated = { ...doc, title: newTitle, updatedAt: new Date().toISOString() };
    const result = await dataService.saveDocument(userEmail, updated);
    if (result?.error) {
      addToast('error', 'Rinomina fallita');
    } else {
      addToast('success', 'Documento rinominato');
      if (ctx?.refreshDocuments) ctx.refreshDocuments();
      setRefreshKey((k) => k + 1);
    }
    setRenamingId(null);
  }, [renamingId, renameValue, documents, userEmail, addToast, ctx]);

  const onDownloadImage = useCallback((doc: any) => {
    if (!doc.imageData) return;
    const ext = doc.imageData.includes('image/png') ? '.png' : '.jpg';
    const safe = (doc.title || 'image').replace(/[^a-zA-Z0-9\s\-]/g, '').replace(/\s+/g, '_');
    downloadDataUrl(doc.imageData, `${safe}${ext}`);
  }, []);

  const onBulkDownloadImages = useCallback(async () => {
    const imageDocs = documents.filter((d) => selectedIds.has(d.id) && d.documentType === 'generatedImage' && d.imageData);
    if (imageDocs.length === 0) return;
    addToast('info', `Preparazione ZIP: ${imageDocs.length} immagini...`);
    try {
      const zip = new JSZip();
      const seen = new Set<string>();
      for (const doc of imageDocs) {
        const base64 = doc.imageData.split(',')[1] || '';
        const ext = doc.imageData.includes('image/png') ? '.png' : '.jpg';
        let name = (doc.title || 'image').replace(/[^a-zA-Z0-9\s\-]/g, '').replace(/\s+/g, '_');
        if (seen.has(name)) name = `${name}_${doc.id.slice(-6)}`;
        seen.add(name);
        zip.file(`${name}${ext}`, base64, { base64: true });
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `immagini_ai_${new Date().toISOString().slice(0, 10)}.zip`);
      addToast('success', `${imageDocs.length} immagini scaricate`);
    } catch (err: any) {
      addToast('error', 'Errore durante la creazione del ZIP');
    }
  }, [documents, selectedIds, addToast]);

  return (
    <div className="collection-view" data-testid="collection-view">
      <div className="collection-head">
        <p>Documenti salvati</p>
        <h2>Collection</h2>
        <span>
          {isAdmin
            ? 'Tutti i tuoi documenti: preventivi, QR, bigliettini e loghi.'
            : 'Tutti i tuoi documenti: QR, bigliettini e loghi.'}
        </span>
      </div>

      <div role="tablist" aria-label="Tipo documento" className="collection-tabs">
        {/* Phase 7: preventivi are admin-only. The "Preventivi" tab is
            hidden for non-admin in all cases (no legacy fallback, no
            read-only access). The TABS filter below makes this
            unconditional. The header copy above reflects it. */}
        {TABS.filter((t) => isAdmin || t.type !== 'quote').map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={activeTab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={activeTab === t.id ? 0 : -1}
            className={activeTab === t.id ? 'collection-tab active' : 'collection-tab'}
            onClick={() => setActiveTab(t.id)}
            onKeyDown={(e) => onTabKeyDown(e, t.id)}
          >
            {t.label} <span className="count" data-testid={`count-${t.id}`}>{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="collection-loading" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          Caricamento documenti…
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          <div className="collection-toolbar" style={{
            display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px', alignItems: 'center',
          }}>
            <input
              type="text"
              placeholder="Cerca per titolo, cliente, contenuto..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              data-testid="collection-search"
              aria-label="Cerca documenti"
              style={{
                flex: '1 1 200px', padding: '10px 14px', border: '2px solid var(--line)',
                borderRadius: '10px', fontSize: '.85rem', outline: 'none', minWidth: '160px',
              }}
            />
            {activeTab === 'quote' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                data-testid="collection-status"
                aria-label="Filtra per stato"
                style={{
                  padding: '10px 14px', border: '2px solid var(--line)', borderRadius: '10px',
                  fontSize: '.85rem', background: 'var(--surface)', outline: 'none', color: 'var(--ink)',
                }}
              >
                <option value="TUTTI">Tutti gli stati</option>
                {QUOTE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              data-testid="collection-date"
              aria-label="Filtra per data"
              style={{
                padding: '10px 14px', border: '2px solid var(--line)', borderRadius: '10px',
                fontSize: '.85rem', background: 'var(--surface)', outline: 'none', color: 'var(--ink)',
              }}
            >
              {DATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              data-testid="collection-sort"
              aria-label="Ordina"
              style={{
                padding: '10px 14px', border: '2px solid var(--line)', borderRadius: '10px',
                fontSize: '.85rem', background: 'var(--surface)', outline: 'none', color: 'var(--ink)',
              }}
            >
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {filtered.length > 0 && (
              <div className="collection-bulk-actions" data-testid="collection-bulk-actions">
                <button type="button" className="btn-secondary" onClick={selectAllFiltered} data-testid="collection-select-all">
                  Seleziona visibili ({filtered.length})
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <button type="button" className="btn-secondary" onClick={clearSelection} data-testid="collection-clear-selection">
                      Deseleziona
                    </button>
                    {activeTab === 'generatedImage' && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={onBulkDownloadImages}
                        data-testid="collection-bulk-download"
                      >
                        Scarica ZIP ({selectedIds.size})
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => setBulkDeleteOpen(true)}
                      data-testid="collection-bulk-delete"
                    >
                      Elimina {selectedIds.size}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyState tabId={activeTab} totalCount={documents.length} onOpen={onOpen} ctx={ctx} isAdmin={isAdmin} />
          ) : (
            <div className="collection-grid" data-testid="collection-grid" data-active-tab={activeTab}>
              {filtered.map((doc) => {
                const type = doc.documentType as DocumentType;
                const title = truncate(getDocTitle(doc), 50);
                const meta = `${TYPE_LABELS[type] || 'Documento'} · ${formatRelative(doc.updatedAt)}`;
                const isActive = activeId && doc.id === activeId;
                const isSelected = selectedIds.has(doc.id);
                return (
                  <article
                    key={doc.id}
                    className={`collection-card${isActive ? ' active' : ''}${isSelected ? ' selected' : ''}`}
                    data-type={type}
                    data-document-type={doc.documentType}
                    data-testid={`card-${doc.id}`}
                  >
                    <div className="card-top">
                      <label className="collection-select-label" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(doc.id)}
                          aria-label={`Seleziona ${title}`}
                          data-testid={`select-${doc.id}`}
                        />
                      </label>
                      {type === 'generatedImage' && doc.imageData ? (
                        <img
                          src={doc.imageData}
                          alt={title}
                          className="collection-thumb"
                          style={{
                            width: '100%', height: '120px', objectFit: 'contain',
                            background: '#f3f4f6',
                            borderRadius: '8px', marginBottom: '8px',
                          }}
                        />
                      ) : (type === 'logo' || type === 'businessCard' || type === 'flyer' || type === 'quote') && buildPreviewSvg(doc) ? (
                        <div
                          className="collection-preview-svg"
                          data-testid={`preview-${doc.id}`}
                          style={{
                            width: '100%',
                            height:
                              type === 'businessCard' ? '110px'
                              : type === 'flyer' ? '160px'
                              : type === 'quote' ? '150px'
                              : '120px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background:
                              type === 'businessCard' || type === 'quote' ? '#fff' : 'transparent',
                            borderRadius: '8px',
                            marginBottom: '8px',
                            overflow: 'hidden',
                            border:
                              type === 'businessCard' || type === 'quote' ? '1px solid #e5e7eb' : 'none',
                          }}
                          dangerouslySetInnerHTML={{
                            __html: buildPreviewSvg(doc),
                          }}
                        />
                      ) : (
                        <span className={`doc-icon doc-icon-${type}`} aria-hidden="true">
                          <Icon name={TYPE_ICONS[type] || 'doc'} />
                        </span>
                      )}
                      {tier === 'free' && (
                        <span className="tier-badge tier-free" data-testid="tier-free">Free</span>
                      )}
                      {tier === 'unlocked' && (
                        <span className="tier-badge tier-pro" data-testid="tier-pro">Pro</span>
                      )}
                    </div>
                    {renamingId === doc.id ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className="collection-rename-input"
                        data-testid={`rename-input-${doc.id}`}
                        style={{
                          width: '100%', padding: '4px 8px', fontSize: '.85rem',
                          border: '2px solid var(--accent)', borderRadius: '6px',
                          outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    ) : (
                      <h3
                        className="card-title"
                        title={`${getDocTitle(doc)} (clicca per rinominare)`}
                        onClick={() => startRename(doc)}
                        style={{ cursor: 'text' }}
                        data-testid={`title-${doc.id}`}
                      >{title}</h3>
                    )}
                    <p className="card-meta">{meta}</p>
                    {(() => {
                      const stats: AiStats | undefined = (doc as any).aiStats;
                      const compact = formatAiStatsCompact(stats);
                      const hasCalls = aiStatsTotalCalls(stats) > 0;
                      const showForType = ['businessCard', 'logo', 'flyer', 'quote'].includes(type);
                      if (!showForType) return null;
                      return (
                        <p
                          className="card-ai-stats"
                          data-testid={`ai-stats-${doc.id}`}
                          title={documentAiStatsTitle(stats)}
                          style={{
                            margin: '2px 0 6px',
                            fontSize: '.72rem',
                            color: 'var(--text-muted, #6b7280)',
                            display: 'flex',
                            gap: '4px',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                          }}
                        >
                          <span aria-hidden="true">🤖</span>
                          <span>{compact || 'Nessun costo AI'}</span>
                        </p>
                      );
                    })()}
                    <div className="card-actions">
                      {type !== 'generatedImage' && (
                        <>
                          <button
                            type="button"
                            onClick={() => onOpen(doc)}
                            data-testid={`open-${doc.id}`}
                            title="Apri"
                          >
                            Apri
                          </button>
                          {dataService.canDuplicate(doc) && (
                            <button
                              type="button"
                              onClick={() => dataService.duplicateDocument(doc, userEmail).then(() => {
                                if (ctx?.refreshDocuments) ctx.refreshDocuments();
                                setRefreshKey((k) => k + 1);
                                if (typeof ctx.duplicate === 'function') ctx.duplicate(doc);
                                addToast('success', 'Documento duplicato');
                              }).catch(() => {
                                addToast('error', 'Duplicazione fallita');
                              })}
                              data-testid={`duplicate-${doc.id}`}
                              title="Duplica"
                            >
                              <Icon name="copy" />Duplica
                            </button>
                          )}
                        </>
                      )}
                      {type === 'generatedImage' && doc.imageData && (
                        <button
                          type="button"
                          onClick={() => onDownloadImage(doc)}
                          data-testid={`download-${doc.id}`}
                          title="Scarica immagine"
                        >
                          <Icon name="download" />Scarica
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => setDeleteTarget(doc)}
                        data-testid={`delete-${doc.id}`}
                      >
                        <Icon name="trash" />Elimina
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Elimina documento"
        message={deleteTarget ? `Stai per eliminare «${getDocTitle(deleteTarget)}». Non potrai recuperarlo.` : ''}
        confirmLabel="Elimina"
        confirmClass="danger"
        onConfirm={onConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmModal
        open={bulkDeleteOpen}
        title="Elimina documenti selezionati"
        message={`Stai per eliminare ${selectedIds.size} document${selectedIds.size === 1 ? 'o' : 'i'} visibili/selezionati. Non potrai recuperarli.`}
        confirmLabel={`Elimina ${selectedIds.size}`}
        confirmClass="danger"
        onConfirm={onConfirmBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </div>
  );
}

function EmptyState({ tabId, totalCount, onOpen, ctx, isAdmin }: { tabId: TabId; totalCount: number; onOpen: (d: any) => void; ctx: any; isAdmin: boolean }) {
  if (totalCount > 0) {
    return (
      <div className="collection-empty" data-testid="empty-search" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
        Nessun risultato corrisponde ai filtri.
      </div>
    );
  }
  // Phase 7, non-admin users can't create preventivi, so the
  // generic empty state offers a QR code or a logo instead.
  const emptyMessages: Record<TabId, { title: string; cta: string; docType: DocumentType | null }> = isAdmin
    ? {
        all: { title: 'Nessun documento ancora', cta: 'Crea un preventivo', docType: 'quote' },
        quote: { title: 'Nessun preventivo ancora', cta: 'Crea un preventivo', docType: 'quote' },
        qrCode: { title: 'Nessun QR Code ancora', cta: 'Crea un QR Code', docType: 'qrCode' },
        businessCard: { title: 'Nessun bigliettino ancora', cta: 'Crea un bigliettino', docType: 'businessCard' },
        flyer: { title: 'Nessun volantino ancora', cta: 'Crea un volantino', docType: 'flyer' },
        logo: { title: 'Nessun logo ancora', cta: 'Crea un logo', docType: 'logo' },
        generatedImage: { title: 'Nessuna immagine AI ancora', cta: 'Genera un\'immagine', docType: null },
      }
    : {
        all: { title: 'Nessun documento ancora', cta: 'Crea un QR Code', docType: 'qrCode' },
        quote: { title: 'Nessun preventivo ancora', cta: 'Crea un preventivo', docType: 'quote' },
        qrCode: { title: 'Nessun QR Code ancora', cta: 'Crea un QR Code', docType: 'qrCode' },
        businessCard: { title: 'Nessun bigliettino ancora', cta: 'Crea un bigliettino', docType: 'businessCard' },
        flyer: { title: 'Nessun volantino ancora', cta: 'Crea un volantino', docType: 'flyer' },
        logo: { title: 'Nessun logo ancora', cta: 'Crea un logo', docType: 'logo' },
        generatedImage: { title: 'Nessuna immagine AI ancora', cta: 'Genera un\'immagine', docType: null },
      };
  const msg = emptyMessages[tabId];
  // The "quote" tab is hidden for non-admin via the TABS filter above,
  // so it never reaches here. Guard anyway.
  const cta = !isAdmin && tabId === 'quote'
    ? { title: msg.title, cta: 'Crea un QR Code', docType: 'qrCode' as DocumentType | null }
    : msg;
  return (
    <div className="collection-empty" data-testid="empty-tab" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 20px', textAlign: 'center',
    }}>
      <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.4 }}>
        <Icon name={(cta.docType && TYPE_ICONS[cta.docType]) || 'doc'} />
      </div>
      <h3 style={{ margin: '0 0 8px', color: 'var(--ink)' }}>{cta.title}</h3>
      <p style={{ margin: '0 0 24px', color: 'var(--muted)', fontSize: '.9rem' }}>
        Crea il tuo primo documento dalla sidebar.
      </p>
      <button
        type="button"
        onClick={() => {
          if (tabId === 'quote' && !isAdmin) {
            // Non-admin users land on the QR editor instead
            if (ctx?.setView) ctx.setView('qr');
            return;
          }
          if (ctx?.setView) ctx.setView(tabId === 'quote' ? 'editor' : tabId);
        }}
        style={{
          padding: '12px 24px', borderRadius: '12px', background: 'var(--accent)',
          color: '#fff', fontWeight: 700, fontSize: '.9rem', border: 'none',
          cursor: 'pointer',
        }}
      >{cta.cta}</button>
    </div>
  );
}
