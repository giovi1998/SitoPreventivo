import type { PremiumQuote } from './quoteSchema';
import { executeTool, type ToolName, type ToolResult } from './quoteTools';

export interface ToolLogEntry {
  timestamp: string;
  tool: ToolName;
  args: Record<string, unknown>;
  result: string;
  success: boolean;
}

const MAX_TOOL_CALLS_PER_TURN = 5;

export class ToolDispatcher {
  private callCount = 0;
  public logs: ToolLogEntry[] = [];

  reset() {
    this.callCount = 0;
  }

  canCall(): boolean {
    return this.callCount < MAX_TOOL_CALLS_PER_TURN;
  }

  dispatch(
    toolName: ToolName,
    args: Record<string, unknown>,
    quote: PremiumQuote
  ): { result: ToolResult; log: ToolLogEntry } | null {
    if (!this.canCall()) {
      return null;
    }

    this.callCount++;
    const timestamp = new Date().toISOString();

    try {
      const result = executeTool(toolName, args, quote);
      const log: ToolLogEntry = {
        timestamp,
        tool: toolName,
        args,
        result: result.changes,
        success: true,
      };
      this.logs.push(log);
      return { result, log };
    } catch (err) {
      const log: ToolLogEntry = {
        timestamp,
        tool: toolName,
        args,
        result: `Errore: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
      };
      this.logs.push(log);
      return null;
    }
  }

  getLogs(): ToolLogEntry[] {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
  }
}

export function parseAIToolResponse(
  responseText: string
): { action: 'tool_call'; tool: ToolName; args: Record<string, unknown> } | { action: 'direct'; data: Record<string, unknown> } | null {
  try {
    const parsed = JSON.parse(responseText);
    if (parsed.action === 'tool_call' && parsed.tool) {
      return {
        action: 'tool_call',
        tool: parsed.tool as ToolName,
        args: (parsed.args || {}) as Record<string, unknown>,
      };
    }
    if (parsed.action === 'direct' || (!parsed.action && parsed.options)) {
      return { action: 'direct', data: parsed as Record<string, unknown> };
    }
    return { action: 'direct', data: parsed as Record<string, unknown> };
  } catch {
    return null;
  }
}
