import type { RouteHandler } from '../lib/types';
import { json } from '../lib/response';
import { db, userSettingsTable } from '../lib/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const UserSettingsSchema = z.object({
  email: z.string().email('Email non valida'),
  displayName: z.string().optional(),
  companyName: z.string().optional(),
  profession: z.string().optional(),
  defaultColor: z.string().optional(),
  defaultVat: z.number().optional(),
  logoUrl: z.string().optional(),
  onboardingDone: z.boolean().optional(),
  documentTheme: z.string().optional(),
});

function validate<T>(schema: z.ZodType<T>, data: unknown): { error: true; errors: string[] } | { error: false; data: T } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error?.issues;
    const messages = issues ? issues.map((e: z.ZodIssue) => e.message) : ['Errore di validazione dati'];
    return { error: true, errors: messages };
  }
  return { error: false, data: result.data };
}

export const handleUserSettings: RouteHandler = async (path, method, req, res, body) => {
  const url = new URL(req.url, 'http://localhost');
  const searchParams = url.searchParams;

  if (path === '/user-settings' && method === 'GET') {
    const email = searchParams.get('email');
    if (!email) return json(req, res, 400, { error: 'Email richiesta' });
    const [settings] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userEmail, email));
    return json(req, res, 200, settings || { userEmail: email, onboardingDone: false });
  }

  if (path === '/user-settings' && method === 'POST') {
    const v = validate(UserSettingsSchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const { email, ...settings } = v.data;
    const existing = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userEmail, email));
    if (existing.length > 0) {
      const [updated] = await db.update(userSettingsTable).set({
        ...(settings.displayName !== undefined && { displayName: settings.displayName }),
        ...(settings.companyName !== undefined && { companyName: settings.companyName }),
        ...(settings.profession !== undefined && { profession: settings.profession }),
        ...(settings.defaultColor !== undefined && { defaultColor: settings.defaultColor }),
        ...(settings.defaultVat !== undefined && { defaultVat: settings.defaultVat }),
        ...(settings.logoUrl !== undefined && { logoUrl: settings.logoUrl }),
        ...(settings.onboardingDone !== undefined && { onboardingDone: settings.onboardingDone }),
        ...(settings.documentTheme !== undefined && { documentTheme: settings.documentTheme }),
      }).where(eq(userSettingsTable.userEmail, email)).returning();
      return json(req, res, 200, updated);
    }
    const [created] = await db.insert(userSettingsTable).values({
      userEmail: email,
      displayName: settings.displayName,
      companyName: settings.companyName,
      profession: settings.profession,
      defaultColor: settings.defaultColor,
      defaultVat: settings.defaultVat,
      logoUrl: settings.logoUrl,
      documentTheme: settings.documentTheme ?? 'corporate',
      onboardingDone: settings.onboardingDone ?? false,
    }).returning();
    return json(req, res, 201, created);
  }

  return json(req, res, 404, { error: 'Endpoint user-settings non trovato' });
};
