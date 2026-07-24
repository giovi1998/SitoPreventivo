import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import LogoPage from '../app/LogoPage';
import { AuthContext, AppContext } from '../../contexts';
import { TestRouter } from '../../test/TestRouter';

vi.mock('../../components/LogoEditor', () => ({
  default: (props: any) => (
    <div data-testid="logo-editor" data-user-email={props.userEmail}>
      LogoEditor mock
    </div>
  ),
}));

function authValue(user: any) {
  return { user, login: vi.fn(), register: vi.fn(), logout: vi.fn() };
}

function appValue(extra: any = {}) {
  return { logoDocument: null, setLogoDocument: vi.fn(), ...extra };
}

function wrapper(children: React.ReactNode, path = '/app/logo') {
  return (
    <TestRouter initialEntries={[path]}>
      {children}
    </TestRouter>
  );
}

describe('LogoPage', () => {
  it('renders LogoEditor with the current user email', async () => {
    render(
      wrapper(
        <AuthContext.Provider value={authValue({ email: 'mario@rossi.com' }) as any}>
          <AppContext.Provider value={appValue()}>
            <LogoPage />
          </AppContext.Provider>
        </AuthContext.Provider>
      )
    );
    await waitFor(() => expect(screen.getByTestId('logo-editor')).toBeInTheDocument());
    expect(screen.getByTestId('logo-editor').getAttribute('data-user-email')).toBe('mario@rossi.com');
  });

  it('renders LogoEditor with empty email when user is null', async () => {
    render(
      wrapper(
        <AuthContext.Provider value={authValue(null) as any}>
          <AppContext.Provider value={appValue()}>
            <LogoPage />
          </AppContext.Provider>
        </AuthContext.Provider>
      )
    );
    await waitFor(() => expect(screen.getByTestId('logo-editor')).toBeInTheDocument());
    expect(screen.getByTestId('logo-editor').getAttribute('data-user-email')).toBe('');
  });
});
