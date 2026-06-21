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
 * - Returns false if settings are present and all required fields are filled.
 * - Returns true otherwise.
 */

export interface UserSettingsShape {
  displayName?: string;
  companyName?: string;
  profession?: string;
  defaultColor?: string;
  defaultVat?: number;
  documentTheme?: string;
  onboardingDone?: boolean;
  [key: string]: unknown;
}

export function shouldShowOnboarding(
  user: { email: string } | null | undefined,
  settings: UserSettingsShape | null | undefined
): boolean {
  if (!user) return false;
  if (user.email === 'admin@gmail.com') return false;
  if (!settings) return true;
  const requiredFields: (keyof UserSettingsShape)[] = [
    'displayName',
    'companyName',
    'profession',
    'defaultColor',
    'defaultVat',
    'documentTheme',
  ];
  return !requiredFields.every((f) => {
    const v = settings[f];
    return v != null && v !== '';
  });
}
