import { useState } from 'react';
import dataService from '../../utils/dataService';
import ConfirmModal from '../ConfirmModal';

type Customer = Record<string, unknown> & {
  id: string;
  businessName?: string;
  status?: string;
  sector?: string;
  package?: string;
  updatedAt?: string;
};

interface Props {
  customers: Customer[];
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Nuovo',
  researching: 'In ricerca',
  researched: 'Ricercato',
  building: 'In costruzione',
  done: 'Completato',
  rejected: 'Rifiutato',
};

const STATUS_COLORS: Record<string, string> = {
  new: '#3b82f6',
  researching: '#f59e0b',
  researched: '#10b981',
  building: '#8b5cf6',
  done: '#22c55e',
  rejected: '#ef4444',
};

export default function CustomerList({ customers, onSelect, onRefresh }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [sector, setSector] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = async () => {
    if (!businessName.trim()) return;
    setCreating(true);
    await dataService.createCustomer({
      businessName: businessName.trim(),
      sector: sector.trim() || undefined,
      ownerName: ownerName.trim() || undefined,
    });
    setBusinessName('');
    setSector('');
    setOwnerName('');
    setShowCreate(false);
    setCreating(false);
    onRefresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await dataService.deleteCustomer(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    onRefresh();
  };

  return (
    <div className="crm-list">
      <div className="crm-list-head">
        <h2>Clienti</h2>
        <div className="crm-actions">
          <button onClick={onRefresh} className="crm-btn-secondary">Aggiorna</button>
          <button onClick={() => setShowCreate((v) => !v)} className="crm-btn-primary">+ Nuovo cliente</button>
        </div>
      </div>

      {showCreate && (
        <div className="crm-create-form">
          <input
            placeholder="Nome attività *"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            data-testid="crm-create-businessname"
          />
          <input
            placeholder="Referente"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            data-testid="crm-create-ownername"
          />
          <input
            placeholder="Settore"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            data-testid="crm-create-sector"
          />
          <button onClick={handleCreate} disabled={creating || !businessName.trim()} data-testid="crm-create-submit">
            {creating ? 'Creazione…' : 'Crea'}
          </button>
        </div>
      )}

      {customers.length === 0 ? (
        <p className="crm-empty">Nessun cliente. Crea il primo con “+ Nuovo cliente”.</p>
      ) : (
        <ul className="crm-cards" data-testid="crm-cards">
          {customers.map((c) => {
            const status = (c.status as string) || 'new';
            return (
              <li key={c.id} className="crm-card" onClick={() => onSelect(c.id)} data-testid={`crm-card-${c.id}`}>
                <div className="crm-card-head">
                  <strong>{c.businessName || c.id}</strong>
                  <span className="crm-status-badge" style={{ background: STATUS_COLORS[status] || '#6b7280' }}>
                    {STATUS_LABELS[status] || status}
                  </span>
                </div>
                <div className="crm-card-meta">
                  {c.sector && <span>{c.sector}</span>}
                  {c.package && <span>· {c.package}</span>}
                </div>
                <div className="crm-card-footer">
                  {c.updatedAt && (
                    <span className="crm-card-date">Aggiornato: {new Date(c.updatedAt as string).toLocaleDateString('it-IT')}</span>
                  )}
                  <button
                    className="crm-card-delete"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                    data-testid={`crm-delete-card-${c.id}`}
                    aria-label="Cancella cliente"
                    title="Cancella cliente"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                    Cancella
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Elimina cliente"
        message={`Sei sicuro di voler eliminare "${deleteTarget?.businessName || deleteTarget?.id}"? I documenti collegati verranno scollegati ma non eliminati.`}
        confirmLabel="Elimina definitivamente"
        confirmClass="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}