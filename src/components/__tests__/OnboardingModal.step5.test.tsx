import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import OnboardingModal from '../OnboardingModal';

beforeEach(() => {
  vi.restoreAllMocks();
});

/**
 * Phase 7. The new step 5 is a soft preference picker. The wizard
 * has 6 steps for admin (5 + preference) and 5 for non-admin (no
 * VAT, just preference at the end). The "Preventivo" option is
 * hidden for non-admin because they cannot create preventivi.
 */

function advanceToPreference(onComplete: (data: unknown) => void, isAdmin = false) {
  render(<OnboardingModal onComplete={onComplete as any} isAdmin={isAdmin} />);

  // Step 0: displayName
  fireEvent.change(screen.getByPlaceholderText(/Marco/i), { target: { value: 'Tester' } });
  fireEvent.click(screen.getByRole('button', { name: /Continua/i }));

  // Step 1: companyName
  fireEvent.change(screen.getByPlaceholderText(/Studio Rossi Design/i), { target: { value: 'Tester SRL' } });
  fireEvent.click(screen.getByRole('button', { name: /Continua/i }));

  // Step 2: profession
  const profButton = screen.getAllByRole('button').find((b) =>
    /web|design|developer|studio|consulente|architetto|avvocato|commercialista|grafico|programmatore/i.test(b.textContent || ''),
  );
  expect(profButton).toBeTruthy();
  fireEvent.click(profButton!);
  fireEvent.click(screen.getByRole('button', { name: /Continua/i }));

  // Step 3: color
  fireEvent.click(screen.getByRole('button', { name: /Continua/i }));

  if (isAdmin) {
    // Step 4 (admin only): VAT
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));
  }
  // Now at the preference step
}

describe('OnboardingModal step "preference" (Phase 7 — last step picker)', () => {
  // AC-001
  it('admin wizard: renders 6 progress bars and a preference step title', () => {
    const onComplete = vi.fn();
    advanceToPreference(onComplete, true);
    expect(screen.getByText(/Cosa vuoi creare per primo/i)).toBeInTheDocument();
    expect(screen.getByText('6/6')).toBeInTheDocument();
  });

  it('non-admin wizard: renders 5 progress bars (no VAT)', () => {
    const onComplete = vi.fn();
    advanceToPreference(onComplete, false);
    expect(screen.getByText(/Cosa vuoi creare per primo/i)).toBeInTheDocument();
    expect(screen.getByText('5/5')).toBeInTheDocument();
  });

  it('admin: renders 5 enabled options (Volantino is now live, phase 3)', () => {
    const onComplete = vi.fn();
    advanceToPreference(onComplete, true);
    expect(screen.getByRole('radio', { name: /Preventivo/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /QR Code/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Bigliettino/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Logo/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Volantino/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Volantino/i })).toBeEnabled();
  });

  it('non-admin: hides the "Preventivo" option (cannot create preventivi)', () => {
    const onComplete = vi.fn();
    advanceToPreference(onComplete, false);
    expect(screen.queryByRole('radio', { name: /Preventivo/i })).toBeNull();
    // All 4 other options (including Volantino, phase 3) are enabled.
    expect(screen.getByRole('radio', { name: /QR Code/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Bigliettino/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Logo/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Volantino/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Volantino/i })).toBeEnabled();
  });

  it('admin: clicking "QR Code" submits onComplete with preferredDocumentType="qr"', () => {
    const onComplete = vi.fn();
    advanceToPreference(onComplete, true);
    const qr = screen.getByRole('radio', { name: /QR Code/i });
    fireEvent.click(qr);
    expect(qr.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Apri QR Code/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0].preferredDocumentType).toBe('qr');
    expect(onComplete.mock.calls[0][0].onboardingDone).toBe(true);
  });

  it('non-admin: clicking "QR Code" submits onComplete with preferredDocumentType="qr"', () => {
    const onComplete = vi.fn();
    advanceToPreference(onComplete, false);
    fireEvent.click(screen.getByRole('radio', { name: /QR Code/i }));
    fireEvent.click(screen.getByRole('button', { name: /Apri QR Code/i }));
    expect(onComplete.mock.calls[0][0].preferredDocumentType).toBe('qr');
  });

  it('non-admin: clicking "Bigliettino" submits preferredDocumentType="card"', () => {
    const onComplete = vi.fn();
    advanceToPreference(onComplete, false);
    fireEvent.click(screen.getByRole('radio', { name: /Bigliettino/i }));
    fireEvent.click(screen.getByRole('button', { name: /Apri Bigliettino/i }));
    expect(onComplete.mock.calls[0][0].preferredDocumentType).toBe('card');
  });

  it('non-admin: clicking "Logo" submits preferredDocumentType="logo"', () => {
    const onComplete = vi.fn();
    advanceToPreference(onComplete, false);
    fireEvent.click(screen.getByRole('radio', { name: /Logo/i }));
    fireEvent.click(screen.getByRole('button', { name: /Apri Logo/i }));
    expect(onComplete.mock.calls[0][0].preferredDocumentType).toBe('logo');
  });

  it('non-admin: clicking "Inizia" without selection submits without preferredDocumentType', () => {
    const onComplete = vi.fn();
    advanceToPreference(onComplete, false);
    fireEvent.click(screen.getByRole('button', { name: /^Inizia$/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0].preferredDocumentType).toBeUndefined();
    expect(onComplete.mock.calls[0][0].onboardingDone).toBe(true);
  });

  it('non-admin: clicking "Salta" submits without preferredDocumentType (default view)', () => {
    const onComplete = vi.fn();
    advanceToPreference(onComplete, false);
    fireEvent.click(screen.getByRole('button', { name: /^Salta$/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0].preferredDocumentType).toBeUndefined();
    expect(onComplete.mock.calls[0][0].onboardingDone).toBe(true);
  });

  it('non-admin: clicking "Volantino" submits preferredDocumentType="flyer" (phase 3)', () => {
    const onComplete = vi.fn();
    advanceToPreference(onComplete, false);
    const volantino = screen.getByRole('radio', { name: /Volantino/i });
    fireEvent.click(volantino);
    fireEvent.click(screen.getByRole('button', { name: /Apri Volantino/i }));
    expect(onComplete.mock.calls[0][0].preferredDocumentType).toBe('flyer');
  });
});
