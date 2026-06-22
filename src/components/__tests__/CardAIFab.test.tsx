import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CardAIFab from '../CardAIFab';

describe('CardAIFab', () => {
  it('renders a button with AI label and no badge when unreadCount=0', () => {
    const onClick = vi.fn();
    render(<CardAIFab onClick={onClick} unreadCount={0} />);
    const btn = screen.getByRole('button', { name: /Apri pannello AI/i });
    expect(btn).toBeInTheDocument();
    expect(btn.querySelector('.card-ai-fab-badge')).toBeNull();
  });

  it('shows badge with count when unreadCount > 0', () => {
    const onClick = vi.fn();
    render(<CardAIFab onClick={onClick} unreadCount={3} />);
    const btn = screen.getByRole('button', { name: /3 log non letti/i });
    expect(btn).toBeInTheDocument();
    const badge = btn.querySelector('.card-ai-fab-badge');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('3');
  });

  it('calls onClick when button is pressed', () => {
    const onClick = vi.fn();
    render(<CardAIFab onClick={onClick} unreadCount={0} />);
    const btn = screen.getByRole('button', { name: /Apri pannello AI/i });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
