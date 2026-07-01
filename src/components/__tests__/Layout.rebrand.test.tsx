import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../Layout';

vi.mock('../ErrorBoundary', () => ({ default: ({ children }: any) => <>{children}</> }));

const baseUser = { email: 'u@test.com', username: 'tester', role: 'user' };

function renderLayout(props: Partial<React.ComponentProps<typeof Layout>> = {}) {
  return render(
    <MemoryRouter>
      <Layout
        view="editor"
        setView={vi.fn()}
        onLogout={vi.fn()}
        onSave={vi.fn()}
        user={baseUser}
        theme="light"
        setTheme={vi.fn()}
        {...props}
      >
        <div data-testid="child">workspace</div>
      </Layout>
    </MemoryRouter>
  );
}

afterEach(() => cleanup());

describe('Layout — Quickbrand rebrand', () => {
  it('does not contain the legacy brand "PrecisionQuote" anywhere in rendered content', () => {
    const { container } = renderLayout();
    const text = (container.textContent ?? '').toLowerCase();
    expect(text).not.toContain('precisionquote');
  });

  it('sidebar brand shows "Quickbrand" instead of the legacy name', () => {
    renderLayout();
    expect(screen.getAllByText('Quickbrand').length).toBeGreaterThanOrEqual(1);
  });

  it('sidebar brand tagline is no longer "Preventivi custom"', () => {
    const { container } = renderLayout();
    expect(container.textContent ?? '').not.toContain('Preventivi custom');
  });
});
