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

  it('returns true for a regular user with incomplete settings', () => {
    expect(shouldShowOnboarding({ email: 'user@test.com' }, { displayName: 'Mario' })).toBe(true);
    expect(shouldShowOnboarding({ email: 'user@test.com' }, { displayName: '', companyName: 'SRL' })).toBe(true);
  });

  it('returns false for a regular user with all required fields filled', () => {
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
        }
      )
    ).toBe(false);
  });

  it('treats null and empty string as missing', () => {
    expect(
      shouldShowOnboarding(
        { email: 'user@test.com' },
        {
          displayName: null as unknown as string,
          companyName: 'SRL',
          profession: 'dev',
          defaultColor: '#000',
          defaultVat: 22,
          documentTheme: 'corporate',
        }
      )
    ).toBe(true);
    expect(
      shouldShowOnboarding(
        { email: 'user@test.com' },
        {
          displayName: '',
          companyName: 'SRL',
          profession: 'dev',
          defaultColor: '#000',
          defaultVat: 22,
          documentTheme: 'corporate',
        }
      )
    ).toBe(true);
  });

  it('ignores extra fields not in requiredFields', () => {
    expect(
      shouldShowOnboarding(
        { email: 'user@test.com' },
        {
          displayName: 'Mario',
          companyName: 'SRL',
          profession: 'dev',
          defaultColor: '#000',
          defaultVat: 22,
          documentTheme: 'corporate',
          logoUrl: 'https://example.com/logo.png', // extra
          onboardingDone: true,                  // extra
        }
      )
    ).toBe(false);
  });
});
