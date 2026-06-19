import React, { useState, useMemo } from 'react';
import Icon from './Icon';

interface Quote {
  id: string;
  title?: string;
  client?: string;
  status?: string;
  date?: string;
  isTemplate?: boolean;
  options?: any[];
  [key: string]: any;
}

const STATUSES = ['BOZZA', 'INVIATO', 'ACCETTATO', 'RIFIUTATO'];
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  BOZZA: { bg: 'var(--surface-hov)', color: 'var(--muted)' },
  INVIATO: { bg: 'var(--blue-bg)', color: 'var(--accent)' },
  ACCETTATO: { bg: '#f7eddc', color: 'var(--amber)' },
  RIFIUTATO: { bg: 'var(--red-bg)', color: 'var(--red)' },
};

function money(value: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
}

function parseDate(d: string) {
  if (!d) return new Date(0);
  const parts = d.split(' ');
  if (parts.length === 3) {
    const months: Record<string, number> = { gennaio:0, febbraio:1, marzo:2, aprile:3, maggio:4, giugno:5, luglio:6, agosto:7, settembre:8, ottobre:9, novembre:10, dicembre:11 };
    const day = parseInt(parts[0], 10);
    const month = months[parts[1]?.toLowerCase()];
    const year = parseInt(parts[2], 10);
    if (month !== undefined) return new Date(year, month, day);
  }
  return new Date(d) || new Date(0);
}

function exportCSV(quotes: Quote[]) {
  const header = 'id,cliente,titolo,stato,valore_totale,data\n';
  const rows = quotes.map(q => {
    const first = q.options?.[0];
    const total = first ? first.oneTimeCost : 0;
    return `${q.id},"${q.client || ''}","${q.title || ''}",${q.status || 'BOZZA'},${total},${q.date || ''}`;
  }).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `preventivi_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface CollectionViewProps {
  quotes: Quote[];
  activeId: string;
  openQuote: (q: Quote) => void;
  duplicate: (q: Quote) => void;
  removeQuote: (id: string) => void;
  onUpdateStatus?: (id: string, status: string) => void;
  onDeleteRequest?: (q: Quote) => void;
  setView: (v: string) => void;
  createFromTemplate?: (q: Quote) => void;
}

export default function CollectionView({ quotes, activeId, openQuote, duplicate, removeQuote, onUpdateStatus, onDeleteRequest, setView, createFromTemplate }: CollectionViewProps) {
  const [activeTab, setActiveTab] = useState('quotes');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TUTTI');
  const [sort, setSort] = useState('date-desc');

  const templates = useMemo(() => quotes.filter(q => q.isTemplate), [quotes]);
  const normalQuotes = useMemo(() => quotes.filter(q => !q.isTemplate), [quotes]);

  const displayed = activeTab === 'templates' ? templates : normalQuotes;

  const filtered = useMemo(() => {
    let list = [...displayed];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(item => `${item.title} ${item.client} ${item.id}`.toLowerCase().includes(q));
    }
    if (activeTab === 'quotes' && statusFilter !== 'TUTTI') {
      list = list.filter(item => (item.status || 'BOZZA').toUpperCase() === statusFilter);
    }
    list.sort((a, b) => {
      if (sort === 'date-asc') return parseDate(a.date!) - parseDate(b.date!);
      if (sort === 'date-desc') return parseDate(b.date!) - parseDate(a.date!);
      if (sort === 'name-asc') return (a.title || '').localeCompare(b.title || '');
      return 0;
    });
    return list;
  }, [displayed, search, statusFilter, sort, activeTab]);

  const isEmpty = activeTab === 'templates' ? templates.length === 0 : normalQuotes.length === 0;

  return (
    <div className="collection-view">
      <div className="collection-head">
        <p>Preventivi salvati</p>
        <h2>Collection</h2>
        <span>Modifica, duplica o elimina vecchi preventivi.</span>
      </div>

      <div className="collection-tabs">
        <button className={activeTab === 'quotes' ? 'active' : ''} onClick={() => setActiveTab('quotes')}>
          Preventivi ({normalQuotes.length})
        </button>
        <button className={activeTab === 'templates' ? 'active' : ''} onClick={() => setActiveTab('templates')}>
          Template ({templates.length})
        </button>
      </div>

      {isEmpty ? (
        <div className="collection-empty" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '60px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.4 }}>
            {activeTab === 'templates' ? '📋' : '📄'}
          </div>
          <h3 style={{ margin: '0 0 8px', color: 'var(--ink)' }}>
            {activeTab === 'templates' ? 'Nessun template ancora' : 'Nessun preventivo ancora'}
          </h3>
          <p style={{ margin: '0 0 24px', color: 'var(--muted)', fontSize: '.9rem' }}>
            {activeTab === 'templates'
              ? 'Salva un preventivo come template per riutilizzarlo.'
              : 'I preventivi salvati appariranno qui.'}
          </p>
          <button
            onClick={() => setView('editor')}
            style={{
              padding: '12px 24px', borderRadius: '12px', background: 'var(--accent)',
              color: '#fff', fontWeight: 700, fontSize: '.9rem', border: 'none',
              cursor: 'pointer',
            }}
          >{activeTab === 'templates' ? 'Crea un preventivo' : '+ Crea il primo preventivo'}</button>
        </div>
      ) : (
        <>
          <div className="collection-toolbar" style={{
            display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px',
            alignItems: 'center',
          }}>
            <input
              type="text"
              placeholder="Cerca per titolo o cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: '1 1 200px', padding: '10px 14px', border: '2px solid var(--line)',
                borderRadius: '10px', fontSize: '.85rem', outline: 'none', minWidth: '160px',
              }}
            />
            {activeTab === 'quotes' && (
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{
                  padding: '10px 14px', border: '2px solid var(--line)', borderRadius: '10px',
                  fontSize: '.85rem', background: 'var(--surface)', outline: 'none', color: 'var(--ink)',
                }}
              >
                <option value="TUTTI">Tutti gli stati</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              style={{
                padding: '10px 14px', border: '2px solid var(--line)', borderRadius: '10px',
                fontSize: '.85rem', background: 'var(--surface)', outline: 'none', color: 'var(--ink)',
              }}
            >
              <option value="date-desc">Data ↓</option>
              <option value="date-asc">Data ↑</option>
              <option value="name-asc">Nome A–Z</option>
            </select>
            {activeTab === 'quotes' && (
              <button
                onClick={() => exportCSV(normalQuotes)}
                style={{
                  padding: '10px 16px', borderRadius: '10px', fontSize: '.85rem', fontWeight: 700,
                  border: '2px solid var(--line)', background: 'var(--surface)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ink)',
                }}
                title="Esporta CSV per contabilità"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                CSV
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
              Nessun risultato corrisponde ai filtri.
            </div>
          ) : (
            <div className="collection-grid">{filtered.map((item) => {
              const firstOption = item.options?.[0];
              const total = firstOption ? firstOption.oneTimeCost : 0;
              const status = item.status || 'BOZZA';
              const statusStyle = STATUS_COLORS[status] || STATUS_COLORS.BOZZA;
              return (
                <article className={item.id === activeId ? 'collection-card active' : 'collection-card'} key={item.id}>
                  <div className="card-top">
                    {activeTab === 'quotes' ? (
                      <div className="status-dropdown" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                        <select
                          value={status}
                          onChange={(e) => onUpdateStatus && onUpdateStatus(item.id, e.target.value)}
                          style={{ background: statusStyle.bg, color: statusStyle.color }}
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    ) : (
                      <span className="template-badge">Template</span>
                    )}
                    <b>{item.id}</b>
                  </div>
                  <h3>{item.title}</h3><p>{item.client || 'Nessun cliente'}</p>
                  <div className="card-meta"><span>{item.date}</span><strong>{money(total)}</strong></div>
                  <div className="card-actions">
                    {activeTab === 'templates' ? (
                      <button onClick={() => createFromTemplate && createFromTemplate(item)}>
                        <Icon name="edit" />Usa come template
                      </button>
                    ) : (
                      <>
                        <button onClick={() => openQuote(item)}><Icon name="edit" />Modifica</button>
                        <button onClick={() => duplicate(item)}><Icon name="copy" />Duplica</button>
                        <button onClick={() => onDeleteRequest && onDeleteRequest(item)}><Icon name="trash" />Elimina</button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}</div>
          )}
        </>
      )}
    </div>
  );
}
