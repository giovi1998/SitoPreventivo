import React from 'react';
import { formatAiStatsCompact, aiStatsTotalCalls, documentAiStatsTitle, type AiStats } from '../utils/aiStats';

interface DocumentAiStatsProps {
  aiStats?: AiStats;
  size?: 'sm' | 'md';
  className?: string;
}

export function DocumentAiStats({ aiStats, size = 'sm', className = '' }: DocumentAiStatsProps): React.ReactElement | null {
  const compact = formatAiStatsCompact(aiStats);
  const totalCalls = aiStatsTotalCalls(aiStats);
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
    </span>
  );
}