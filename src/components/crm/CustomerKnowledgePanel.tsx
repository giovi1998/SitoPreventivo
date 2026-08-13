import React, { useEffect, useState } from 'react';
import dataService from '../../utils/dataService';

interface KnowledgeChunk {
  chunk?: string;
  source?: string | null;
  embedding?: unknown;
}

interface CustomerKnowledgePanelProps {
  customerId: string;
  reloadKey: string;
}

export function CustomerKnowledgePanel({ customerId, reloadKey }: CustomerKnowledgePanelProps): React.ReactElement {
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void dataService.getCustomerKnowledge(customerId).then((res: { error?: string; data?: KnowledgeChunk[] }) => {
      if (cancelled) return;
      if (res.error) {
        setError(String(res.error));
      } else {
        setChunks(Array.isArray(res.data) ? res.data : []);
      }
    });
    return () => { cancelled = true; };
  }, [customerId, reloadKey]);

  if (chunks.length === 0 && !error) return <></>;
  return (
    <section className="crm-section" data-testid="crm-knowledge-section">
      <h3>Knowledge (RAG) <span className="crm-badge-ai" data-testid="crm-knowledge-count">{chunks.length} chunk</span></h3>
      {error ? <p className="crm-note" data-testid="crm-knowledge-error">{error}</p> : null}
      <ul className="crm-knowledge-list" data-testid="crm-knowledge-list">
        {chunks.slice(0, 20).map((c, i) => (
          <li key={i} className="crm-knowledge-item" data-testid={`crm-knowledge-item-${i}`}>
            <p className="crm-knowledge-chunk">{c.chunk ?? '—'}</p>
            <span className="crm-knowledge-meta">
              {c.source ?? 'source: unknown'}
              {Array.isArray(c.embedding) && c.embedding.length > 0 ? ` · embedding ${c.embedding.length} dim` : ' · no embedding'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default CustomerKnowledgePanel;
