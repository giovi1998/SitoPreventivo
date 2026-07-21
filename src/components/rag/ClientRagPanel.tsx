import React, { useCallback, useEffect, useRef, useState } from 'react';
import dataService from '../../utils/dataService';
import { getAiRagClientsEnabled, setAiRagClientsEnabled } from '../../utils/uiPrefs';
import './ClientRagPanel.css';

export interface ClientRagItem {
  id: number;
  title: string;
  content: string;
  source: string;
  sourceId?: string | null;
  distance?: number | null;
}

export interface ClientRagPanelProps {
  userEmail?: string;
  /** Default query pre-popolata, es. settore del documento corrente. */
  initialQuery?: string;
  /** Chiamato quando l'utente seleziona un cliente. */
  onSelect?: (item: ClientRagItem) => void;
  /** Mostra il toggle abilitazione RAG (default true). */
  showEnableToggle?: boolean;
}

/**
 * TB-023: pannello RAG clienti riutilizzabile.
 * Cerca nella knowledge base `client_kb` e permette di selezionare un cliente
 * per iniettare contesto nell'AI (es. mantenere coerenza brand tra documenti).
 */
export default function ClientRagPanel({
  userEmail,
  initialQuery = '',
  onSelect,
  showEnableToggle = true,
}: ClientRagPanelProps): React.ReactElement | null {
  const [enabled, setEnabled] = useState(() => getAiRagClientsEnabled());
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<ClientRagItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(
    async (q: string) => {
      if (!enabled || !userEmail || !q.trim()) {
        setItems([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = (await dataService.searchClients(userEmail, q, 5)) as {
          data?: ClientRagItem[];
          error?: string;
        };
        if (res.error) throw new Error(res.error);
        setItems(res.data || []);
      } catch (err: any) {
        setError(err?.message || 'Errore ricerca clienti');
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [enabled, userEmail]
  );

  // Ricerca automatica se initialQuery cambia
  useEffect(() => {
    setQuery(initialQuery);
    const t = setTimeout(() => search(initialQuery), 300);
    return () => clearTimeout(t);
  }, [initialQuery, search]);

  const handleToggle = (next: boolean) => {
    setEnabled(next);
    setAiRagClientsEnabled(next);
    if (!next) setItems([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
    inputRef.current?.blur();
  };

  if (!userEmail) {
    return (
      <div className="rag-panel">
        <p className="rag-panel__empty">Accedi per usare la knowledge base clienti.</p>
      </div>
    );
  }

  return (
    <div className="rag-panel" data-testid="client-rag-panel">
      <div className="rag-panel__header">
        <h4 className="rag-panel__title">Knowledge base clienti</h4>
        {showEnableToggle && (
          <label className="rag-panel__toggle" title="Abilita RAG clienti nelle richieste AI">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => handleToggle(e.target.checked)}
              aria-label="Abilita RAG clienti"
            />
            <span>Attivo</span>
          </label>
        )}
      </div>

      <form onSubmit={handleSubmit} className="rag-panel__search">
        <input
          ref={inputRef}
          type="text"
          className="rag-panel__input"
          placeholder={enabled ? 'Cerca cliente, settore, brand...' : 'RAG disabilitato'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={!enabled}
          aria-label="Cerca nella knowledge base clienti"
        />
        <button type="submit" className="rag-panel__btn" disabled={!enabled || !query.trim() || loading}>
          {loading ? '...' : 'Cerca'}
        </button>
      </form>

      {error && <div className="rag-panel__error" role="alert">{error}</div>}

      <div className="rag-panel__list" role="list">
        {items.length === 0 && !loading && !error && (
          <p className="rag-panel__empty">
            {enabled ? 'Nessun cliente trovato. Prova un altro termine.' : 'Attiva RAG per cercare i clienti.'}
          </p>
        )}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="rag-panel__item"
            role="listitem"
            onClick={() => onSelect?.(item)}
          >
            <p className="rag-panel__item-title">{item.title}</p>
            <p className="rag-panel__item-meta">
              {item.source}
              {item.distance != null && ` · distanza ${item.distance.toFixed(3)}`}
            </p>
            <p className="rag-panel__item-content">{item.content}</p>
          </button>
        ))}
      </div>

      {items.length > 0 && (
        <div className="rag-panel__actions">
          <span className="rag-panel__count">{items.length} risultati</span>
        </div>
      )}
    </div>
  );
}
