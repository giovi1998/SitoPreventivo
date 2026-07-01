import React, { useState, useMemo, useEffect, useContext, useRef, useCallback } from 'react';
import Icon from './Icon';
import ConfirmModal from './ConfirmModal';
import { AppContext, AuthContext } from '../contexts';
import dataService from '../utils/dataService';
import type { DocumentType } from '../utils/documentSchemas';
import { useToast } from '../hooks/useToast';

type TabId = 'all' | 'quote' | 'qrCode' | 'businessCard' | 'flyer' | 'logo';

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
];

const TYPE_ICONS: Record<DocumentType, string> = {
  quote: 'doc',
  qrCode: 'qr-code',
  businessCard: 'id-card',
  flyer: 'file-text',
  logo: 'sparkle',
};

const TYPE_LABELS: Record<DocumentType, string> = {
  quote: 'Preventivo',
  qrCode: 'QR Code',
  businessCard: 'Bigliettino',
  flyer: 'Volantino',
  logo: 'Logo',
};

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
  return String(doc.title || doc.id || 'Senza titolo');
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
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

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
      // Phase 7 hotfix: non-admin users cannot see preventivi at all
      // (not in the "Tutti" tab, not in any other tab). Phase 5 made
      // the quote editor admin-only, so any quote in a non-admin's
      // collection is either legacy data or admin-shared content, and
      // we want it completely out of their view. The `quote` tab is
      // already hidden for non-admin in the TABS filter below; the
      // `mergedDocs` filter here removes the cards from "Tutti" too.
      // Admin users keep everything as before.
      const visibleDocs = isAdmin
        ? mergedDocs
        : mergedDocs.filter((d) => d.documentType !== 'quote');
      setDocuments(visibleDocs);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [userEmail, refreshKey, ctx?.documentsVersion, isAdmin]);

  // Refresh when collection re-mounts or context changes.
  useEffect(() => {
    setRefreshKey((k) => k + 1);
  }, [ctx?.documentsVersion]);

  const counts = useMemo(() => {
    const c: Record<TabId, number> = { all: documents.length, quote: 0, qrCode: 0, businessCard: 0, flyer: 0, logo: 0 };
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
    if (tab?.type) {
      list = list.filter((d) => d.documentType === tab.type);
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

  const onDuplicate = (doc: any) => {
    const copyId = `${doc.documentType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const copyTitle = `${getDocTitle(doc)} (copia)`;
    const copy = {
      ...doc,
      id: copyId,
      title: copyTitle,
      userEmail,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    dataService.saveDocument(userEmail, copy).then(() => {
      addToast('success', 'Documento duplicato');
      if (ctx?.refreshDocuments) ctx.refreshDocuments();
      setRefreshKey((k) => k + 1);
      // Open the copy in the matching editor.
      if (ctx?.openDocument) ctx.openDocument(copy);
    }).catch(() => {
      addToast('error', 'Duplicazione fallita');
    });
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
      if (ctx?.refreshDocuments) ctx.refreshDocuments();
      setRefreshKey((k) => k + 1);
    }).catch(() => {
      addToast('error', 'Eliminazione fallita');
    });
  };

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
          </div>

          {filtered.length === 0 ? (
            <EmptyState tabId={activeTab} totalCount={documents.length} onOpen={onOpen} ctx={ctx} isAdmin={isAdmin} />
          ) : (
            <div className="collection-grid" data-testid="collection-grid">
              {filtered.map((doc) => {
                const type = doc.documentType as DocumentType;
                const title = truncate(getDocTitle(doc), 50);
                const meta = `${TYPE_LABELS[type] || 'Documento'} · ${formatRelative(doc.updatedAt)}`;
                const isActive = activeId && doc.id === activeId;
                return (
                  <article
                    key={doc.id}
                    className={isActive ? 'collection-card active' : 'collection-card'}
                    data-type={type}
                    data-testid={`card-${doc.id}`}
                  >
                    <div className="card-top">
                      <span className={`doc-icon doc-icon-${type}`} aria-hidden="true">
                        <Icon name={TYPE_ICONS[type] || 'doc'} />
                      </span>
                      {tier === 'free' && (
                        <span className="tier-badge tier-free" data-testid="tier-free">Free</span>
                      )}
                      {tier === 'unlocked' && (
                        <span className="tier-badge tier-pro" data-testid="tier-pro">Pro</span>
                      )}
                    </div>
                    <h3 className="card-title" title={getDocTitle(doc)}>{title}</h3>
                    <p className="card-meta">{meta}</p>
                    <div className="card-actions">
                      <button type="button" onClick={() => onOpen(doc)} data-testid={`open-${doc.id}`}>
                        <Icon name="edit" />Apri
                      </button>
                      <button type="button" onClick={() => onDuplicate(doc)} data-testid={`duplicate-${doc.id}`}>
                        <Icon name="copy" />Duplica
                      </button>
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
      }
    : {
        all: { title: 'Nessun documento ancora', cta: 'Crea un QR Code', docType: 'qrCode' },
        quote: { title: 'Nessun preventivo ancora', cta: 'Crea un preventivo', docType: 'quote' },
        qrCode: { title: 'Nessun QR Code ancora', cta: 'Crea un QR Code', docType: 'qrCode' },
        businessCard: { title: 'Nessun bigliettino ancora', cta: 'Crea un bigliettino', docType: 'businessCard' },
        flyer: { title: 'Nessun volantino ancora', cta: 'Crea un volantino', docType: 'flyer' },
        logo: { title: 'Nessun logo ancora', cta: 'Crea un logo', docType: 'logo' },
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
