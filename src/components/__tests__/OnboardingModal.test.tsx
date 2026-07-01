import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import OnboardingModal from '../OnboardingModal';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('OnboardingModal (regression: submit must call onComplete with all fields)', () => {
  it('calls onComplete with the right payload when the user reaches the last step and clicks "Inizia"', () => {
    const onComplete = vi.fn();
    render(<OnboardingModal onComplete={onComplete} />);

    // Step 0: displayName
    fireEvent.change(screen.getByPlaceholderText(/Marco/i), { target: { value: 'Test User' } });
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));

    // Step 1: companyName
    fireEvent.change(screen.getByPlaceholderText(/Studio Rossi Design/i), { target: { value: 'Test Co' } });
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));

    // Step 2: profession — find first profession button
    const profButton = screen.getAllByRole('button').find((b) =>
      /web|design|developer|studio|consulente|architetto|avvocato|commercialista|grafico|programmatore/i.test(b.textContent || ''),
    );
    expect(profButton).toBeTruthy();
    fireEvent.click(profButton!);
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));

    // Step 3: color is preselected, advance
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));

    // Step 4: VAT is preselected, click "Inizia"
    const iniziaBtn = screen.getByRole('button', { name: /Inizia/i });
    fireEvent.click(iniziaBtn);

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
    // Advance to step 2
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
});
