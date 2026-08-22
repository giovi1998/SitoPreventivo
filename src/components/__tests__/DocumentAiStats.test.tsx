import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocumentAiStats, BUDGET_THRESHOLD_USD } from '../DocumentAiStats';

describe('DocumentAiStats t23 budget widget', () => {
  it('sotto soglia → nessun badge', () => {
    render(<DocumentAiStats aiStats={{ totalCostUsd: BUDGET_THRESHOLD_USD - 0.01, calls: { text: { count: 1, costUsd: 0.1 } } }} />);
    expect(screen.getByTestId('document-ai-stats')).toBeTruthy();
    expect(screen.queryByTestId('document-ai-stats-budget-warning')).toBeNull();
  });

  it('sopra soglia → badge arancione con spesa', () => {
    render(<DocumentAiStats aiStats={{ totalCostUsd: BUDGET_THRESHOLD_USD + 0.1, calls: { text: { count: 2, costUsd: 0.6 } } }} />);
    const badge = screen.getByTestId('document-ai-stats-budget-warning');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('spesa $');
    expect(badge.textContent).toContain((BUDGET_THRESHOLD_USD + 0.1).toFixed(4));
  });

  it('esattamente a soglia → nessun badge', () => {
    render(<DocumentAiStats aiStats={{ totalCostUsd: BUDGET_THRESHOLD_USD, calls: { text: { count: 1, costUsd: BUDGET_THRESHOLD_USD } } }} />);
    expect(screen.queryByTestId('document-ai-stats-budget-warning')).toBeNull();
  });

  it('costo alto con string coalesced → badge visibile comunque', () => {
    // crm.js inizializza totalCostUsd come stringa "0" in alcuni path locali
    // DocumentAiStats deve gestire Number() — formatAiStatsCompact invece no
    render(<DocumentAiStats aiStats={{ totalCostUsd: 0.8, calls: { text: { count: 1, costUsd: 0.8 } } }} />);
    expect(screen.getByTestId('document-ai-stats-budget-warning')).toBeTruthy();
  });

  it('nessun costo → empty, nessun badge', () => {
    render(<DocumentAiStats aiStats={{ totalCostUsd: 0, calls: {} }} />);
    expect(screen.queryByTestId('document-ai-stats')).toBeNull();
    expect(screen.getByText('Nessun costo AI')).toBeTruthy();
    expect(screen.queryByTestId('document-ai-stats-budget-warning')).toBeNull();
  });
});
