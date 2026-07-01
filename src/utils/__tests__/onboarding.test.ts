import { describe, it, expect } from 'vitest';
import { shouldShowOnboarding } from '../onboarding';

describe('shouldShowOnboarding', () => {
  it('returns false when no user is logged in', () => {
    expect(shouldShowOnboarding(null, null)).toBe(false);
    expect(shouldShowOnboarding(undefined, null)).toBe(false);
  });

  it('returns false for admin@gmail.com (regardless of settings)', () => {
    expect(shouldShowOnboarding({ email: 'admin@gmail.com' }, null)).toBe(false);
    expect(shouldShowOnboarding({ email: 'admin@gmail.com' }, {})).toBe(false);
    expect(shouldShowOnboarding({ email: 'admin@gmail.com' }, { onboardingDone: false })).toBe(false);
  });

  it('returns true for a regular user with no settings', () => {
    expect(shouldShowOnboarding({ email: 'user@test.com' }, null)).toBe(true);
    expect(shouldShowOnboarding({ email: 'user@test.com' }, undefined)).toBe(true);
  });

  // Phase 7 polish. The wizard is a one-shot: once the user clicks
  // "Inizia" or "Salta", onboardingDone is persisted and the wizard
  // never re-appears, even if some fields are empty (the user may
  // have skipped them). This avoids trapping the user in a loop.
  it('returns true for a regular user with incomplete settings (no onboardingDone)', () => {
    expect(shouldShowOnboarding({ email: 'user@test.com' }, { displayName: 'Mario' })).toBe(true);
    expect(shouldShowOnboarding({ email: 'user@test.com' }, { displayName: '', companyName: 'SRL' })).toBe(true);
  });

  it('returns false for a regular user once onboardingDone is true', () => {
    expect(shouldShowOnboarding({ email: 'user@test.com' }, { onboardingDone: true })).toBe(false);
    // onboardingDone=true is enough even with empty fields (user clicked "Salta")
    expect(
      shouldShowOnboarding(
        { email: 'user@test.com' },
        { onboardingDone: true, displayName: '', companyName: '', profession: '' }
      )
    ).toBe(false);
  });

  it('returns true when onboardingDone is explicitly false', () => {
    expect(shouldShowOnboarding({ email: 'user@test.com' }, { onboardingDone: false })).toBe(true);
  });

  it('returns false for a regular user with full legacy data and onboardingDone true', () => {
    expect(
      shouldShowOnboarding(
        { email: 'user@test.com' },
        {
          displayName: 'Mario',
          companyName: 'SRL',
          profession: 'developer',
          defaultColor: '#01696F',
          defaultVat: 22,
          documentTheme: 'corporate',
          onboardingDone: true,
        }
      )
    ).toBe(false);
  });
});
