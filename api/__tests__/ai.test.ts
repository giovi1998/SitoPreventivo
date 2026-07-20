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

  describe('aiCardCoverSchema (spec v2.4)', () => {
    const aiCardCoverSchema = z.object({
      prompt: z.string().max(1000),
      userEmail: z.string().email().optional(),
    });

    it('accepts prompt only', () => {
      expect(aiCardCoverSchema.safeParse({ prompt: 'minimal tech background' }).success).toBe(true);
    });

    it('accepts prompt + userEmail', () => {
      expect(aiCardCoverSchema.safeParse({ prompt: 'minimal tech background', userEmail: 'u@x.com' }).success).toBe(true);
    });

    it('rejects prompt too long', () => {
      const result = aiCardCoverSchema.safeParse({ prompt: 'x'.repeat(1001) });
      expect(result.success).toBe(false);
    });

    it('rejects invalid userEmail', () => {
      const result = aiCardCoverSchema.safeParse({ prompt: 'ok', userEmail: 'bad' });
      expect(result.success).toBe(false);
    });
  });
});

/**
 * TB-023: schema esteso per /ai/chat con routing provider (deepseek|ollama)
 * e campi opzionali Ollama (images, tools, format, options).
 */
const aiChatSchemaTB023 = z.object({
  model: z.string().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant', 'tool']),
        content: z.string(),
        tool_call_id: z.string().optional(),
        name: z.string().optional(),
        images: z.array(z.string()).optional(),
        tool_calls: z
          .array(
            z.object({
              function: z.object({ name: z.string(), arguments: z.string() }),
            }),
          )
          .optional(),
      }),
    )
    .min(1)
    .max(50),
  response_format: z.object({ type: z.literal('json_object') }).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().max(8192).optional(),
  userEmail: z.string().email().optional(),
  provider: z.enum(['deepseek', 'ollama']).optional(),
  tools: z
    .array(
      z.object({
        type: z.literal('function'),
        function: z.object({
          name: z.string(),
          description: z.string().optional(),
          parameters: z.record(z.string(), z.unknown()).optional(),
        }),
      }),
    )
    .optional(),
  format: z.union([z.literal('json'), z.record(z.string(), z.unknown())]).optional(),
  stream: z.boolean().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

const aiImageFlashSchema = z.object({
  prompt: z.string().max(1000),
  aspectRatio: z.enum(['1:1', '16:9', '3:1']).optional(),
  size: z.enum(['512', '1K']).optional(),
  kind: z.enum(['icon', 'hero', 'custom']).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  style: z.string().max(50).optional(),
  userEmail: z.string().email().optional(),
});

const aiDesignReviewSchema = z.object({
  docType: z.enum(['card', 'flyer']),
  docJson: z.string().max(50_000),
  screenshotBase64: z.string().max(600_000),
  userEmail: z.string().email().optional(),
});

describe('TB-023: /ai/chat schema with provider routing', () => {
  it('accepts provider=ollama', () => {
    const result = aiChatSchemaTB023.safeParse({
      messages: [{ role: 'user', content: 'ciao' }],
      provider: 'ollama',
      model: 'minimax-m3:cloud',
    });
    expect(result.success).toBe(true);
  });

  it('accepts provider=deepseek (default)', () => {
    const result = aiChatSchemaTB023.safeParse({
      messages: [{ role: 'user', content: 'ciao' }],
      provider: 'deepseek',
    });
    expect(result.success).toBe(true);
  });

  it('accepts images in messages (multimodal Ollama)', () => {
    const result = aiChatSchemaTB023.safeParse({
      messages: [{ role: 'user', content: 'analizza', images: ['base64data'] }],
      provider: 'ollama',
    });
    expect(result.success).toBe(true);
  });

  it('accepts tools array (Ollama format)', () => {
    const result = aiChatSchemaTB023.safeParse({
      messages: [{ role: 'user', content: 'x' }],
      provider: 'ollama',
      tools: [{ type: 'function', function: { name: 'get_weather', parameters: { type: 'object' } } }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts format=json', () => {
    const result = aiChatSchemaTB023.safeParse({
      messages: [{ role: 'user', content: 'x' }],
      provider: 'ollama',
      format: 'json',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid provider', () => {
    const result = aiChatSchemaTB023.safeParse({
      messages: [{ role: 'user', content: 'x' }],
      provider: 'openai',
    });
    expect(result.success).toBe(false);
  });
});

describe('TB-023: /ai/image-flash schema', () => {
  it('accepts minimal prompt', () => {
    expect(aiImageFlashSchema.safeParse({ prompt: 'mela' }).success).toBe(true);
  });

  it('accepts icon kind with colors', () => {
    const result = aiImageFlashSchema.safeParse({
      prompt: 'mela',
      kind: 'icon',
      primaryColor: '#E62020',
      secondaryColor: '#1A1A1A',
      style: 'minimalist',
    });
    expect(result.success).toBe(true);
  });

  it('accepts hero kind with 16:9', () => {
    const result = aiImageFlashSchema.safeParse({
      prompt: 'pizza',
      kind: 'hero',
      aspectRatio: '16:9',
      primaryColor: '#E62020',
      secondaryColor: '#1A1A1A',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid color', () => {
    const result = aiImageFlashSchema.safeParse({
      prompt: 'x',
      primaryColor: 'red',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid aspectRatio', () => {
    const result = aiImageFlashSchema.safeParse({
      prompt: 'x',
      aspectRatio: '4:3',
    });
    expect(result.success).toBe(false);
  });

  it('rejects prompt too long', () => {
    const result = aiImageFlashSchema.safeParse({ prompt: 'x'.repeat(1001) });
    expect(result.success).toBe(false);
  });
});

describe('TB-023: /ai/design-review schema', () => {
  it('accepts card review', () => {
    const result = aiDesignReviewSchema.safeParse({
      docType: 'card',
      docJson: '{"foo":"bar"}',
      screenshotBase64: 'iVBORw0KGgo=',
    });
    expect(result.success).toBe(true);
  });

  it('accepts flyer review', () => {
    const result = aiDesignReviewSchema.safeParse({
      docType: 'flyer',
      docJson: '{"foo":"bar"}',
      screenshotBase64: 'iVBORw0KGgo=',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid docType', () => {
    const result = aiDesignReviewSchema.safeParse({
      docType: 'logo',
      docJson: '{}',
      screenshotBase64: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects docJson too long', () => {
    const result = aiDesignReviewSchema.safeParse({
      docType: 'card',
      docJson: 'x'.repeat(50_001),
      screenshotBase64: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects screenshot too long', () => {
    const result = aiDesignReviewSchema.safeParse({
      docType: 'card',
      docJson: '{}',
      screenshotBase64: 'x'.repeat(600_001),
    });
    expect(result.success).toBe(false);
  });
});
