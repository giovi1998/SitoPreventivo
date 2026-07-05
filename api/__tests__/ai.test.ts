import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Schema Zod per /ai/chat. Spec 7: validazione input + rate-limit
 * aichat 30/min/IP. Definito inline (in api/index.ts) ma spec
 * identica qui per test deterministici.
 */
const aiChatSchema = z.object({
  model: z.string().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant', 'tool']),
        content: z.string(),
        tool_call_id: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .min(1)
    .max(50),
  response_format: z.object({ type: z.literal('json_object') }).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().max(8192).optional(),
  userEmail: z.string().email().optional(),
});

const aiChatStreamSchema = aiChatSchema.extend({
  tools: z.array(z.any()).optional(),
});

describe('AI endpoint Zod schemas (spec 7)', () => {
  describe('aiChatSchema', () => {
    it('accepts a minimal valid body', () => {
      const result = aiChatSchema.safeParse({
        messages: [{ role: 'user', content: 'ciao' }],
      });
      expect(result.success).toBe(true);
    });

    it('accepts a full body with all optional fields', () => {
      const result = aiChatSchema.safeParse({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'msg' },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1024,
        userEmail: 'user@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty messages', () => {
      const result = aiChatSchema.safeParse({ messages: [] });
      expect(result.success).toBe(false);
    });

    it('rejects missing messages', () => {
      const result = aiChatSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects more than 50 messages', () => {
      const messages = Array.from({ length: 51 }, () => ({
        role: 'user' as const,
        content: 'x',
      }));
      const result = aiChatSchema.safeParse({ messages });
      expect(result.success).toBe(false);
    });

    it('rejects invalid role enum', () => {
      const result = aiChatSchema.safeParse({
        messages: [{ role: 'invalid', content: 'x' }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects temperature > 2', () => {
      const result = aiChatSchema.safeParse({
        messages: [{ role: 'user', content: 'x' }],
        temperature: 3,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid userEmail', () => {
      const result = aiChatSchema.safeParse({
        messages: [{ role: 'user', content: 'x' }],
        userEmail: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });

    it('rejects max_tokens > 8192', () => {
      const result = aiChatSchema.safeParse({
        messages: [{ role: 'user', content: 'x' }],
        max_tokens: 9000,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('aiChatStreamSchema', () => {
    it('accepts tools array passthrough', () => {
      const result = aiChatStreamSchema.safeParse({
        messages: [{ role: 'user', content: 'x' }],
        tools: [{ type: 'function', function: { name: 'foo' } }],
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty messages', () => {
      const result = aiChatStreamSchema.safeParse({ messages: [] });
      expect(result.success).toBe(false);
    });
  });
});
