import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TierLimitModal from '../TierLimitModal';

const USER = 'user@test.com';

function mockDataService(overrides: any = {}) {
  const mod = require('../../utils/dataService');
  return {
    ...mod.default,
    redeemUnlockCode: vi.fn(async (_email: string, code: string) => {
      if (overrides.redeemError) return { error: overrides.redeemError };
      if (code.trim().toUpperCase() === 'TEST-UNLOCK') return { success: true, tier: 'unlocked' };
      if (code.trim().toUpperCase() === 'USED-CODE') return { error: 'Codice già utilizzato' };
      return { error: 'Codice non valido' };
    }),
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetModules();
});

describe('TierLimitModal (Phase 5)', () => {
  it('does not render when open is false', () => {
    const { container } = render(<TierLimitModal open={false} userEmail={USER} onClose={() => {}} />);
    expect(container.querySelector('.tier-limit-dialog')).toBeNull();
  });

  it('renders the limit message when open is true', () => {
    render(<TierLimitModal open={true} userEmail={USER} onClose={() => {}} />);
    expect(screen.getByText(/Limite piano free raggiunto/i)).toBeInTheDocument();
    expect(screen.getByText(/10 documenti/i)).toBeInTheDocument();
  });

  it('shows the "Inserisci codice", "Contattaci" mailto link, and "Chiudi" by default', () => {
    render(<TierLimitModal open={true} userEmail={USER} onClose={() => {}} />);
    expect(screen.getByTestId('tier-limit-show-redeem')).toBeInTheDocument();
    expect(screen.getByTestId('tier-limit-close')).toBeInTheDocument();
    // Phase 3: "Contattaci" link to webdevcagliari@gmail.com (mailto
    // opens the user's email client with a precompiled message)
    const contact = screen.getByTestId('tier-limit-contact') as HTMLAnchorElement;
    expect(contact.href).toContain('mailto:webdevcagliari@gmail.com');
    expect(contact.href).toContain('subject=');
  });

  it('clicking "Inserisci codice" shows the redeem form', () => {
    render(<TierLimitModal open={true} userEmail={USER} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('tier-limit-show-redeem'));
    expect(screen.getByTestId('tier-limit-input')).toBeInTheDocument();
    expect(screen.getByTestId('tier-limit-submit')).toBeInTheDocument();
  });

  it('redeem form: typing a code and clicking submit calls dataService.redeemUnlockCode', async () => {
    const ds = mockDataService();
    vi.doMock('../../utils/dataService', () => ({ default: ds }));
    const { default: TierLimitModalReloaded } = await import('../TierLimitModal');
    const onClose = vi.fn();
    render(<TierLimitModalReloaded open={true} userEmail={USER} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('tier-limit-show-redeem'));
    fireEvent.change(screen.getByTestId('tier-limit-input'), { target: { value: 'TEST-UNLOCK' } });
    fireEvent.click(screen.getByTestId('tier-limit-submit'));
    await waitFor(() => {
      expect(ds.redeemUnlockCode).toHaveBeenCalled();
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('redeem form: invalid code shows error and does NOT close the modal', async () => {
    const ds = mockDataService();
    vi.doMock('../../utils/dataService', () => ({ default: ds }));
    const { default: TierLimitModalReloaded } = await import('../TierLimitModal');
    const onClose = vi.fn();
    render(<TierLimitModalReloaded open={true} userEmail={USER} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('tier-limit-show-redeem'));
    fireEvent.change(screen.getByTestId('tier-limit-input'), { target: { value: 'WRONG-CODE' } });
    fireEvent.click(screen.getByTestId('tier-limit-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('tier-limit-error')).toHaveTextContent(/non valido/i);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('redeem form: empty submit shows "Inserisci un codice" error', async () => {
    const ds = mockDataService();
    vi.doMock('../../utils/dataService', () => ({ default: ds }));
    const { default: TierLimitModalReloaded } = await import('../TierLimitModal');
    render(<TierLimitModalReloaded open={true} userEmail={USER} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('tier-limit-show-redeem'));
    fireEvent.click(screen.getByTestId('tier-limit-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('tier-limit-error')).toHaveTextContent(/Inserisci un codice/i);
    });
    expect(ds.redeemUnlockCode).not.toHaveBeenCalled();
  });

  it('"Chiudi" button calls onClose', () => {
    const onClose = vi.fn();
    render(<TierLimitModal open={true} userEmail={USER} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('tier-limit-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the overlay (outside dialog) closes the modal', () => {
    const onClose = vi.fn();
    const { container } = render(<TierLimitModal open={true} userEmail={USER} onClose={onClose} />);
    fireEvent.click(container.querySelector('.tier-limit-overlay')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking inside the dialog does NOT close the modal', () => {
    const onClose = vi.fn();
    const { container } = render(<TierLimitModal open={true} userEmail={USER} onClose={onClose} />);
    fireEvent.click(container.querySelector('.tier-limit-dialog')!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('onRedeemed callback fires with "unlocked" when redeem succeeds', async () => {
    const ds = mockDataService();
    vi.doMock('../../utils/dataService', () => ({ default: ds }));
    const { default: TierLimitModalReloaded } = await import('../TierLimitModal');
    const onRedeemed = vi.fn();
    const onClose = vi.fn();
    render(<TierLimitModalReloaded open={true} userEmail={USER} onClose={onClose} onRedeemed={onRedeemed} />);
    fireEvent.click(screen.getByTestId('tier-limit-show-redeem'));
    fireEvent.change(screen.getByTestId('tier-limit-input'), { target: { value: 'TEST-UNLOCK' } });
    fireEvent.click(screen.getByTestId('tier-limit-submit'));
    await waitFor(() => {
      expect(onRedeemed).toHaveBeenCalledWith('unlocked');
    });
  });

  it('shows local test hint "TEST-UNLOCK" in the redeem form', () => {
    render(<TierLimitModal open={true} userEmail={USER} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('tier-limit-show-redeem'));
    expect(screen.getByText(/TEST-UNLOCK/i)).toBeInTheDocument();
  });
});
