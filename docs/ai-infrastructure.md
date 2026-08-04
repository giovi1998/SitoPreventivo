# AI Infrastructure

> Ultimo aggiornamento: 2026-08-03

---

## 1. Architettura generale

```
┌─────────────────────────────────────────────────────────┐
│                    Client (React)                        │
│                                                         │
│  useAI ──┐                                              │
│  useAICard ──┤── orchestrators ──→ providers ──→ fetch   │
│  useAIFlyer ──┤                  (dual-mode)            │
│  useAILogo ───┤                                         │
│  useAISocial ─┤                                         │
│  useAIOnboard ┤                                         │
│  useAIIconHero ┤  (direct fetch, no orchestrator)       │
│  useAIDesignReview (direct fetch, no orchestrator)      │
│                                                         │
│  useAILogs ← stream buffer + sessionStorage              │
│  AIConsole / AIProviderBadge ← UI rail                  │
├─────────────────────────────────────────────────────────┤
│               Server (Vercel Function)                   │
│                                                         │
│  api/index.ts (monolith)                                │
│  ├── /api/ai/chat          → DeepSeek (streaming)       │
│  ├── /api/ai/chat/stream   → DeepSeek/Ollama (SSE)     │
│  ├── /api/ai/quote-refine  → DeepSeek                   │
│  ├── /api/ai/card-refine   → DeepSeek                   │
│  ├── /api/ai/flyer-refine  → DeepSeek                   │
│  ├── /api/ai/card-image    → Gemini                     │
│  ├── /api/ai/flyer-image   → Gemini                     │
│  ├── /api/ai/logo-background → Gemini (Nano Banana)     │
│  ├── /api/ai/icon-hero     → Gemini Flash               │
│  ├── /api/ai/design-review → Ollama (MiniMax M3)        │
│  └── /api/ai/logo-config   → config JSON                │
├─────────────────────────────────────────────────────────┤
│               Database (Neon Postgres)                    │
│                                                         │
│  users, documents, user_settings, unlock_codes          │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Provider AI

### Provider disponibili

| Provider | Modello | Tipo | Chiave env |
|----------|---------|------|------------|
| DeepSeek | `deepseek-v4-flash` | Text (chat) | `DEEPSEEK_API_KEY` |
| DeepSeek | `deepseek-v4-pro` | Text (chat) | `DEEPSEEK_API_KEY` |
| Ollama Pro | `minimax-m3:cloud` | Text + Vision | `OLLAMA_API_KEY` |
| Ollama Pro | `deepseek-v4-flash:cloud` | Text | `OLLAMA_API_KEY` |
| Ollama Pro | `deepseek-v4-flash:0731` | Text | `OLLAMA_API_KEY` |
| Ollama Pro | `deepseek-v4-pro:cloud` | Text | `OLLAMA_API_KEY` |
| Ollama Pro | `qwen-3.5` | Text | `OLLAMA_API_KEY` |
| Gemini | `gemini-3.1-flash-image` | Image gen | `GEMINI_API_KEY` |

### Dual-mode (dev vs prod)

I provider testo (DeepSeek, Ollama) usano un pattern **dual-mode**:

- **Localhost (`IS_LOCAL=true`)**: chiamata diretta all'API del provider, usando la key da `localStorage['deepseekApiKey']` o `import.meta.env.VITE_DEEPSEEK_API_KEY`. Nessun proxy server-side.
- **Produzione**: chiamata al proxy server-side `/api/ai/chat` o `/api/ai/chat/stream`, che inoltra al provider con la key server-side (`process.env.DEEPSEEK_API_KEY`).

I provider immagine (Gemini) sono **sempre server-side**, sia in dev che in prod. In locale, il dev proxy in `vite.config.js` intercetta `/api/ai/logo-background` e lo risolve usando la stessa classe `GeminiImageProvider` via `ssrLoadModule`.

### Selezione provider

`resolveProviderId.ts` gestisce la priority chain:

1. Parametro esplicito `modelId` (se presente)
2. Default utente: `aiProviderDefault` da `pq_ui:v1`
3. Fallback: `ollama-minimax-m3` (registry default, MiniMax M3 via Ollama Pro)

### Thinking mode

Tutte le chiamate AI usano **thinking mode al massimo livello** (`reasoning_effort: 'max'` per DeepSeek, `think: 'max'` per Ollama). `temperature` non è più supportato (DeepSeek thinking mode lo ignora, Ollama non serve). Vedi `docs/agent-gotchas.md` §26 per dettagli.

---

## 3. Orchestratori

Ogni prodotto ha il suo orchestrator, tutti estendono `BaseOrchestrator`:

| Orchestrator | Prodotto | Tools | Note |
|---|---|---|---|
| `AIOrchestrator` | Preventivo | apply_layout, set_color_palette, set_section_visibility | Multi-turn, tool-aware |
| `CardAIOrchestrator` | Card | palette, layout, service, social cleanup | JSON round-trip |
| `FlyerAIOrchestrator` | Volantino | shorten_body, add_urgency | JSON round-trip |
| `LogoAIOrchestrator` | Logo | (no tools) | Dual provider: DeepSeek (testo) + Gemini (immagini) |
| `SocialAIOrchestrator` | Social | (no tools) | Genera 3 post (IG/FB/LI) |
| `OnboardingAIOrchestrator` | Onboarding | (no tools) | Suggerimenti nome/colori |

`BaseOrchestrator` fornisce: `sanitizeAIResponse`, `parseJsonResponse`, `handleStream`, `trackUsage`.

### Prompt registry

`src/ai/prompts/registry.ts` centralizza 8 prompt builder:
`system`, `card-system`, `flyer-system`, `flyer-copy`, `logo-system`, `social-system`, `onboarding-system`, `logo-concepts`.

---

## 4. Hooks client

| Hook | Orchestrator | Metodi chiave |
|------|-------------|---------------|
| `useAI` | `AIOrchestrator` | `processPrompt`, `refineQuote` |
| `useAICard` | `CardAIOrchestrator` | `processCardPrompt`, `generateCover`, `generatePhoto` |
| `useAIFlyer` | `FlyerAIOrchestrator` | `generate`, `refine`, `generateHero` |
| `useAILogo` | `LogoAIOrchestrator` | `generate`, `generateBackground` |
| `useAISocial` | `SocialAIOrchestrator` | `generate` |
| `useAIOnboarding` | `OnboardingAIOrchestrator` | `suggest` |
| `useAIIconHero` | (nessuno — direct fetch) | Chiama `/api/ai/icon-hero` direttamente |
| `useAIDesignReview` | (nessuno — direct fetch) | Chiama `/api/ai/design-review` direttamente |

### Logging

`useAILogs`: stream buffer con aggiornamento ogni ≥80 caratteri, persistito in `sessionStorage['pq_ai_logs:v1']` (max 100 entry). `imagePreviewBase64` strippato prima del persist (by design).

---

## 5. Localhost vs Produzione — Mappa completa

### Provider testo (DeepSeek, Ollama)

| Aspetto | Localhost | Produzione |
|---------|-----------|------------|
| Chiave | `localStorage['deepseekApiKey']` o `.env` `VITE_DEEPSEEK_API_KEY` | `process.env.DEPSEEK_API_KEY` |
| Endpoint | Diretto all'API provider | Proxy `/api/ai/chat` → provider |
| Rate limit | Nessuno | 30/min/IP server-side |
| Streaming | Diretto | SSE via `/api/ai/chat/stream` |
| Funziona? | **SI** (con key in .env o localStorage) | **SI** (con key in Vercel env) |

### Provider immagine (Gemini)

| Aspetto | Localhost | Produzione |
|---------|-----------|------------|
| Chiave | `.env` `GEMINI_API_KEY` o `VITE_GEMINI_API_KEY` | `process.env.GEMINI_API_KEY` |
| Endpoint | Dev proxy `vite.config.js` → `GeminiImageProvider` via `ssrLoadModule` | `/api/ai/logo-background` inline import |
| Rate limit | Nessuno | 5-10/min/IP |
| Funziona? | **SI** (con key in .env, proxy attivo) | **SI** (con key in Vercel env) |

### Gotcha dev noti

1. `vite.config.js` non si ricarica su HMR — serve restart manuale dopo modifiche al proxy
2. Path proxy dev deve combaciare esattamente col client (`/api/ai/logo-background`, non `/api/logo-background`)
3. `loadEnv()` in `vite.config.js` popola `process.env` per il dev server
4. Gemini richiede `response_modalities` minuscolo + `image_size: '512'` per clamp 500KB
5. Import statico di `@google/genai` crasha — solo import dinamico `await import()`
6. Cover AI "entrambi i lati" non deve essere parallela (sovraccarica upstream)

---

## 6. Endpoint API — Riepilogo completo

| Endpoint | Provider | Rate Limit | Funziona dev? | Funziona prod? |
|----------|----------|------------|---------------|----------------|
| `POST /api/ai/chat` | DeepSeek | 30/min | SI (via proxy) | SI |
| `POST /api/ai/chat/stream` | DeepSeek/Ollama | 30/min | SI (via proxy) | SI |
| `POST /api/ai/quote-refine` | DeepSeek | 10/min | SI | SI |
| `POST /api/ai/card-refine` | DeepSeek | 10/min | SI | SI |
| `POST /api/ai/flyer-refine` | DeepSeek | 10/min | SI | SI |
| `POST /api/ai/card-image` | Gemini | 5/min | SI (via proxy) | SI |
| `POST /api/ai/flyer-image` | Gemini | 5/min | SI (via proxy) | SI |
| `POST /api/ai/logo-background` | Gemini | 10/min | SI (via proxy) | SI |
| `POST /api/ai/icon-hero` | Gemini Flash | 5/min | SI (via proxy) | SI |
| `POST /api/ai/design-review` | Ollama MiniMax M3 | 10/min | SI (via proxy) | SI |
| `POST /api/ai/logo-config` | — | — | SI (via proxy) | SI |

---

## 7. Variabili d'ambiente AI

| Variabile | Scope | Necessaria per | Dev | Prod |
|-----------|-------|---------------|-----|------|
| `DEEPSEEK_API_KEY` | Server | Chat AI (tutti gli orchestratori) | `.env` | Vercel env |
| `GEMINI_API_KEY` | Server | Immagini (logo background, cover) | `.env` | Vercel env |
| `OLLAMA_API_KEY` | Server | Ollama Pro (minimax-m3, vision) | `.env` | Vercel env |
| `VITE_DEEPSEEK_API_KEY` | Client | Fallback dev se localStorage vuoto | `.env` | N/A |
| `VITE_GEMINI_API_KEY` | Client | Fallback dev (letto solo server-side) | `.env` | N/A |

**Mai esporre chiavi AI al bundle client.** Il frontend chiama sempre il proxy server-side.
