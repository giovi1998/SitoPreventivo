# Architettura AI - PrecisionQuote

## Provider AI (Predisposizione Multi-Modello)

L'architettura attuale supporta solo DeepSeek ma è predisposta per aggiungere nuovi provider.

### Come aggiungere un nuovo provider

1. Creare un file in `src/ai/providers/` che estende `BaseAIProvider`

```ts
// src/ai/providers/openai.ts
import { BaseAIProvider } from './base';
import type { ChatMessage, ChatOptions, AIResponse, AIStreamChunk } from '../types';

export class OpenAIProvider extends BaseAIProvider {
  readonly name = 'OpenAI';
  readonly model = 'gpt-4o-mini';
  readonly supportsStreaming = true;
  readonly supportsTools = true;

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<AIResponse> {
    // Implementare chiamata API OpenAI
  }

  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<AIStreamChunk> {
    // Implementare streaming OpenAI
  }
}
```

2. Registrare il provider in `src/ai/providers/registry.ts`

```ts
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
// ...

registry.register('gpt-4o-mini', new OpenAIProvider());
registry.register('gpt-4o', new OpenAIProvider({ model: 'gpt-4o' }));
registry.register('claude-3-sonnet', new AnthropicProvider({ model: 'claude-3-sonnet-20241022' }));
```

### Provider consigliati

| Provider | ID | Modello | Costo | Token/min | Supporto tool |
|----------|-----|---------|-------|-----------|---------------|
| DeepSeek (attuale) | `deepseek-chat` | deepseek-chat | €0.14/M | 500K | ✅ |
| OpenAI | `gpt-4o-mini` | gpt-4o-mini | €0.15/M | 500K | ✅ |
| OpenAI | `gpt-4o` | gpt-4o | €2.50/M | 10K | ✅ |
| Anthropic | `claude-3-haiku` | claude-3-haiku | €0.25/M | 200K | ✅ |
| Anthropic | `claude-3-sonnet` | claude-3-sonnet | €3.00/M | 20K | ✅ |
| Google | `gemini-2.0-flash` | gemini-2.0-flash | Gratuito | 1500 richieste/giorno | ✅ |
| Ollama (locale) | `ollama-llama3` | llama3 | 0 (locale) | Illimitato | ✅ |

### Configurazione chiavi API

Le chiavi per provider aggiuntivi vanno aggiunte come variabili d'ambiente:

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
```

Il proxy serverless (api/index.ts) va esteso con nuovi endpoint:

```
/api/ai/chat/openai   → proxy per OpenAI
/api/ai/chat/anthropic → proxy per Anthropic  
/api/ai/chat/gemini    → proxy per Gemini
```

### UI: Selettore modello

Il componente `EditorView.tsx` va aggiornato per mostrare tutti i provider registrati:

```tsx
<select value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
  {availableModels.map((m) => (
    <option key={m.id} value={m.id}>
      {m.name} — {m.model}
    </option>
  ))}
</select>
```

### Strategia di failover

L'AIOrchestrator può essere esteso con logica di fallback:

```ts
async processWithFallback(quote, prompt) {
  const providers = ['gpt-4o-mini', 'deepseek-chat', 'claude-3-haiku'];
  for (const id of providers) {
    try {
      return await this.processPrompt(quote, prompt, { modelId: id });
    } catch (err) {
      console.warn(`Provider ${id} fallito:`, err);
      continue;
    }
  }
  throw new Error('Tutti i provider AI sono falliti');
}
```

---

## Endpoint API Streaming

Per supportare streaming server-side, serve un nuovo endpoint Vercel:

### `/api/ai/chat/stream`

```ts
// api/ai/chat/stream.ts
export default async function handler(req, res) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${apiKey}` 
    },
    body: JSON.stringify({ ...req.body, stream: true }),
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { res.end(); break; }
      res.write(decoder.decode(value));
    }
  } catch (err) {
    res.end();
  }
}
```

---

## Ottimizzazione Token

### Strategia di riduzione contesto

1. **Rilevamento automatico campi**: il sistema analizza il prompt e invia solo i campi rilevanti
2. **Opzioni compatte**: gli oggetti option vengono inviati senza `summary` e `total` (campi calcolati)
3. **Max session messages**: la cronologia chat viene troncata a 50 messaggi
4. **System prompt compatto**: due versioni (compatta ~500 token, estesa ~900 token)

### Stima risparmio token

| Scenario | Prima | Dopo | Risparmio |
|----------|-------|------|-----------|
| Cambio colore tema | ~5KB | ~0.3KB | ~94% |
| Modifica clausola | ~5KB | ~1.5KB | ~70% |
| Sconto 10% | ~5KB | ~2KB | ~60% |
| Modifica completa | ~5KB | ~3KB | ~40% |

---

## Tool Calling vs Keyword Matching

| Aspetto | Keyword matching (vecchio) | Function calling (nuovo) |
|---------|--------------------------|-------------------------|
| Affidabilità | Bassa (fragile parsing) | Alta (JSON strutturato) |
| Manutenibilità | Difficile (regole hardcoded) | Facile (aggiungi tool JSON) |
| Precisione | Media (match parziali) | Alta (argomenti tipizzati) |
| Error handling | Silenzioso (match errato) | Esplicito (validazione args) |
| Estendibilità | Aggiungi if/else | Aggiungi definizione + executor |
