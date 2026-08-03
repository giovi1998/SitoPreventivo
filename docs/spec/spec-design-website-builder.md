---
title: Website Builder — AI-Powered HTML Site Generation
version: 1.2
date_created: 2026-08-03
last_updated: 2026-08-03
owner: Founder
tags: [design, frontend, backend, ai, schema]
---

# Introduction

Specifica il modulo **Website Builder** che permette all'admin di generare siti web HTML completi tramite AI, visualizzare l'anteprima live con toggle mobile/tablet/desktop, modificare il codice manualmente con CodeMirror 6, ed esportare il sito come ZIP. Il sito è composto da HTML, CSS e JavaScript puri (vanilla), generati dall'AI in base a un brief strutturato (non solo textarea: l'admin compila campi specifici che guidano l'AI). L'admin può iterare: modifica il brief, rigenera, modifica il codice a mano, raffina con AI.

## 1. Purpose & Scope

**Purpose**: aggiungere un nuovo tipo documento `website` all'app Quickbrand, con editor dedicato, AI orchestrator, preview iframe con viewport toggle, code editor (CodeMirror 6 in chunk separato), export ZIP multi-pagina, e integrazione con CRM auto-build e Collection.

**Scope**:
- Nuovo tipo documento `website` con schema Zod, factory, merge
- Editor pagina `/app/website` e `/app/website/:docId`
- AI orchestrator `WebsiteOrchestrator` che genera HTML/CSS/JS completi
- System prompt specializzato per generazione siti web
- Preview live via iframe `srcdoc` con toggle viewport (375px mobile / 768px tablet / 100% desktop)
- Code editor con CodeMirror 6 (syntax highlighting HTML/CSS/JS), lazy import in chunk separato
- Export ZIP con file separati per pagina, assets/ per immagini grandi
- Integrazione CRM: auto-build genera bozza sito, CustomerDetail mostra preview
- Integrazione Collection: tab `website`, preview SVG, AI stats, export
- Generazione immagini: Gemini (via endpoint `/api/ai/logo-background` esistente) per hero/background, SVG inline per icone/decorazioni
- Upload logo/immagine brand: sidebar con preview, compressione automatica, persistenza in `logoUrl`
- Vision AI sul logo: estrazione SOLO palette colori e stile font (non layout/contenuti)
- Logo iniettato nell'HTML generato dopo `<nav>`/`<header>`/`<body>`
- AIProviderBadge nella sidebar per selezione provider AI
- Admin-only (stessa guardia dell'editor preventivi)

**Out of scope**:
- Deploy su Vercel/Netlify dall'app (export ZIP + upload manuale)
- Editor visuale (drag-and-drop, WYSIWYG) — solo code + AI
- Framework React/Astro/Svelte (solo vanilla HTML in v1)
- CMS backend (il sito è statico, generato)
- Hosting gestito
- Multi-tenant (admin unico)
- Generazione immagini via endpoint dedicato — si riusa `/api/ai/logo-background`

**Intended audience**: admin (founder) che costruisce siti per clienti. I clienti non accedono all'editor.

**Assumptions**:
- L'app Quickbrand esiste e funziona (fase 14+)
- CodeMirror 6 è installabile via npm (`codemirror`, `@codemirror/lang-html`, `@codemirror/lang-css`, `@codemirror/lang-javascript`, `@codemirror/theme-one-dark`)
- Gemini API key è già configurata (usata da altri orchestratori)
- Il pattern `BaseOrchestrator` + `promptRegistry` è consolidato
- I pattern di persistenza (flat domain type, localStorage, API) sono consolidati
- L'endpoint `/api/ai/logo-background` già gestisce image generation con Gemini; riusato per hero images (formato 16:9 o libero via parametro aspect ratio)

## 2. Definitions

- **Website**: documento di tipo `website` contenente HTML, CSS, JS, metadati (framework, style, pages)
- **Brief**: insieme strutturato di campi che descrivono il sito desiderato (14 campi, non solo textarea libero)
- **Brief form**: pannello con campi specifici che guidano l'AI: nome attività, settore, descrizione, tono, target, pagine richieste, colori preferiti, font, CTA, sezioni, feature, contatti, social, note
- **Framework**: `'vanilla'` — solo HTML/CSS/JS puri (v1)
- **Style**: tema visivo — `'modern' | 'minimal' | 'corporate' | 'creative' | 'brutalist' | 'elegant' | 'vintage' | 'tech' | 'organic' | 'playful' | 'luxury' | 'editorial' | 'dark'`
- **Pages**: array di nomi pagina (es. `['index', 'about', 'services', 'contact']`)
- **Preview**: iframe che renderizza il codice generato via `srcdoc`
- **Viewport toggle**: switch Mobile (375px) / Tablet (768px) / Desktop (100%) che ridimensiona l'iframe per testare responsive
- **CodeMirror**: editor di codice professionale con syntax highlighting, importato lazy in chunk separato
- **Hero image**: immagine principale generata da Gemini (prompt → API endpoint `/api/ai/logo-background`)
- **SVG icon**: icona/decorazione generata inline nell'HTML (zero costo API)
- **Export ZIP**: archivio contenente file `.html` separati per pagina
- **Auto-build**: pipeline CRM che genera bozze documento (incluso website) dai dati cliente
- **Refine**: iterazione AI su codice esistente (modifica parziale, non rigenera da zero)

## 3. Requirements, Constraints & Guidelines

### Functional Requirements — Brief Form

- **REQ-001**: L'editor deve presentare un form strutturato con 14 campi che guidano l'AI, non un semplice textarea libero
- **REQ-002**: I 14 campi del brief form sono:
  1. **Nome attività** (stringa, max 100, required) — es. "Panetteria Artigianale"
  2. **Settore** (stringa libera, max 50, placeholder "es. tech, food, fashion...") — l'UI mostra suggerimenti ma l'utente scrive qualsiasi valore
  3. **Descrizione** (textarea, max 1000, required) — cosa fa l'attività
  4. **Tono/Stile comunicativo** (stringa libera, max 50, placeholder "es. professionale, amichevole, lussuoso...")
  5. **Target audience** (stringa, max 200) — es. "Giovani professionisti 25-40 anni"
  6. **Pagine richieste** (stringa, max 300, placeholder "index, about, contact...") — l'utente scrive liberamente, l'AI interpreta
  7. **Colori preferiti** (stringa, max 200) — es. "Blu scuro e oro" o "#01696F, #1a1a2e"
  8. **Font preferito** (stringa, max 50, placeholder "es. Inter, Georgia, Playfair Display...")
  9. **Call-to-action principale** (stringa, max 100) — es. "Richiedi un preventivo gratuito"
  10. **Sezioni desiderate** (stringa, max 300, placeholder "hero, chi_siamo, servizi, contatti...")
  11. **Feature speciali** (stringa, max 300) — es. "Galleria foto, form contatto, calcolatore prezzi"
  12. **Contatti** (stringa, max 300) — es. "Via Roma 1, 00100 Roma, info@panetteria.it"
  13. **Social links** (array di `{ platform, url }`) — es. `[{platform:"Instagram", url:"@panetteria"}]`; UI con bottone "+" per aggiungere
  14. **Google Maps URL** (stringa, max 500) — embed o link alla mappa
  15. **Note extra** (textarea, max 500) — es. "Il cliente vuole design simile a www.esempio.com"
- **REQ-003**: I campi required (nome attività, descrizione) devono essere validati prima di chiamare l'AI
- **REQ-004**: I campi con valori di default sensati (es. settore = other, tono = professionale) non bloccano la generazione

### Functional Requirements — AI Generation

- **REQ-005**: Click "Genera" → costruisce prompt strutturato dai 15 campi → chiama `WebsiteOrchestrator.generateSite(brief, options)` → AI produce JSON con `{ html, css, js, pages[] }`. **Genera da zero**: non usa codice esistente.
- **REQ-006**: Click "Raffina" → textarea per istruzione → `WebsiteOrchestrator.refineSite(site, instruction)` → AI modifica il codice **esistente** (merge parziale: se l'istruzione dice "cambia solo i colori", HTML/JS restano identici). Non rigenera da zero.
- **REQ-007**: La preview iframe deve aggiornarsi automaticamente dopo la generazione o raffinamento AI
- **REQ-008**: L'admin deve poter caricare un logo/immagine brand (sidebar, upload file → compressDataUrl → `logoUrl` nello schema)
- **REQ-009**: Se `logoUrl` è presente e il provider AI supporta vision (MiniMax M3), l'immagine viene passata all'AI per estrarre SOLO palette colori e stile font — NON per decidere layout, contenuti o struttura (quelli vengono dal brief)
- **REQ-010**: Dopo la generazione AI, il logo viene iniettato nell'HTML generato (dopo `<nav>`, `<header>`, o `<body>` come fallback) tramite `injectLogoIntoHtml()`
- **REQ-011**: L'auto-save (30s) viene saltato mentre l'AI sta generando (`isProcessingRef` guard) per non sovrascrivere il risultato fresco
- **REQ-012**: L'admin deve poter selezionare il provider AI tramite `AIProviderBadge` nella sidebar del brief
- **REQ-013**: L'AI deve generare immagini hero/background via Gemini (prompt → base64) quando richiesto dal brief
- **REQ-014**: L'AI deve generare icone e decorazioni come SVG inline (zero costo API immagini)
- **REQ-015**: L'AI deve decidere autonomamente se il sito è single-page (sezioni scroll) o multi-pagina (file separati) in base alla complessità del brief
- **REQ-016**: L'admin può forzare single-page o multi-pagina via toggle nell'interfaccia
- **REQ-017**: Il codice generato deve essere HTML5 valido, con `<meta viewport>`, semantic tags, e responsive base
- **REQ-018**: Il CSS deve usare CSS Grid / Flexbox per layout, con media query per mobile (breakpoint 768px)
- **REQ-019**: Il JS deve essere vanilla ES6+, senza dipendenze esterne (CDN solo se esplicitamente richiesto)
- **REQ-020**: L'export ZIP deve includere un file `index.html` completo (con `<style>` e `<script>` inline o linkati)
- **REQ-021**: In modalità multi-pagina, ogni pagina è un file `.html` separato, con link `<a>` relativi tra pagine
- **REQ-022**: L'AI stats per-document (TB-026) deve tracciare le chiamate con kind `'websiteCode'` (generazione testo) e `'hero'` (immagini Gemini)

### Admin-Only Access

- **REQ-023**: La route `/app/website` e `/app/website/:docId` deve essere protetta da `AdminEditorRoute` (stessa guardia dell'editor preventivi)
- **REQ-024**: Il bottone sidebar "Sito Web" deve essere visibile solo agli admin
- **REQ-025**: Il tab `website` in Collection deve essere visibile a tutti gli utenti loggati (solo lettura per non-admin)

### AI Orchestration

- **REQ-026**: `WebsiteOrchestrator` deve estendere `BaseOrchestrator` (non ToolAware — nessun tool necessario)
- **REQ-027**: `generateSite(brief, options)` deve costruire il prompt strutturato dai 14 campi del brief form + style + contesto cliente (se da CRM)
- **REQ-028**: La risposta AI deve essere JSON validato da `websiteAIOutputSchema` con campi: `html`, `css`, `js`, `pages[]`, `heroPrompts[]` (opzionale, per generazione immagini)
- **REQ-029**: Dopo la risposta AI testuale, se `heroPrompts` è presente, l'orchestratore deve chiamare Gemini in parallelo per ogni prompt via endpoint `/api/ai/logo-background` e incorporare le immagini base64 nel CSS come `background-image`
- **REQ-030**: `refineSite(site, instruction)` deve inviare all'AI il codice corrente + istruzione di modifica, ricevere JSON con solo i campi modificati (merge parziale)
- **REQ-031**: Il system prompt deve essere registrato in `promptRegistry` con id `'website-system'`
- **REQ-032**: Il prompt deve istruire l'AI a generare codice completo, funzionante, con commenti minimi, e struttura responsive

### Preview

- **REQ-033**: La preview deve usare un `<iframe>` con `srcdoc` contenente HTML + CSS in `<style>` + JS in `<script>`
- **REQ-034**: L'iframe deve avere `sandbox="allow-scripts"` (no form submit, no popup, no same-origin)
- **REQ-035**: L'iframe deve avere viewport toggle con 3 modalità: Mobile (375px larghezza), Tablet (768px), Desktop (100%) — il toggle cambia la larghezza dell'iframe, non lo zoom
- **REQ-036**: Il viewport toggle deve essere una pill row con 3 bottoni (📱 375, 📱 768, 🖥 Desktop), stato attivo persistito in `pq_ui:v1`
- **REQ-037**: L'altezza dell'iframe deve essere fissa 600px con scroll verticale
- **REQ-038**: Un bottone "Apri in nuova tab" deve aprire il codice in una tab separata per debug con DevTools

### Code Editor (CodeMirror 6)

- **REQ-039**: L'editor deve usare CodeMirror 6 con i language package per HTML, CSS, JavaScript
- **REQ-040**: Tre tab: HTML, CSS, JS — ogni tab ha la propria istanza CodeMirror
- **REQ-041**: Tema scuro di default (One Dark) coerente con l'app
- **REQ-042**: Le modifiche in qualsiasi tab devono aggiornare la preview con debounce 500ms
- **REQ-043**: Il passaggio tra tab non deve perdere lo stato dell'editor (istanze persistenti in React ref)
- **REQ-044**: CodeMirror deve essere importato lazy (dynamic import) in chunk separato (`manualChunks` in `vite.config.js`) — mai statico nel bundle principale

### Export ZIP

- **REQ-045**: L'export deve generare un archivio ZIP via `JSZip` (già in uso per favicon export)
- **REQ-046**: Single-page: unico file `index.html` con CSS e JS inline
- **REQ-047**: Multi-pagina: `index.html`, `about.html`, `services.html`, `contact.html` ecc., ogni file con il proprio CSS/JS inline
- **REQ-048**: Se ci sono immagini base64 grandi (>50KB), devono essere salvate in `assets/` come file separati e referenziate via path relativo
- **REQ-049**: Il nome del file ZIP deve essere `sito-{businessName}.zip` o `website-{id}.zip`
- **REQ-050**: L'export deve essere disponibile anche dalla Collection (bottone export sul card item)

### CRM Integration

- **REQ-051**: `autoBuildCustomer()` in `crm.js` deve creare un draft `website` con dati dal cliente
- **REQ-052**: `useAutoBuildGenerate.ts` deve supportare `'website'` in `GENERATABLE_ORDER` con `generateWebsiteDraft()`
- **REQ-053**: `CustomerDetail.tsx` deve mostrare il draft website con preview SVG, bottone "Apri editor" e "Rigenera"
- **REQ-054**: `DOC_EDITOR_VIEW` in CustomerDetail deve includere `website: 'website'`
- **REQ-055**: Il draft website deve includere `briefContext` dal cliente per guidare l'AI

### Collection Integration

- **REQ-056**: CollectionView deve avere tab `website` con icona e label "Siti Web"
- **REQ-057**: La preview SVG per website deve mostrare un'icona rappresentativa (monitor/globe) con il titolo
- **REQ-058**: AI stats badge deve funzionare per documenti website
- **REQ-059**: Duplicazione documento website supportata (stessa logica di logo/card/flyer)
- **REQ-060**: Export ZIP dalla Collection (bottone export sul card)

### Schema & Data

- **REQ-061**: `documentTypeSchema` in `shared.ts` deve includere `'website'`
- **REQ-062**: `isFlatDomainType` in `documents.js` deve includere `'website'` (storage flat come logo/card/flyer)
- **REQ-063**: `canDuplicate()` in `documents.js` deve includere `'website'`
- **REQ-064**: `intakeToDocument.ts` deve avere `intakeToWebsite()` che mappa brief → draft website
- **REQ-065**: `docPreviewSvg.ts` deve gestire `case 'website'` con SVG placeholder
- **REQ-066**: `EditorKind` in `uiPrefs.ts` deve includere `'website'`
- **REQ-067**: `AI_CALL_KINDS` in `aiStats.ts` deve includere `'websiteCode'`
- **REQ-068**: `ROUTE_PATHS` in `useRouteView.ts` deve includere `website: '/app/website'`
- **REQ-069**: `UseDocumentLoaderOptions` in `useDocumentLoader.ts` deve supportare `'website'`

### Constraints

- **CON-001**: Nessuna dipendenza runtime esterna per il sito generato (CDN solo se admin lo richiede esplicitamente)
- **CON-002**: Il codice generato non deve contenere chiamate API a server esterni (nessun backend)
- **CON-003**: Le immagini Gemini devono essere compresse prima del salvataggio (stessa logica di `compressDataUrl`)
- **CON-004**: CodeMirror importato lazy (dynamic import) — mai statico nel bundle principale
- **CON-005**: La preview iframe deve usare `sandbox` restrittivo per sicurezza
- **CON-006**: Il codice generato non deve contenere credenziali, token, o dati sensibili
- **CON-007**: L'export ZIP non deve superare 10MB (limite Vercel serverless per upload, ma è client-side quindi nessun limite hard — buona pratica)

### Guidelines

- **GUD-001**: Il CSS generato deve usare variabili CSS custom per colori primari/secondari (facile rebranding)
- **GUD-002**: Le immagini hero devono avere fallback gradient nel CSS (se Gemini fallisce, il sito non è rotto)
- **GUD-003**: I SVG inline devono usare viewBox e currentColor per adattarsi al tema
- **GUD-004**: Il JS generato deve essere progressive enhancement (il sito funziona anche senza JS)
- **GUD-005**: L'AI deve generare contenuti placeholder realistici (es. "La nostra panetteria artigianale..." invece di "Lorem ipsum")
- **GUD-006**: I link tra pagine devono essere relativi (`href="about.html"`) per funzionare sia in preview che in export

## 4. Interfaces & Data Contracts

### 4.1 Website Schema (`src/utils/schemas/website.ts`)

```typescript
// Zod schema — tutti i campi selettore sono stringhe libere (non enum).
// L'UI mostra preset/suggerimenti ma l'utente può scrivere qualsiasi valore.
// L'AI usa il testo così com'è, senza validazione su valori permessi.

export const websiteStyleSchema = z.enum(['modern', 'minimal', 'corporate', 'creative', 'brutalist', 'elegant', 'vintage', 'tech', 'organic', 'playful', 'luxury', 'editorial', 'dark']);
export type WebsiteStyle = z.infer<typeof websiteStyleSchema>;

// 14 campi del brief form — tutti stringhe libere tranne style
export const websiteBriefSchema = z.object({
  businessName: z.string().min(1, 'Nome attività richiesto').max(100),
  sector: z.string().max(50).default(''),
  description: z.string().min(1, 'Descrizione richiesta').max(1000),
  tone: z.string().max(50).default(''),
  target: z.string().max(200).default(''),
  pages: z.string().max(300).default('index'),       // "index, about, contact" — stringa, non array
  preferredColors: z.string().max(200).default(''),
  font: z.string().max(50).default(''),
  cta: z.string().max(100).default(''),
  sections: z.string().max(300).default('hero, chi_siamo, contatti'),  // stringa, non array
  features: z.string().max(300).default(''),
  contacts: z.string().max(300).default(''),
  socials: z.array(z.object({ platform: z.string().max(50), url: z.string().max(300) })).default([]),
  mapsUrl: z.string().max(500).default(''),
  notes: z.string().max(500).default(''),
});
export type WebsiteBrief = z.infer<typeof websiteBriefSchema>;

export const websiteSchema = z.object({
  documentType: z.literal('website'),
  id: z.string().min(1),
  userEmail: z.string().email().optional(),
  customerId: z.string().optional(),
  title: z.string().default(''),
  brief: websiteBriefSchema.default({
    businessName: '',
    sector: 'other',
    description: '',
    tone: 'professionale',
    target: '',
    pages: ['index'],
    preferredColors: '',
    font: 'nessuna_preferenza',
    cta: '',
    sections: ['hero', 'chi_siamo', 'contatti'],
    features: '',
    contacts: '',
    socials: [],
    mapsUrl: '',
    notes: '',
  }),
  briefContext: z.string().optional(),
  html: z.string().default(''),
  css: z.string().default(''),
  js: z.string().default(''),
  framework: z.literal('vanilla').default('vanilla'),
  style: websiteStyleSchema.default('modern'),
  pages: z.array(z.string()).default(['index']),
  source: z.enum(['ai', 'manual']).default('ai'),
  aiStats: aiStatsSchema.optional(),
  autoGeneratePending: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Website = z.infer<typeof websiteSchema>;

export function createEmptyWebsite(): Website { /* factory con defaults */ }
export function mergeWebsiteWithDefaults(input: Partial<Website> | null | undefined): Website { /* defensive merge */ }
```

### 4.2 AI Output Schema (`src/ai/websiteOrchestrator.ts`)

```typescript
export const websiteAIOutputSchema = z.object({
  html: z.string().min(1, 'HTML richiesto'),
  css: z.string().default(''),
  js: z.string().default(''),
  pages: z.array(z.string()).min(1).default(['index']),
  heroPrompts: z.array(z.string()).max(5).optional(),
  description: z.string().optional(), // breve spiegazione delle scelte fatte
});
export type WebsiteAIOutput = z.infer<typeof websiteAIOutputSchema>;
```

### 4.3 Prompt Builder Input

Il prompt per `generateSite` è costruito dai 14 campi del brief form. I campi sono stringhe libere (l'utente scrive ciò che vuole, l'AI interpreta). L'UI mostra placeholder/suggerimenti ma non vincola.

```
# Richiesta generazione sito web

## Dati attività
- Nome: {businessName}
- Settore: {sector}
- Descrizione: {description}

## Stile e comunicazione
- Tono: {tone}
- Target: {target}
- Stile visivo: {style}
- Font preferito: {font}
- Colori preferiti: {preferredColors}

## Struttura
- Pagine richieste: {pages}
- Sezioni desiderate: {sections}
- Call-to-action principale: {cta}
- Feature speciali: {features}

## Contatti e social
- Contatti: {contacts}
- Social:
  - {platform}: {url}
- Google Maps: {mapsUrl}

## Note extra
{notes}

## Contesto cliente (se da CRM)
{briefContext}

Genera un sito web HTML5 completo, responsive, con CSS e JavaScript.
Rispondi SOLO con un oggetto JSON contenente: html, css, js, pages[], heroPrompts[].
```

### 4.3 AI Refine Output Schema

```typescript
export const websiteAIRefineSchema = z.object({
  html: z.string().optional(),   // solo se modificato
  css: z.string().optional(),    // solo se modificato
  js: z.string().optional(),     // solo se modificato
  pages: z.array(z.string()).optional(),
  description: z.string().optional(),
});
export type WebsiteAIRefine = z.infer<typeof websiteAIRefineSchema>;
```

### 4.4 WebsiteOrchestrator API

```typescript
export class WebsiteOrchestrator extends BaseOrchestrator {
  async generateSite(
    brief: string,
    options: {
      style?: WebsiteStyle;
      pages?: string[];
      briefContext?: string;
      modelId?: string;
      onStream?: (chunk: AIStreamChunk) => void;
      userEmail?: string;
    } = {},
  ): Promise<WebsiteProcessResult>;

  async refineSite(
    site: { html: string; css: string; js: string; pages: string[] },
    instruction: string,
    options: {
      modelId?: string;
      onStream?: (chunk: AIStreamChunk) => void;
      userEmail?: string;
    } = {},
  ): Promise<WebsiteRefineResult>;
}

export interface WebsiteProcessResult {
  site: { html: string; css: string; js: string; pages: string[] };
  response: AIResponse;
  sessionId: string;
  changes: string[];
  heroImages: Array<{ prompt: string; base64: string }>;  // immagini generate
  aiCall?: { kind: 'websiteCode'; costUsd: number };
  heroCalls?: Array<{ kind: 'hero'; costUsd: number }>;
}

export interface WebsiteRefineResult {
  site: { html: string; css: string; js: string; pages: string[] };
  changes: string[];
  response: AIResponse;
}
```

### 4.5 System Prompt (`src/ai/prompts/websiteSystem.ts`)

Il prompt deve istruire l'AI a:

1. Generare HTML5 valido con `<meta name="viewport">`, semantic tags (`<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`)
2. CSS con variabili custom `:root { --primary, --secondary, --accent, --bg, --text }`, CSS Grid/Flexbox, media query 768px
3. JS vanilla ES6+ per interazioni base (menu hamburger mobile, smooth scroll, form validation)
4. Contenuti placeholder realistici in italiano (coerenti col brief)
5. Immagini hero: generare `<div class="hero" style="background-image: ...">` con gradient fallback; l'orchestratore sostituirà con immagini Gemini
6. Icone: SVG inline per social, menu, decorazioni
7. Multi-pagina: se il brief richiede >1 pagina, generare link relativi; ogni pagina è autonoma (ha il suo CSS/JS completo)
8. Single-page: sezioni con `id` per navigazione anchor, scroll smooth
9. NO dipendenze CDN esterne (salvo richiesta esplicita)
10. NO commenti nel codice (tranne header con versione/data)
11. Output JSON con `html`, `css`, `js`, `pages[]`, `heroPrompts[]`

### 4.6 Preview Iframe con Viewport Toggle

```html
<div class="viewport-controls">
  <button class="viewport-btn active" data-width="100%">🖥 Desktop</button>
  <button class="viewport-btn" data-width="768px">📱 768px</button>
  <button class="viewport-btn" data-width="375px">📱 375px</button>
</div>
<div class="preview-wrapper" style="max-width: var(--viewport-width, 100%); transition: max-width 0.3s;">
  <iframe
    sandbox="allow-scripts"
    srcdoc={fullDocument}
    title="Anteprima sito"
    style="width:100%; height:600px; border:1px solid var(--border); border-radius:8px; background:#fff;"
  />
</div>
```

Dove `fullDocument` è:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>/* CSS generato */</style>
</head>
<body>
  <!-- HTML generato -->
  <script>/* JS generato */</script>
</body>
</html>
```

### 4.7 Export ZIP Structure

```
sito-NomeAttivita/
├── index.html
├── about.html          (se multi-pagina)
├── services.html       (se multi-pagina)
├── contact.html        (se multi-pagina)
└── assets/
    ├── hero-home.jpg   (immagini base64 → file separati se >50KB)
    ├── hero-about.jpg
    └── ...
```

Ogni file `.html` è completo e autonomo (include `<style>` e `<script>`).

### 4.8 Route

```
/app/website          → WebsitePage (nuovo sito)
/app/website/:docId   → WebsitePage (carica esistente)
```

Protetta da `AdminEditorRoute` (stessa di `/app/editor`).

### 4.9 Auto-Build Draft Shape (CRM)

```typescript
// In crm.js autoBuildCustomer()
const websiteDraft = {
  id: `website_${cryptoRandomId()}`,
  documentType: 'website',
  title: `Sito ${cust.businessName}`,
  customerId: id,
  brief: {
    businessName: cust.businessName || '',
    sector: asStr(cust.sector),
    description: asStr(cust.activity),
    tone: asStr(cust.mood),
    target: asStr(cust.target),
    pages: 'index',
    preferredColors: asStr(cust.preferredColors),
    font: '',
    cta: '',
    sections: 'hero, chi_siamo, contatti',
    features: '',
    contacts: [contacts.address, contacts.phone, contacts.email].filter(Boolean).join(', '),
    socials: [],
    mapsUrl: asStr(cust.googleMapsUrl),
    notes: '',
  },
  briefContext: buildBriefContext(cust),
  html: '',
  css: '',
  js: '',
  framework: 'vanilla',
  style: 'modern',
  pages: ['index'],
  source: 'ai',
  autoGeneratePending: autoGenerate,
  createdAt: now,
  updatedAt: now,
};
```

## 5. Acceptance Criteria

- **AC-001**: Given un admin loggato, When naviga a `/app/website`, Then vede l'editor con brief form (14 campi), style selector, viewport toggle, e AI Console
- **AC-002**: Given un admin compila i 14 campi del brief form e click "Genera", When l'AI risponde, Then la preview iframe mostra il sito generato
- **AC-003**: Given un sito generato, When l'admin modifica HTML in CodeMirror, Then la preview si aggiorna entro 500ms
- **AC-004**: Given un sito generato, When l'admin click "Raffina" e scrive "Rendi i colori più scuri", Then l'AI modifica il CSS senza rigenerare HTML/JS
- **AC-005**: Given un sito con 3 pagine, When l'admin click "Esporta ZIP", Then lo ZIP contiene `index.html`, `about.html`, `contact.html`
- **AC-006**: Given un sito con hero image generata da Gemini, When il CSS è ispezionato, Then `background-image` contiene il base64 dell'immagine
- **AC-007**: Given un utente non-admin, When naviga a `/app/website`, Then viene reindirizzato a `/app/qr`
- **AC-008**: Given un cliente CRM con auto-build, When `autoBuildCustomer()` è chiamato, Then un draft website è creato con `briefContext` dal cliente
- **AC-009**: Given un documento website in Collection, When l'utente click "Duplica", Then una copia con titolo "(copia)" è creata
- **AC-010**: Given un documento website in Collection, When l'admin click "Esporta ZIP", Then lo ZIP è scaricato
- **AC-011**: Given un sito generato, When salvato e riaperto, Then il codice HTML/CSS/JS è identico (roundtrip)
- **AC-012**: Given un sito con immagini hero, When esportato, Then le immagini >50KB sono in `assets/` come file separati
- **AC-013**: Given un sito in preview, When l'admin click sul bottone "Tablet" (768px), Then l'iframe si ridimensiona a 768px di larghezza
- **AC-014**: Given un sito in preview, When l'admin click sul bottone "Mobile" (375px), Then l'iframe si ridimensiona a 375px di larghezza
- **AC-015**: Given un brief form con nome attività vuoto, When l'admin click "Genera", Then viene mostrato errore "Nome attività richiesto" e l'AI non è chiamata
- **AC-016**: Given un brief form con tutti i campi compilati, When l'admin click "Genera", Then il prompt inviato all'AI include tutti i 14 campi in formato leggibile

## 6. Test Automation Strategy

- **Test Levels**: Unit (schema, orchestrator, prompt), Integration (dataService save/load website), E2E (generazione → preview → export)
- **Frameworks**: Vitest + RTL (unit), Playwright (E2E)
- **Test Data**: `createEmptyWebsite()` per test puri, mock AI response per test orchestrator
- **Coverage Requirements**: nuovi file ≥60%
- **Key test files**:
  - `src/utils/schemas/__tests__/website.test.ts` — schema validation, factory, merge
  - `src/ai/__tests__/websiteOrchestrator.test.ts` — generateSite, refineSite, output parsing
  - `src/components/__tests__/WebsiteEditor.test.tsx` — render, brief input, preview update
  - `src/hooks/__tests__/useAIWebsite.test.ts` — hook wrapping orchestrator
  - `api/__tests__/website.test.ts` — API save/load website document
  - `e2e/website-builder.spec.ts` — flusso completo: login → editor → genera → modifica → salva → export

## 7. Rationale & Context

**Perché vanilla HTML?** Il sito generato deve funzionare ovunque (anche senza build step). Il cliente finale riceve file `.html` che apre in qualsiasi browser. Nessun vendor lock-in. L'admin può consegnare il sito via ZIP o caricarlo su qualsiasi hosting statico.

**Perché CodeMirror 6?** Il codice generato dall'AI è lungo (200-500 righe). Un textarea semplice senza syntax highlighting rende difficile la modifica manuale. CodeMirror 6 è modulare (solo i language pack necessari), ~40kB gzippato, e si integra bene con React via ref.

**Perché AI decide single vs multi-pagina?** Un sito "bigliettino da visita" (1 pagina) non ha senso come multi-pagina. Un sito "panetteria con menu, chi siamo, contatti" beneficia di pagine separate. L'AI valuta la complessità del brief e decide. L'admin può forzare.

**Perché Gemini per immagini?** Le immagini hero/background sono il differenziale qualitativo più grande tra un sito "fatto con AI" e uno "professionale". Le SVG inline per icone sono gratuite e scalabili. Combinazione: Gemini per foto/illustrazioni, SVG per icone/decorazioni.

**Perché flat domain type?** Website ha stato complesso (html, css, js, pages) come logo/card/flyer. Storage flat evita il wrapper `data` e semplifica l'accesso ai campi in CollectionView e preview.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: Gemini API (via proxy `/api/ai/logo-background` esistente) — Generazione immagini hero per il sito. Stessa API key e proxy già usati per logo background e card cover. L'endpoint accetta parametro `aspectRatio` per supportare formati 16:9 (hero) oltre al default 3:1 (logo).

### Third-Party Services
- **SVC-001**: Ollama Pro Cloud (MiniMax M3) — Provider AI principale per generazione codice. Stesso proxy `/api/ai/chat` degli altri orchestratori.
- **SVC-002**: DeepSeek — Fallback AI se Ollama è 429/timeout. Stessa logica di `executeWithFallback` in BaseOrchestrator.

### Infrastructure Dependencies
- **INF-001**: Vercel Serverless Function (`api/index.ts`) — Nessuna nuova funzione. Le route website sono gestite dalla SPA catch-all in `vercel.json`.

### Data Dependencies
- **DAT-001**: `precisionQuote_documents:v1` (localStorage) / `documents` table (Postgres) — Storage documenti website. Stessa logica degli altri tipi.

### Technology Platform Dependencies
- **PLT-001**: CodeMirror 6 — Editor codice con syntax highlighting. Package: `codemirror`, `@codemirror/lang-html`, `@codemirror/lang-css`, `@codemirror/lang-javascript`, `@codemirror/theme-one-dark`. Dynamic import (lazy).
- **PLT-002**: JSZip — Già in uso per favicon export. Nessuna nuova dipendenza.

### Compliance Dependencies
- **COM-001**: GDPR — Il sito generato non raccoglie dati (nessun form backend). Se l'admin aggiunge form, è responsabilità sua. Nessun impatto.

## 9. Examples & Edge Cases

### 9.1 AI Response (generateSite)

```json
{
  "html": "<header><nav><a href=\"index.html\">Home</a><a href=\"about.html\">Chi Siamo</a></nav></header><main><section class=\"hero\" id=\"home\"><div class=\"hero-bg\" style=\"background-image: var(--hero-image); background-size: cover;\"><h1>Panetteria Artigianale</h1><p>Pane fresco ogni giorno, con farine selezionate</p></div></section><section id=\"prodotti\"><h2>I Nostri Prodotti</h2><div class=\"grid\"><div class=\"card\"><svg><!-- icona pane --></svg><h3>Pane Classico</h3></div></div></section></main><footer><p>© 2026 Panetteria Artigianale</p></footer>",
  "css": ":root { --primary: #B45309; --secondary: #78350F; --accent: #F59E0B; --bg: #FFFBEB; --text: #1C1917; --font: 'Georgia', serif; } * { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: var(--font); color: var(--text); background: var(--bg); } .hero { min-height: 80vh; display: flex; align-items: center; justify-content: center; text-align: center; background: linear-gradient(135deg, var(--primary), var(--secondary)); } .hero h1 { font-size: 3rem; color: #fff; } @media (max-width: 768px) { .hero h1 { font-size: 2rem; } .grid { grid-template-columns: 1fr; } }",
  "js": "document.querySelector('.hamburger')?.addEventListener('click', () => document.querySelector('nav').classList.toggle('open')); document.querySelectorAll('a[href^=\"#\"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); document.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth' }); }));",
  "pages": ["index", "about"],
  "heroPrompts": [
    "Professional bakery photography, warm lighting, wooden countertop with artisan bread loaves, rustic Italian style, shallow depth of field, golden hour, 16:9 aspect ratio"
  ],
  "description": "Sito vetrina per panetteria artigianale con hero image, sezione prodotti, e pagina chi siamo. Tono caldo e rustico."
}
```

### 9.2 AI Response (refineSite)

Input: "Rendi i colori più moderni e scuri, cambia il font in Inter"

```json
{
  "css": ":root { --primary: #1F2937; --secondary: #374151; --accent: #3B82F6; --bg: #111827; --text: #F9FAFB; --font: 'Inter', sans-serif; } body { background: var(--bg); color: var(--text); } .hero { background: linear-gradient(135deg, var(--primary), #000); }",
  "description": "Colori aggiornati a palette dark moderna, font cambiato in Inter"
}
```

### 9.3 Edge Cases

- **Brief con solo nome attività**: L'AI genera sito generico con sezioni default (hero, chi_siamo, contatti). Non bloccare.
- **AI restituisce HTML non valido**: La preview iframe gestisce errori silenziosamente (srcdoc con HTML malformato = blank page). Mostra toast warning "Il codice generato potrebbe contenere errori"
- **Gemini fallisce (503/429)**: Le hero images usano fallback gradient dal CSS. Mostra toast "Immagini hero non generate, usa gradient fallback"
- **CodeMirror non caricato (rete lenta)**: Mostra textarea semplice come fallback mentre CodeMirror carica (dynamic import con Suspense)
- **Export ZIP con immagini grandi**: Se un'immagine base64 >50KB, spostala in `assets/` e referenzia via path. Se lo ZIP totale >10MB, mostra warning
- **Documento website senza codice (appena creato)**: Preview mostra messaggio "Genera il sito con AI o scrivi il codice manualmente"
- **Multi-pagina con solo 1 pagina**: L'AI decide single-page. Se admin forza multi-pagina con 1 pagina, esporta comunque unico file
- **Salvataggio durante generazione AI**: Disabilita bottone Salva mentre `isProcessing === true`
- **Roundtrip salva-carica**: Il codice HTML/CSS/JS deve essere identico dopo save → load. Test con snapshot
- **CRM auto-build senza settore**: `mapSector()` mappa `undefined` → `'other'`. Il brief form ha default sensati.
- **Brief form con 5000 caratteri in descrizione**: Zod valida max 1000. Errore UI prima di chiamare AI.
- **Viewport toggle su sito non ancora generato**: I bottoni sono disabilitati finché non c'è codice da mostrare.

## 10. Validation Criteria

- **VC-001**: `npm run typecheck` passa con i nuovi file (nessun errore TypeScript)
- **VC-002**: `npm run test` passa con i nuovi test (schema, orchestrator, editor)
- **VC-003**: `npm run build` produce build pulita (nessun warning, CodeMirror in chunk separato)
- **VC-004**: La preview iframe mostra il sito generato correttamente
- **VC-005**: Le modifiche CodeMirror aggiornano la preview in tempo reale
- **VC-006**: L'export ZIP contiene tutti i file attesi e si apre correttamente
- **VC-007**: Il roundtrip salva-carica preserva il codice (test con snapshot)
- **VC-008**: La route `/app/website` è accessibile solo ad admin
- **VC-009**: Il tab website in Collection mostra i documenti correttamente
- **VC-010**: L'auto-build CRM crea draft website con briefContext

## 11. Related Specifications / Further Reading

- `docs/spec/spec-architecture-crm-auto-build.md` — Pipeline auto-build CRM (draft website incluso)
- `docs/spec/spec-intake-pipeline.md` — Intake → draft website via `intakeToWebsite()`
- `docs/agent-gotchas.md` — Gotchas Vercel, localStorage, flat domain type, dynamic import
- `docs/to-be-done.md` — Backlog task per Website Builder
- `AGENTS.md` — Architettura app, pattern editor, AI orchestration, routing
