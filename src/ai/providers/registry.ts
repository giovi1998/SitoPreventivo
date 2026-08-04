import type { AIProvider } from '../types';
import { DeepSeekProvider } from './deepseek';
import { OllamaProProvider } from './ollamaPro';

export class AIProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();
  // Default: MiniMax M3 (Ollama Pro Cloud) — multimodale/vision, flat rate.
  // DeepSeek resta fallback (getFallbackProvider).
  private defaultId: string = 'ollama-minimax-m3';

  constructor() {
    this.register('deepseek-v4-flash', new DeepSeekProvider('deepseek-v4-flash'));
    this.register('deepseek-v4-pro', new DeepSeekProvider('deepseek-v4-pro'));
    // TB-023: Ollama Pro Cloud ($20/mo flat, multimodale, zero retention)
    this.register('ollama-minimax-m3', new OllamaProProvider('minimax-m3:cloud'));
    this.register('ollama-deepseek-v4-flash', new OllamaProProvider('deepseek-v4-flash:cloud'));
    // Tag mensile Ollama Pro Cloud (build 0731) — snapshot più recente V4 Flash
    this.register('ollama-deepseek-v4-flash-0731', new OllamaProProvider('deepseek-v4-flash:0731-cloud'));
    this.register('ollama-deepseek-v4-pro', new OllamaProProvider('deepseek-v4-pro:cloud'));
    this.register('ollama-qwen-3.5', new OllamaProProvider('qwen-3.5'));
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

  listProviders(): { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean; supportsVision: boolean }[] {
    return Array.from(this.providers.entries()).map(([id, p]) => ({
      id,
      name: p.name,
      model: p.model,
      supportsStreaming: p.supportsStreaming,
      supportsTools: p.supportsTools,
      supportsVision: (p as { supportsVision?: boolean }).supportsVision ?? false,
    }));
  }

  getProviderCount(): number {
    return this.providers.size;
  }

  /**
   * TB-023: ritorna il provider di fallback se quello primario fallisce.
   * Se primario è Ollama, il fallback è DeepSeek; se è DeepSeek, il fallback è Ollama.
   */
  getFallbackProvider(currentId?: string): { id: string; provider: AIProvider } | null {
    const primaryId = currentId || this.defaultId;
    if (primaryId.startsWith('ollama')) {
      const fallback = this.providers.get('deepseek-v4-flash');
      if (fallback) return { id: 'deepseek-v4-flash', provider: fallback };
    }
    const fallbackOllama = this.providers.get('ollama-minimax-m3');
    if (fallbackOllama && primaryId !== 'ollama-minimax-m3') {
      return { id: 'ollama-minimax-m3', provider: fallbackOllama };
    }
    return null;
  }

  /**
   * TB-023: ritorna il primo provider con vision disponibile (preferito
   * MiniMax M3). Usato da useAIDesignReview per screenshot feedback.
   */
  getVisionProvider(): { id: string; provider: AIProvider & { chatWithImages?: (m: any, imgs: string[], o?: any) => Promise<any> } } | null {
    const preferred = this.providers.get('ollama-minimax-m3');
    if (preferred && (preferred as { supportsVision?: boolean }).supportsVision) {
      return { id: 'ollama-minimax-m3', provider: preferred as any };
    }
    for (const [id, p] of this.providers) {
      if ((p as { supportsVision?: boolean }).supportsVision) {
        return { id, provider: p as any };
      }
    }
    return null;
  }
}

export const providerRegistry = new AIProviderRegistry();
