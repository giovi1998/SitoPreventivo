import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FlyerPage from '../app/FlyerPage';
import { AuthContext, AppContext } from '../../contexts';

vi.mock('../../components/FlyerEditor', () => ({
  default: (props: any) => (
    <div data-testid="flyer-editor" data-user-email={props.userEmail} data-tier={props.tier}>
      FlyerEditor mock
    </div>
  ),
}));

function authValue(user: any) {
  return { user, login: vi.fn(), register: vi.fn(), logout: vi.fn() };
}

function appValue(extra: any = {}) {
  return { tier: 'free', flyerDocument: null, ...extra };
}

describe('FlyerPage', () => {
  it('renders FlyerEditor with the current user email and tier=unlocked for admin', async () => {
    render(
      <AuthContext.Provider value={authValue({ email: 'admin@gmail.com' }) as any}>
        <AppContext.Provider value={appValue()}>
          <FlyerPage />
        </AppContext.Provider>
      </AuthContext.Provider>
    );
    await waitFor(() => expect(screen.getByTestId('flyer-editor')).toBeInTheDocument());
    expect(screen.getByTestId('flyer-editor').getAttribute('data-user-email')).toBe('admin@gmail.com');
    expect(screen.getByTestId('flyer-editor').getAttribute('data-tier')).toBe('unlocked');
  });

  it('passes tier=unlocked when context tier is unlocked', async () => {
    render(
      <AuthContext.Provider value={authValue({ email: 'mario@rossi.com' }) as any}>
        <AppContext.Provider value={appValue({ tier: 'unlocked' })}>
          <FlyerPage />
        </AppContext.Provider>
      </AuthContext.Provider>
    );
    await waitFor(() => expect(screen.getByTestId('flyer-editor')).toBeInTheDocument());
    expect(screen.getByTestId('flyer-editor').getAttribute('data-tier')).toBe('unlocked');
  });

  it('passes tier=free for non-admin with no unlocked tier', async () => {
    render(
      <AuthContext.Provider value={authValue({ email: 'mario@rossi.com' }) as any}>
        <AppContext.Provider value={appValue({ tier: 'free' })}>
          <FlyerPage />
        </AppContext.Provider>
      </AuthContext.Provider>
    );
    await waitFor(() => expect(screen.getByTestId('flyer-editor')).toBeInTheDocument());
    expect(screen.getByTestId('flyer-editor').getAttribute('data-tier')).toBe('free');
  });

  it('renders FlyerEditor with empty email when user is null', async () => {
    render(
      <AuthContext.Provider value={authValue(null) as any}>
        <AppContext.Provider value={appValue()}>
          <FlyerPage />
        </AppContext.Provider>
      </AuthContext.Provider>
    );
    await waitFor(() => expect(screen.getByTestId('flyer-editor')).toBeInTheDocument());
    expect(screen.getByTestId('flyer-editor').getAttribute('data-user-email')).toBe('');
  });
});
