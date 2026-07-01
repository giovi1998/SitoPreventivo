import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import OnboardingModal from '../OnboardingModal';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('OnboardingModal (regression: submit must call onComplete with all fields)', () => {
  it('admin wizard: 6 steps, calls onComplete with the right payload (VAT + preferredDocumentType)', () => {
    const onComplete = vi.fn();
    render(<OnboardingModal onComplete={onComplete} isAdmin={true} />);

    // Step 0: displayName
    fireEvent.change(screen.getByPlaceholderText(/Marco/i), { target: { value: 'Test User' } });
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));

    // Step 1: companyName
    fireEvent.change(screen.getByPlaceholderText(/Studio Rossi Design/i), { target: { value: 'Test Co' } });
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));

    // Step 2: profession
    const profButton = screen.getAllByRole('button').find((b) =>
      /web|design|developer|studio|consulente|architetto|avvocato|commercialista|grafico|programmatore/i.test(b.textContent || ''),
    );
    expect(profButton).toBeTruthy();
    fireEvent.click(profButton!);
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));

    // Step 3: color is preselected, advance
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));

    // Step 4: VAT is preselected, advance
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));

    // Step 5: preference picker. Click "Salta" so the
    // user lands on the default (editor) view per AC-003.
    fireEvent.click(screen.getByRole('button', { name: /^Salta$/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const payload = onComplete.mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({
      displayName: 'Test User',
      companyName: 'Test Co',
      profession: expect.any(String),
      defaultColor: expect.any(String),
      defaultVat: expect.any(Number),
      onboardingDone: true,
    }));
    expect(payload.profession.length).toBeGreaterThan(0);
  });

  it('non-admin wizard: 5 steps (no VAT), calls onComplete with default VAT (22)', () => {
    const onComplete = vi.fn();
    render(<OnboardingModal onComplete={onComplete} isAdmin={false} />);

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

    // Step 4: preference picker (no VAT step for non-admin)
    fireEvent.click(screen.getByRole('button', { name: /^Inizia$/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const payload = onComplete.mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({
      displayName: 'Tester',
      companyName: 'Tester SRL',
      profession: expect.any(String),
      defaultColor: expect.any(String),
      defaultVat: 22,
      onboardingDone: true,
    }));
  });

  it('the "Continua" button is disabled at step 0 until displayName is non-empty', () => {
    const onComplete = vi.fn();
    render(<OnboardingModal onComplete={onComplete} />);
    const continuaBtn = screen.getByRole('button', { name: /Continua/i });
    expect(continuaBtn).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/Marco/i), { target: { value: 'X' } });
    expect(continuaBtn).not.toBeDisabled();
  });

  it('the "Continua" button is disabled at step 2 until a profession is selected', () => {
    const onComplete = vi.fn();
    render(<OnboardingModal onComplete={onComplete} />);
    fireEvent.change(screen.getByPlaceholderText(/Marco/i), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));
    fireEvent.change(screen.getByPlaceholderText(/Studio Rossi Design/i), { target: { value: 'Y' } });
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));

    const continuaBtn = screen.getByRole('button', { name: /Continua/i });
    expect(continuaBtn).toBeDisabled();
    const profButton = screen.getAllByRole('button').find((b) =>
      /web|design|developer|studio|consulente|architetto|avvocato|commercialista|grafico|programmatore/i.test(b.textContent || ''),
    );
    fireEvent.click(profButton!);
    expect(continuaBtn).not.toBeDisabled();
  });

  // REQ-003. The step 0 subtitle now references the broader suite
  // (QR, bigliettini, logo) instead of just preventivi.
  it('step 0 subtitle mentions QR, bigliettini and logo (suite, not just preventivi)', () => {
    const onComplete = vi.fn();
    render(<OnboardingModal onComplete={onComplete} />);
    expect(screen.getByText(/QR/i)).toBeInTheDocument();
    expect(screen.getByText(/bigliettini/i)).toBeInTheDocument();
    expect(screen.getByText(/logo/i)).toBeInTheDocument();
  });
});
