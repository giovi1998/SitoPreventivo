---
title: Website 4-Step Sequential Generation (HTML → CSS → JS → Verify)
version: 1.0
date_created: 2026-08-03
last_updated: 2026-08-03
owner: Founder
tags: [design, ai, website, schema, process]
---

# Introduction

Il Website Builder genera siti web tramite **4 agenti AI sequenziali** (HTML → CSS → JS → Verify) invece di una singola chiamata. Ogni step è specializzato e produce output più pulito. Questa spec definisce il formato di ogni step, i vincoli, e il comportamento atteso.

## 1. Purpose & Scope

**Purpose**: generare siti web HTML5 completi (struttura + stile + interazioni) con qualità elevata usando 4 chiamate AI separate, ognuna con prompt specializzato.

**Scope**: `src/ai/websiteOrchestrator.ts`, `src/ai/prompts/websiteSystem.ts`, `src/hooks/useAIWebsite.ts`, `src/components/WebsiteEditor.tsx`.

**Not in scope**: immagini hero (gestite separatamente), edit manuale codice, export ZIP.

## 2. Definitions

- **HTML agent**: primo step, genera struttura HTML5 semantica con classi standard.
- **CSS agent**: secondo step, riceve l'HTML come contesto e genera CSS responsive.
- **JS agent**: terzo step, riceve l'HTML come contesto e genera JavaScript vanilla.
- **Verify agent**: quarto step, riceve HTML+CSS+JS e controlla coerenza.
- **Fresh session**: ogni step usa messaggio array nuovo `[{role:'system'}, {role:'user'}]`, NON `buildMessages()` che accumula storia.
- **Streaming**: solo HTML usa stream (progresso visibile aggiuntivo). CSS/JS/Verify usano `provider.chat()` (non-stream) per stabilità.
- **maxTokens**: 8192 per tutti gli step (eccetto Verify: 2048).

## 3. Requirements, Constraints & Guidelines

### Functional Requirements

- **REQ-001**: Ogni step deve usare array messaggi freschi `[{role:'system'}, {role:'user'}]` — mai `buildMessages()` che accumula storia.
- **REQ-002**: HTML: streaming (`handleStream` con `onStream`), maxTokens 8192.
- **REQ-003**: CSS: non-streaming (`provider.chat()`), maxTokens 8192, riceve HTML come contesto completo (max 5000 char).
- **REQ-004**: JS: non-streaming (`provider.chat()`), maxTokens 8192, riceve HTML come contesto completo (max 5000 char).
- **REQ-005**: Verify: non-streaming (`provider.chat()`), maxTokens 2048, riceve HTML+CSS+JS troncati.
- **REQ-006**: Ogni step logga separatamente nell'AIConsole: "Prompt HTML inviato", "HTML generato", "CSS generato", "JS generato", "Verifica completata".
- **REQ-007**: Se uno step fallisce (parse error o content vuoto), logga `error:{step}:{reason}` e usa fallback vuoto (senon HTML).

### Constraints

- **CON-001**: Solo HTML usa streaming (progresso visibile). CSS/JS/Verify non-stream per stabilità con DeepSeek.
- **CON-002**: Tutti gli step usano `temperature: 0.7` (eccetto Verify: 0.3).
- **CON-003**: Tutti gli step usano `responseFormat: { type: 'json_object' }`.
- **CON-004**: Le sezioni richieste nel brief (`hero, chi_siamo, contatti`) DEVONO essere tutte presenti nell'HTML.
- **CON-005**: L'hamburger `<button class="menu-toggle">☰</button>` è obbligatorio nell'HTML.
- **CON-006**: Il logo non deve essere incluso nell'HTML generato dall'AI. Viene iniettato dopo via `injectLogoIntoHtml`.

### Guidelines

- **GUD-001**: CSS deve usare `:root` per variabili colore (primary, secondary, accent, bg, text, font).
- **GUD-002**: CSS deve usare CSS Grid/Flexbox. Media query a 768px e 480px.
- **GUD-003**: JS deve essere vanilla ES6+, progressive enhancement.
- **GUD-004**: I link tra pagine devono essere relativi (`href="about.html"`).
- **GUD-005**: Il brand wrapper (logo + nome) deve stare SEMPRE sulla stessa riga (flex, align-items:center).

## 4. Interfaces & Data Contracts

### 4.1 WebsiteOrchestrator.generateSite

```typescript
async generateSite(
  brief: {
    businessName: string;
    sector: string;
    description: string;
    tone: string;
    target: string;
    pages: string;
    preferredColors: string;
    font: string;
    cta: string;
    sections: string;
    features: string;
    contacts: string;
    socials: { platform: string; url: string }[];
    mapsUrl: string;
    notes: string;
  },
  options: {
    style?: string;
    briefContext?: string;
    modelId?: string;
    onStream?: (chunk: AIStreamChunk) => void;
    userEmail?: string;
    logoBase64?: string;
    scrapedReference?: string;
  } = {},
): Promise<WebsiteProcessResult>
```

### 4.2 Output per step

| Step | Method | maxTokens | Schema output | Fallback |
|------|--------|-----------|---------------|----------|
| HTML | `handleStream` | 8192 | `{ html, pages }` | `fallbackWebsiteOutput` |
| CSS | `provider.chat` | 8192 | `{ css }` | `''` |
| JS | `provider.chat` | 8192 | `{ js }` | `''` |
| Verify | `provider.chat` | 2048 | `{ issues, fixes? }` | no-op |

### 4.3 Prompt structure per step

```
System prompt (from registry: website-html / website-css / website-js / website-verify)
User prompt (from builder: buildWebsiteHtmlPrompt / buildWebsiteCssPrompt / buildWebsiteJsPrompt / buildWebsiteVerifyPrompt)
```

## 5. Acceptance Criteria

- **AC-001**: Given un brief completo, When genero il sito, Then log AI mostra 4 step separati (HTML, CSS, JS, Verify).
- **AC-002**: Given HTML generato, When CSS viene richiamato, Then CSS riceve l'HTML completo come contesto (non la storia sessione).
- **AC-003**: Given HTML con hamburger button, When JS viene richiamato, Then JS genera toggle per `.menu-toggle`.
- **AC-004**: Given un sito generato, When ispezionato il CSS, Then include media query 768px e 480px, variabili `:root`, stili per tutte le classi HTML.
- **AC-005**: Given un sito generato, When ispezionato il JS, Then include smooth scroll, hamburger toggle, header scroll, anno corrente, intersection observer.
- **AC-006**: Given un brief con mapsUrl, When genero il sito, Then l'HTML contiene un iframe con `https://maps.google.com/maps?q=...&output=embed` (funzionante) invece di un link.
- **AC-007**: Given un sito generato, When cambio stile con pill, Then solo il CSS cambia (HTML e JS restano identici).

## 6. Test Automation Strategy

- **Test Levels**: Unit (schema, orchestrator, prompt), Integration (editor)
- **Frameworks**: Vitest + RTL
- **Key test files**:
  - `src/ai/__tests__/websiteOrchestrator.test.ts` — 4 step sequential, fresh session per step
  - `src/hooks/__tests__/useAIWebsite.test.ts` — hook wrapping
  - `src/components/__tests__/WebsiteEditor.test.tsx` — brief input, preview update
- **Test Data**: `createEmptyWebsite()` per test puri, mock AI response per orchestrator.
- **Coverage**: nuovi file ≥60%

## 7. Rationale & Context

**Perché 4 step separati invece di 1 chiamata?**

Una singola chiamata AI genera HTML+CSS+JS (max ~15k caratteri). DeepSeek troncava la risposta a 4096 token → JSON invalido → fallback "Siamo in costruzione".

Separando in 4 step:
1. Ogni step produce output più piccolo (~3-5k caratteri) → mai troncato.
2. Ogni step specializzato su un task → qualità superiore.
3. CSS riceve HTML come contesto → stile preciso su classi reali.
4. JS riceve HTML come contesto → interazioni mirate su elementi reali.
5. Verify controlla incoerenze → catcha errori prima che arrivino all'utente.

**Perché streaming solo per HTML?**

Lo streaming serve per mostrare progresso in tempo reale (l'utente vede il sito "nascere"). HTML è il task più lungo (~90s), quindi streaming è utile. CSS/JS sono più veloci (~30-40s ciascuno) e DeepSeek a volte manda risposte vuote via streaming per json_object con contenuto multi-riga. Non-streaming è più stabile.

**Perché fresh session per ogni step?**

`buildMessages()` accumulava tutti i messaggi nella sessione: HTML prompt + HTML response + CSS prompt + JS prompt. L'AI vedeva tutto insieme e si confondeva, producendo output vuoto. Con array freschi `[{role:'system'}, {role:'user'}]` ogni step ha contesto pulito solo del suo task.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: DeepSeek API (via proxy `/api/ai/chat`) — generazione testo per tutti gli step.

### Third-Party Services
- **SVC-001**: Ollama Pro Cloud (MiniMax M3) — provider vision alternativo (logo upload).

### Infrastructure Dependencies
- **INF-001**: Vercel Serverless Function (`api/index.ts`) — proxy DeepSeek API con max_tokens.

### Data Dependencies
- **DAT-001**: `precisionQuote_documents:v1` / `documents` table — storage documenti website (flat domain type).

### Technology Platform Dependencies
- **PLT-001**: Vite dev server proxy (`vite.config.js`) — dev proxy `/api/ai/*` per local dev.

### Compliance Dependencies
- **COM-001**: GDPR — il sito generato non raccoglie dati personali (nessun form backend).

## 9. Examples & Edge Cases

### 9.1 Normal flow (gelateria)

```json
// Brief
{
  "businessName": "Gelateria Chiccheria",
  "sector": "gelateria",
  "description": "Attività settore gelateria artigianale e vincitore",
  "sections": "hero, chi_siamo, contatti",
  "cta": "Assaggia la differenza",
  "mapsUrl": "https://maps.app.goo.gl/nQJVQr2cueJyismr8",
  "style": "elegant"
}

// Step 1: HTML (streaming, ~90s)
// → genera: nav con menu-toggle, hero con CTA, chi-siamo, contatti con iframe maps embed, footer

// Step 2: CSS (non-stream, ~30s)
// → genera: :root variabili, flex layout, media query 768px, hamburger hidden desktop / visible mobile

// Step 3: JS (non-stream, ~40s)
// → genera: smooth scroll, hamburger toggle, header scroll, anno corrente, intersection observer

// Step 4: Verify (non-stream, ~20s)
// → controlla: classi CSS presenti in HTML? JS referenzia elementi esistenti? maps iframe valido?
```

### 9.2 Edge cases

- **HTML step fallisce**: fallback "Siamo in costruzione" con stile base. Non si procede con CSS/JS.
- **CSS step fallisce**: css = `''`, sito non stilizzato ma funzionante. Log errore.
- **JS step fallisce**: js = `''`, sito funzionante ma senza interazioni. Log errore.
- **Verify trova issues**: applica fixes se disponibili (ricostruzione parziale). Log per ogni fix applicato.
- **Logo senza header**: `injectLogoIntoHtml` inserisce logo nel primo tag del body se non trova `<header>`.
- **Brief senza sezioni**: prompt include default `hero, chi_siamo, contatti`.
- **Maps URL mancante**: nessun iframe maps generato.
- **Logo base64 lungo**: passato come `images: [base64]` nel messaggio Ollama (non inline nel testo).

## 10. Validation Criteria

- **VC-001**: `npm run typecheck` passa con i nuovi file.
- **VC-002**: `npm run test` passa con test esistenti (nessun break).
- **VC-003**: Il sito generato mostra l'anteprima corretta (HTML+CSS+JS).
- **VC-004**: Il sito ha media query responsive (max-width: 768px e 480px).
- **VC-005**: L'hamburger menu funziona (toggle nav-open).
- **VC-006**: Google Maps iframe embed funziona (non X-Frame-Options blocked).
- **VC-007**: Il brand (logo + nome) sta sulla stessa riga in desktop.
- **VC-008**: Log AI mostra 4 step separati con tempi e caratteri.

## 11. Related Specifications / Further Reading

- `docs/spec/spec-design-website-builder.md` — spec originale Website Builder
- `docs/spec/spec-design-ai-harness-upgrade.md` — AI harness upgrade (TB-023)
- `docs/agent-gotchas.md` — gotchas Vercel, localStorage, flat domain type
- `AGENTS.md` — architettura app, pattern AI
- [spec-infrastructure]: Vercel function bundling (gotcha §1)
