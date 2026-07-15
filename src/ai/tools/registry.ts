import type { ToolDefinition, ToolExecutor, ToolResult } from '../types';
import { TOOL_DEFINITIONS } from './definitions';

export class ToolRegistry<T = unknown> {
  private executors: Map<string, ToolExecutor<T>> = new Map();
  private definitions: Map<string, ToolDefinition> = new Map();

  constructor() {
    for (const def of TOOL_DEFINITIONS) {
      this.definitions.set(def.function.name, def);
    }
  }

  register(name: string, executor: ToolExecutor<T>): void {
    this.executors.set(name, executor);
  }

  /**
   * Keep only the definitions whose names are in `names`. Used by
   * ToolAwareOrchestrator subclasses to expose only module-specific
   * tools to the AI.
   */
  filterDefinitions(names: string[]): void {
    const next = new Map<string, ToolDefinition>();
    for (const name of names) {
      const def = this.definitions.get(name);
      if (def) next.set(name, def);
    }
    this.definitions = next;
  }

  execute(name: string, args: Record<string, unknown>, payload: T): ToolResult<T> {
    const executor = this.executors.get(name);
    if (!executor) {
      return { payload, changes: `Tool sconosciuto: ${name}. Nessuna modifica effettuata.` };
    }
    return executor(args, payload);
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.definitions.values());
  }

  hasDefinition(name: string): boolean {
    return this.definitions.has(name);
  }
}
