import type { AIProvider } from '../types';
import { DeepSeekProvider } from './deepseek';

export class AIProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();
  private defaultId: string = 'deepseek-chat';

  constructor() {
    this.register('deepseek-chat', new DeepSeekProvider('deepseek-chat'));
    this.register('deepseek-v4-pro', new DeepSeekProvider('deepseek-v4-pro'));
  }

  register(id: string, provider: AIProvider): void {
    this.providers.set(id, provider);
  }

  getProvider(id?: string): AIProvider {
    const provider = this.providers.get(id || this.defaultId);
    if (!provider) throw new Error(`Provider "${id || this.defaultId}" non trovato`);
    return provider;
  }

  getDefaultId(): string {
    return this.defaultId;
  }

  setDefaultId(id: string): void {
    if (!this.providers.has(id)) throw new Error(`Provider "${id}" non registrato`);
    this.defaultId = id;
  }

  listProviders(): { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean }[] {
    return Array.from(this.providers.entries()).map(([id, p]) => ({
      id,
      name: p.name,
      model: p.model,
      supportsStreaming: p.supportsStreaming,
      supportsTools: p.supportsTools,
    }));
  }

  getProviderCount(): number {
    return this.providers.size;
  }
}

export const providerRegistry = new AIProviderRegistry();
