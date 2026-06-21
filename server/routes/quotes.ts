import type { RouteHandler } from '../lib/types';
import { json } from '../lib/response';
import { db, quotesTable } from '../lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { ADMIN_EMAIL } from '../lib/response';

const QuoteBodySchema = z.object({
  email: z.string().email('Email non valida'),
  quote: z.object({
    id: z.string().min(1),
    title: z.string().optional(),
    client: z.string().optional(),
    date: z.string().optional(),
    intro: z.string().optional(),
    color: z.string().optional(),
    vat: z.number().optional(),
    status: z.string().optional(),
    owner: z.string().optional(),
    options: z.array(z.any()).optional(),
    clauses: z.array(z.any()).optional(),
    isTemplate: z.boolean().optional(),
    pdfUrl: z.string().optional(),
    documentTheme: z.string().optional(),
  }),
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

export const handleQuotes: RouteHandler = async (path, method, req, res, body) => {
  const url = new URL(req.url, 'http://localhost');
  const searchParams = url.searchParams;

  if (path === '/quotes' && method === 'GET') {
    const userEmail = searchParams.get('email');
    if (!userEmail) return json(req, res, 400, { error: 'Email richiesta' });
    const list = await db.select().from(quotesTable).where(eq(quotesTable.userEmail, userEmail)).orderBy(sql`created_at DESC`);
    return json(req, res, 200, list);
  }

  if (path === '/quotes/all' && method === 'GET') {
    if (searchParams.get('adminEmail') !== ADMIN_EMAIL) {
      return json(req, res, 403, { error: 'Accesso riservato all\'amministratore' });
    }
    const list = await db.select().from(quotesTable).orderBy(sql`created_at DESC`);
    return json(req, res, 200, list);
  }

  if (path === '/quotes' && method === 'POST') {
    const v = validate(QuoteBodySchema, body);
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const { email, quote } = v.data;

    const existing = await db.select().from(quotesTable).where(eq(quotesTable.id, quote.id));
    if (existing.length > 0) {
      if (existing[0].userEmail !== email) {
        return json(req, res, 403, { error: 'Non autorizzato' });
      }
      const [updated] = await db.update(quotesTable).set({
        title: quote.title, client: quote.client, date: quote.date,
        intro: quote.intro, color: quote.color, vat: quote.vat,
        status: quote.status || 'BOZZA', owner: quote.owner,
        options: quote.options || [],
        clauses: quote.clauses || [],
        isTemplate: quote.isTemplate ?? existing[0].isTemplate ?? false,
        pdfUrl: quote.pdfUrl ?? existing[0].pdfUrl,
        documentTheme: quote.documentTheme ?? existing[0].documentTheme,
        updatedAt: sql`now()`,
      }).where(eq(quotesTable.id, quote.id)).returning();
      return json(req, res, 200, updated);
    }

    const [saved] = await db.insert(quotesTable).values({
      id: quote.id, userEmail: email, title: quote.title, client: quote.client,
      date: quote.date, intro: quote.intro, color: quote.color, vat: quote.vat,
      status: quote.status || 'BOZZA', owner: quote.owner,
      options: quote.options || [],
      clauses: quote.clauses || [],
      isTemplate: quote.isTemplate ?? false,
      pdfUrl: quote.pdfUrl || null,
      documentTheme: quote.documentTheme || 'corporate',
    }).returning();
    return json(req, res, 201, saved);
  }

  if (path.startsWith('/quotes/') && method === 'DELETE') {
    const quoteId = path.replace('/quotes/', '');
    const email = body.email || searchParams.get('email');
    if (!email) return json(req, res, 400, { error: 'Email richiesta' });

    const [existing] = await db.select().from(quotesTable).where(eq(quotesTable.id, quoteId));
    if (!existing) return json(req, res, 404, { error: 'Preventivo non trovato' });
    if (existing.userEmail !== email) {
      return json(req, res, 403, { error: 'Non autorizzato' });
    }
    await db.delete(quotesTable).where(eq(quotesTable.id, quoteId));
    return json(req, res, 200, { success: true });
  }

  if (path === '/quotes/templates' && method === 'GET') {
    const userEmail = searchParams.get('email');
    if (!userEmail) return json(req, res, 400, { error: 'Email richiesta' });
    const list = await db.select().from(quotesTable)
      .where(and(eq(quotesTable.userEmail, userEmail), eq(quotesTable.isTemplate, true)))
      .orderBy(sql`created_at DESC`);
    return json(req, res, 200, list);
  }

  return json(req, res, 404, { error: 'Endpoint quotes non trovato' });
};
