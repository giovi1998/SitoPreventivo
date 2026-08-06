import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProProvider } from '../ollamaPro';
import { DeepSeekProvider } from '../deepseek';
import type { ChatMessage, ToolDefinition } from '../../types';

vi.mock('../../../utils/dataService', () => ({
  default: {
    getDeepseekKey: vi.fn().mockResolvedValue('test-key'),
    chatWithAI: vi.fn(),
    streamChat: vi.fn(),
  },
}));

const originalLocation = globalThis.window?.location;
function setWindowLocation(hostname: string) {
  // @ts-expect-error - test override
  if (!globalThis.window) globalThis.window = {};
  // @ts-expect-error - test override
  globalThis.window.location = { hostname, origin: `http://${hostname}`, href: `http://${hostname}/` };
}

const ANALYZE_SITE_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'analyze_site',
      description: 'test',
      parameters: { type: 'object', properties: { part: { type: 'string', enum: ['html', 'css', 'js'] } }, required: ['part'] },
    },
  },
];

function verifyMessages(providerId: string): ChatMessage[] {
  // Stessa struttura di websiteOrchestrator.generateSite (pass 1 verify):
  // assistant con content '' + tool_calls precompilati + tool results.
  const messages: ChatMessage[] = [
    { role: 'system', content: 'sei un verify agent' },
    { role: 'user', content: 'verifica il sito' },
  ];
  for (const part of ['html', 'css', 'js']) {
    messages.push({
      role: 'assistant',
      content: '',
      toolCalls: [{
        id: `analyze-${part}`,
        type: 'function',
        function: { name: 'analyze_site', arguments: JSON.stringify({ part }) },
      }],
    });
    messages.push({ role: 'tool', content: '{"ok":true,"issues":[]}', name: 'analyze_site', toolCallId: `analyze-${part}` });
  }
  return messages;
}

describe('verify body serialization (3 provider)', () => {
  beforeEach(() => {
    setWindowLocation('localhost');
  });
  afterEach(() => {
    if (originalLocation) {
      // @ts-expect-error - restore
      globalThis.window.location = originalLocation;
    } else {
      // @ts-expect-error - cleanup
      delete globalThis.window;
    }
    vi.restoreAllMocks();
  });

  async function capturedBody(p: { chat: (m: ChatMessage[], o?: any) => Promise<any> }, messages: ChatMessage[], options?: any) {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"issues":[]}' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await p.chat(messages, options);
    const call = fetchSpy.mock.calls[0];
    return JSON.parse((call[1] as RequestInit).body as string);
  }

  it('ollama minimax-m3: content "" + tool_calls + tools dichiarati', async () => {
    const p = new OllamaProProvider('minimax-m3:cloud');
    const body = await capturedBody(p, verifyMessages('ollama-minimax-m3'), { tools: ANALYZE_SITE_TOOLS });
    expect(body.model).toBe('minimax-m3:cloud');
    expect(body.tools).toBeDefined();
    expect(body.tools[0].function.name).toBe('analyze_site');
    const assistantMsgs = body.messages.filter((m: any) => m.tool_calls);
    expect(assistantMsgs).toHaveLength(3);
    for (const am of assistantMsgs) {
      // Il 400 Ollama "can't find closing '}' symbol" nasce da content: null:
      // il body DEVE avere content come STRINGA.
      expect(typeof am.content).toBe('string');
      expect(am.content).toBe('');
      expect(am.tool_calls[0].function.name).toBe('analyze_site');
    }
    const toolMsgs = body.messages.filter((m: any) => m.role === 'tool');
    expect(toolMsgs).toHaveLength(3);
    expect(toolMsgs[0].tool_call_id).toBe('analyze-html');
  });

  it('ollama deepseek-v4-flash:0731-cloud: stessa serializzazione valida', async () => {
    const p = new OllamaProProvider('deepseek-v4-flash:0731-cloud');
    const body = await capturedBody(p, verifyMessages('ollama-deepseek-v4-flash-0731'), { tools: ANALYZE_SITE_TOOLS });
    expect(body.model).toBe('deepseek-v4-flash:0731-cloud');
    expect(body.tools).toBeDefined();
    const assistantMsgs = body.messages.filter((m: any) => m.tool_calls);
    expect(assistantMsgs).toHaveLength(3);
    for (const am of assistantMsgs) {
      expect(typeof am.content).toBe('string');
      const args = JSON.parse(am.tool_calls[0].function.arguments);
      expect(['html', 'css', 'js']).toContain(args.part);
    }
  });

  it('deepseek v4 flash: content "" + tool_calls (id/type/function) + tools', async () => {
    const p = new DeepSeekProvider('deepseek-v4-flash');
    const body = await capturedBody(p, verifyMessages('deepseek-v4-flash'), { tools: ANALYZE_SITE_TOOLS });
    expect(body.model).toBe('deepseek-v4-flash');
    expect(body.tools).toBeDefined();
    const assistantMsgs = body.messages.filter((m: any) => m.tool_calls);
    expect(assistantMsgs).toHaveLength(3);
    for (const am of assistantMsgs) {
      expect(typeof am.content).toBe('string');
      expect(am.tool_calls[0].id).toBeDefined();
      expect(am.tool_calls[0].type).toBe('function');
      expect(am.tool_calls[0].function.name).toBe('analyze_site');
    }
    const toolMsgs = body.messages.filter((m: any) => m.role === 'tool');
    expect(toolMsgs).toHaveLength(3);
  });
});
