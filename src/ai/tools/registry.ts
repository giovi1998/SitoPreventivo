import type { PremiumQuote } from '../../utils/quoteSchema';
import type { ToolResult } from '../../utils/quoteTools';
import type { ToolDefinition } from '../types';
import { TOOL_DEFINITIONS } from './definitions';

export type ToolExecutor = (args: Record<string, unknown>, quote: PremiumQuote) => ToolResult;

export class ToolRegistry {
  private executors: Map<string, ToolExecutor> = new Map();
  private definitions: Map<string, ToolDefinition> = new Map();

  constructor() {
    for (const def of TOOL_DEFINITIONS) {
      this.definitions.set(def.function.name, def);
    }
  }

  register(name: string, executor: ToolExecutor): void {
    this.executors.set(name, executor);
  }

  execute(name: string, args: Record<string, unknown>, quote: PremiumQuote): ToolResult {
    const executor = this.executors.get(name);
    if (!executor) {
      return { quote, changes: `Tool sconosciuto: ${name}. Nessuna modifica effettuata.` };
    }
    return executor(args, quote);
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.definitions.values());
  }

  hasDefinition(name: string): boolean {
    return this.definitions.has(name);
  }
}
