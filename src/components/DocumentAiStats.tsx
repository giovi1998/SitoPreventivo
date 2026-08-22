import React from 'react';
import { formatAiStatsCompact, aiStatsTotalCalls, documentAiStatsTitle, type AiStats } from '../utils/aiStats';

// t23: soglia budget per-document — oltre mostra badge arancione (senza blocco).
// Default $0.50 come da ticket t15/t23 (per-document totalCostUsd TB-026).
export const BUDGET_THRESHOLD_USD = 0.5;

interface DocumentAiStatsProps {
  aiStats?: AiStats;
  size?: 'sm' | 'md';
  className?: string;
}

export function DocumentAiStats({ aiStats, size = 'sm', className = '' }: DocumentAiStatsProps): React.ReactElement | null {
  const compact = formatAiStatsCompact(aiStats);
  const totalCalls = aiStatsTotalCalls(aiStats);
  const totalCost = Number((aiStats as unknown as { totalCostUsd?: unknown })?.totalCostUsd ?? 0) || 0;
  const overBudget = totalCost > BUDGET_THRESHOLD_USD;
  if (!compact || totalCalls === 0) {
    return (
      <span
        className={`document-ai-stats document-ai-stats--empty ${className}`}
        title={documentAiStatsTitle(aiStats)}
        style={{
          fontSize: size === 'sm' ? '0.75rem' : '0.85rem',
          color: 'var(--text-muted, #9ca3af)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          whiteSpace: 'nowrap',
        }}
      >
        <span aria-hidden="true">🤖</span>
        <span>Nessun costo AI</span>
      </span>
    );
  }

  return (
    <span
      className={`document-ai-stats ${className}`}
      title={`Costo AI cumulato per questo documento: ${totalCalls} chiamata${totalCalls === 1 ? '' : 'e'}`}
      style={{
        fontSize: size === 'sm' ? '0.75rem' : '0.85rem',
        color: 'var(--text, #374151)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        whiteSpace: 'nowrap',
        fontWeight: 500,
      }}
      data-testid="document-ai-stats"
    >
      <span aria-hidden="true">🤖</span>
      <span>{compact}</span>
      {overBudget && (
        <span
          data-testid="document-ai-stats-budget-warning"
          title={`Spesa oltre soglia $${BUDGET_THRESHOLD_USD.toFixed(2)} (solo pay-per-token; Ollama flat non conteggiato)`}
          style={{
            background: '#fef3c7',
            color: '#92400e',
            border: '1px solid #f59e0b',
            borderRadius: '9999px',
            padding: '1px 6px',
            fontSize: '0.7rem',
            fontWeight: 700,
            marginLeft: '4px',
          }}
        >
          ⚠ spesa ${totalCost.toFixed(4)}
        </span>
      )}
    </span>
  );
}