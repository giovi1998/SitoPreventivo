import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import AIProviderBadge from '../AIProviderBadge';

describe('AIProviderBadge', () => {
  it('renders the badge with provider name', () => {
    render(<AIProviderBadge />);
    expect(screen.getByTestId('ai-provider-badge')).toBeInTheDocument();
  });

  it('opens the provider menu on click', () => {
    render(<AIProviderBadge />);
    fireEvent.click(screen.getByTestId('ai-provider-badge'));
    expect(screen.getByTestId('ai-provider-menu')).toBeInTheDocument();
  });

  it('closes the menu on ESC', () => {
    render(<AIProviderBadge />);
    fireEvent.click(screen.getByTestId('ai-provider-badge'));
    expect(screen.getByTestId('ai-provider-menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('ai-provider-menu')).not.toBeInTheDocument();
  });

  it('does NOT show the cost tooltip when totalCostUsd is undefined or 0', () => {
    render(<AIProviderBadge lastCostUsd={0.01} />);
    expect(screen.queryByTestId('ai-provider-cost-tooltip')).not.toBeInTheDocument();
  });

  it('shows the cost tooltip after hover ≥300ms when totalCostUsd > 0', async () => {
    vi.useFakeTimers();
    render(<AIProviderBadge lastCostUsd={0.01} totalCostUsd={0.5} />);
    const badge = screen.getByTestId('ai-provider-badge');
    fireEvent.mouseEnter(badge);
    // Subito: tooltip non visibile (debounce 300ms)
    expect(screen.queryByTestId('ai-provider-cost-tooltip')).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(310); });
    expect(screen.getByTestId('ai-provider-cost-tooltip')).toBeInTheDocument();
    // Mouse leave chiude
    fireEvent.mouseLeave(badge);
    expect(screen.queryByTestId('ai-provider-cost-tooltip')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('tooltip text mentions total session cost', async () => {
    vi.useFakeTimers();
    render(<AIProviderBadge totalCostUsd={1.23} />);
    const badge = screen.getByTestId('ai-provider-badge');
    fireEvent.mouseEnter(badge);
    act(() => { vi.advanceTimersByTime(320); });
    const tip = screen.getByTestId('ai-provider-cost-tooltip');
    expect(tip.textContent).toMatch(/sessione/i);
    expect(tip.textContent).toContain('$1.23');
    vi.useRealTimers();
  });
});