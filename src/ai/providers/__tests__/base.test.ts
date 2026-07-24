import { describe, it, expect } from 'vitest';
import { BaseAIProvider } from '../base';
import type { ChatMessage } from '../../types';

class TestProvider extends BaseAIProvider {
  readonly name = 'Test';
  readonly model = 'test-model';
  readonly supportsStreaming = true;
  readonly supportsTools = true;
  async chat(): Promise<any> { return { content: null }; }
  async *stream(): AsyncGenerator<any> { yield { type: 'done' }; }
  callBuildRequestBody(messages: any[], opts?: any) {
    return this.buildRequestBody(messages, opts);
  }
  callParseToolCalls(c: any) { return this.parseToolCalls(c); }
  callParseUsage(d: any) { return this.parseUsage(d); }
}

describe('BaseAIProvider.buildRequestBody', () => {
  it('includes model and messages', () => {
    const p = new TestProvider();
    const body = p.callBuildRequestBody([{ role: 'user', content: 'ciao' }]);
    expect(body.model).toBe('test-model');
    expect((body.messages as any[])[0].role).toBe('user');
    expect((body.messages as any[])[0].content).toBe('ciao');
  });
  it('includes tools when provided', () => {
    const p = new TestProvider();
    const body = p.callBuildRequestBody([], { tools: [{ type: 'function', function: { name: 'x', description: 'd', parameters: {} } }] });
    expect(body.tools).toBeDefined();
  });
  it('omits tools when not supported', () => {
    class NoToolsProvider extends BaseAIProvider {
      readonly name = 'NoTools';
      readonly model = 'no-tools';
      readonly supportsStreaming = true;
      readonly supportsTools = false;
      async chat(): Promise<any> { return { content: null }; }
      async *stream(): AsyncGenerator<any> { yield { type: 'done' }; }
    }
    const p = new NoToolsProvider();
    const body = p['buildRequestBody']([], { tools: [{ type: 'function', function: { name: 'x', description: 'd', parameters: {} } }] });
    expect(body.tools).toBeUndefined();
  });
  it('uses default temperature when not provided', () => {
    const p = new TestProvider();
    const body = p.callBuildRequestBody([]);
    expect(body.temperature).toBe(0.7);
  });
  it('respects custom temperature', () => {
    const p = new TestProvider();
    const body = p.callBuildRequestBody([], { temperature: 0.3 });
    expect(body.temperature).toBe(0.3);
  });
  it('includes stream flag when set', () => {
    const p = new TestProvider();
    const body = p.callBuildRequestBody([], { stream: true });
    expect(body.stream).toBe(true);
  });
});

describe('BaseAIProvider.parseToolCalls', () => {
  it('parses tool_calls array', () => {
    const p = new TestProvider();
    const result = p.callParseToolCalls({ message: { tool_calls: [{ id: '1', function: { name: 'x', arguments: '{}' } }] } });
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe('1');
  });
  it('returns undefined when no tool_calls', () => {
    const p = new TestProvider();
    expect(p.callParseToolCalls({ message: {} })).toBeUndefined();
  });
});

describe('BaseAIProvider.parseUsage', () => {
  it('extracts token counts', () => {
    const p = new TestProvider();
    const u = p.callParseUsage({ usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } });
    expect(u).toEqual({ promptTokens: 10, completionTokens: 20, totalTokens: 30 });
  });
  it('returns undefined when no usage', () => {
    const p = new TestProvider();
    expect(p.callParseUsage({})).toBeUndefined();
  });
});
