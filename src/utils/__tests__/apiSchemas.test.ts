import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const passwordSchema = z.string()
  .min(12, 'Password: minimo 12 caratteri')
  .max(100)
  .regex(/[A-Z]/, 'Password: deve contenere una maiuscola')
  .regex(/[a-z]/, 'Password: deve contenere una minuscola')
  .regex(/[0-9]/, 'Password: deve contenere un numero')
  .regex(/[^A-Za-z0-9]/, 'Password: deve contenere un carattere speciale');

const RegisterSchema = z.object({
  email: z.string().email('Email non valida'),
  password: passwordSchema,
  username: z.string().min(2, 'Username: minimo 2 caratteri').max(50),
  gender: z.string().optional(),
  role: z.string().optional(),
  tokenLimit: z.number().optional(),
});

const LoginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password richiesta'),
});

const TrackTokensSchema = z.object({
  email: z.string().email('Email non valida'),
  tokens: z.number().positive('tokens deve essere positivo'),
});

const TokenLimitSchema = z.object({
  email: z.string().email('Email non valida'),
  tokenLimit: z.number().positive('tokenLimit deve essere positivo'),
});

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

describe('API zod schemas', () => {
  describe('RegisterSchema', () => {
    it('accepts a valid registration', () => {
      const r = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: 'Strong1Pass!',
        username: 'Mario',
      });
      expect(r.success).toBe(true);
    });

    it('rejects password without uppercase', () => {
      const r = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: 'weak1pass!x',
        username: 'Mario',
      });
      expect(r.success).toBe(false);
    });

    it('rejects short password', () => {
      const r = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: 'Aa1!',
        username: 'Mario',
      });
      expect(r.success).toBe(false);
    });

    it('rejects invalid email', () => {
      const r = RegisterSchema.safeParse({
        email: 'not-an-email',
        password: 'Strong1Pass!',
        username: 'Mario',
      });
      expect(r.success).toBe(false);
    });
  });

  describe('LoginSchema', () => {
    it('accepts minimal valid login', () => {
      const r = LoginSchema.safeParse({ email: 'a@b.com', password: 'x' });
      expect(r.success).toBe(true);
    });
    it('rejects empty password', () => {
      const r = LoginSchema.safeParse({ email: 'a@b.com', password: '' });
      expect(r.success).toBe(false);
    });
  });

  describe('TrackTokensSchema', () => {
    it('rejects zero tokens', () => {
      const r = TrackTokensSchema.safeParse({ email: 'a@b.com', tokens: 0 });
      expect(r.success).toBe(false);
    });
    it('rejects negative tokens', () => {
      const r = TrackTokensSchema.safeParse({ email: 'a@b.com', tokens: -5 });
      expect(r.success).toBe(false);
    });
    it('accepts positive tokens', () => {
      const r = TrackTokensSchema.safeParse({ email: 'a@b.com', tokens: 100 });
      expect(r.success).toBe(true);
    });
  });

  describe('TokenLimitSchema', () => {
    it('rejects negative tokenLimit', () => {
      const r = TokenLimitSchema.safeParse({ email: 'a@b.com', tokenLimit: -1 });
      expect(r.success).toBe(false);
    });
    it('accepts positive tokenLimit', () => {
      const r = TokenLimitSchema.safeParse({ email: 'a@b.com', tokenLimit: 1000000 });
      expect(r.success).toBe(true);
    });
  });

  describe('QuoteBodySchema', () => {
    it('requires id and email', () => {
      const r = QuoteBodySchema.safeParse({ email: 'a@b.com', quote: {} });
      expect(r.success).toBe(false);
    });
    it('accepts minimal quote', () => {
      const r = QuoteBodySchema.safeParse({
        email: 'a@b.com',
        quote: { id: 'PRV-2025-001' },
      });
      expect(r.success).toBe(true);
    });
    it('accepts full quote', () => {
      const r = QuoteBodySchema.safeParse({
        email: 'a@b.com',
        quote: {
          id: 'PRV-2025-001',
          title: 'Titolo',
          client: 'Cliente SPA',
          options: [{ id: 'opt-1' }],
          clauses: [{ id: 'c-1' }],
        },
      });
      expect(r.success).toBe(true);
    });
  });
});
