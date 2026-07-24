/**
 * Decide whether the onboarding wizard should be shown for the given user.
 *
 * - Returns false if no user is logged in.
 * - Returns false for admin (admin@gmail.com). Admin is authenticated against
 *   process.env.ADMIN_PASSWORD and is NEVER stored in the users DB table,
 *   so it has no user_settings row. Showing onboarding would force a useless
 *   save attempt that hits a foreign-key violation on user_settings.userEmail.
 *   The server already short-circuits admin in handleUserSettings (see
 *   api/index.ts), but the client should not even open the wizard.
 * - Returns false if `onboardingDone` is true. The wizard is a one-shot:
 *   once the user clicks "Inizia" or "Salta" (admin or non-admin),
 *   `onboardingDone` is persisted and the wizard never re-appears, even
 *   if some fields are still empty (the user may have skipped some).
 * - Returns true otherwise (first login, settings missing, or
 *   onboarding never completed).
 *
 * Phase 7 polish: the previous version re-prompted the wizard whenever
 * any required field was empty, which trapped users in a loop if they
 * clicked "Salta" without filling anything. The new logic trusts the
 * `onboardingDone` flag.
 */

export interface UserSettingsShape {
  displayName?: string;
  companyName?: string;
  profession?: string;
  defaultColor?: string;
  defaultVat?: number;
  documentTheme?: string;
  onboardingDone?: boolean;
  preferredDocumentType?: string;
  [key: string]: unknown;
}

export function shouldShowOnboarding(
  user: { email: string } | null | undefined,
  settings: UserSettingsShape | null | undefined
): boolean {
  if (!user) return false;
  if (user.email === 'admin@gmail.com') return false;
  if (settings?.onboardingDone) return false;
  return true;
}
