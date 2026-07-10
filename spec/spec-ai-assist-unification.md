---
title: AI Assist Unification — Branded AI Panel, Profession Photo, Shared Components
version: 1.0
date_created: 2026-07-08
owner: Giovanni
tags: design, ui, architecture, refactoring
---

# Introduction

Unificare tutti i pannelli AI (card, flyer, logo, quote) sotto un unico brand
"AI Assist", aggiungere generazione foto professionale AI per il bigliettino
card, integrare la generazione hero image del flyer in AI Assist, e creare una
libreria di componenti UI condivisi (font picker, color picker, layout selector)
per ridurre la duplicazione tra moduli.

## 1. Purpose & Scope

**Scopo**: Migliorare la coerenza UX, la manutenibilità e la copertura
funzionale dei moduli AI e di editing dell'app Quickbrand.

**Obiettivi:**
1. Rinominare tutti i pannelli AI con "AI Assist" (sostituisce "AI Design Mode", "AI copy", label logo)
2. Aggiungere generazione foto AI professionale per il bigliettino card (via Gemini, stile flyer hero)
3. Spostare il bottone "Genera hero" del flyer dentro il pannello AI Assist
4. Creare componente condiviso `AiFontPicker` (Google Fonts, cross-module)
5. Audit di altri pattern UI duplicati tra moduli e proposta di estrazione

**Out of scope:**
- Modifica ai generatori SVG/PDF/PNG esistenti (solo UI)
- Refactoring del backend API oltre ai nuovi endpoint necessari
- Migrazione dei dati esistenti (foto caricate o cover AI restano intatte)

## 2. Definitions

| Termine | Definizione |
|---------|-------------|
| **AI Assist** | Nome unificato per tutti i pannelli di interazione AI nell'app |
| **Card Photo AI** | Nuova funzionalità: genera un'immagine professionale (es. cane per dogsitter, verdure per nutrizionista) che sostituisce `photoUrl` nel bigliettino |
| **Flyer Hero AI** | Funzionalità esistente in `useAIFlyer.generateHero()` che genera un'immagine hero per il volantino via Gemini |
| **Google Font** | Font caricato via `@import url(...)` o `<link>` da Google Fonts CDN |
| **Shared Component** | Componente React in `src/components/ai-ui/` o `src/components/ui/` riusabile da 2+ moduli |
| **AiFontPicker** | Nuovo componente condiviso per selezione font (sostituisce 3 implementazioni separate) |
| **AiColorPicker** | Nuovo componente condiviso per selezione colore con swatch + color picker |

## 3. Requirements, Constraints & Guidelines

### REQ — Requisiti Funzionali — AI Assist Naming

- **REQ-001**: Tutti i pannelli AI devono mostrare "AI Assist" come header text nel `panel-kicker`, senza emoji, senza variazioni per modulo
- **REQ-002**: Il cambiamento riguarda `CardEditorShell.tsx` (desktop + mobile), `EditorView.tsx` (quote), `FlyerAiPanel.tsx`, `LogoEditor.tsx` (sezione AI)

| File | Linea | Testo attuale | Nuovo |
|------|-------|--------------|-------|
| `src/components/card/CardEditorShell.tsx` | 671, 725 | `AI Design Mode` | `AI Assist` |
| `src/components/EditorView.tsx` | 203 | `AI Design Mode` | `AI Assist` |
| `src/components/flyer/FlyerAiPanel.tsx` | 65 | `✨ AI copy` | `AI Assist` |
| `src/components/LogoEditor.tsx` | (header AI) | `✨ AI` o simile | `AI Assist` |
| `src/components/__tests__/CardEditor.basic.test.tsx` | 360 | `AI Design Mode` | `AI Assist` |

### REQ — Requisiti Funzionali — Card Photo AI

- **REQ-010**: Nuovo endpoint `POST /api/ai/card-photo` in `api/index.ts` che accetta `{ title, company, services, accentColor, bgColor, logoDescription? }` e restituisce `{ data: base64Jpeg }` generato da Gemini
- **REQ-011**: Il prompt per Gemini deve descrivere un'illustrazione stilizzata che rappresenti la professione dell'utente (es. cane per dogsitter, verdure per nutrizionista, codice per sviluppatore), nei colori della card, senza testo né loghi
- **REQ-012**: Nuovo metodo `useAICard.generatePhoto()` che chiama l'endpoint e setta `photoUrl` sul fronte della card
- **REQ-013**: Bottone "Genera foto AI" nella sezione Media di `CardFormFields.tsx`, visibile sempre (anche se `photoUrl` è già popolato)
- **REQ-014**: Il bottone "Genera foto AI" è disabilitato se tier === 'free' (stessa guardia della cover AI)
- **REQ-015**: Il bottone "Genera foto AI" NON è nella sezione AI Assist (sta nella sezione Media del tab manuale, accanto al file upload), stesso pattern del bottone "Genera sfondo AI" nella card
- **REQ-016**: La foto generata sovrascrive `photoUrl` esistente (non si accumula, non c'è storico)
- **REQ-017**: L'utente può sempre rimuovere la foto generata e tornare a nessuna foto, o caricarne una manuale

### REQ — Requisiti Funzionali — Flyer Hero in AI Assist

- **REQ-020**: Il bottone "Genera hero" attualmente presente nel pannello di editing manuale del flyer va spostato DENTRO il pannello AI Assist (`FlyerAiPanel.tsx`), in una sezione dedicata "Hero Image"
- **REQ-021**: La sezione mostra l'anteprima dell'hero corrente (se presente) con possibilità di eliminarla
- **REQ-022**: La generazione hero consuma il rate-limit AI (5/min/IP, stesso di `/ai/flyer-hero`)
- **REQ-023**: Se tier === 'free', la sezione hero è bloccata con lucchetto (`AiTierGuard`)

### REQ — Requisiti Funzionali — AiFontPicker

- **REQ-030**: Creare `src/components/ai-ui/AiFontPicker.tsx` che unifica i 3 selettori font esistenti (`CardFormFields.tsx:519`, `FlyerStyleFields.tsx:46`, `BuilderPanel.tsx:337`)
- **REQ-031**: La lista font deve essere ampliata con Google Fonts: mantenere i 9 attuali e aggiungere Playfair Display, Source Sans 3, Oswald, Raleway, Merriweather, DM Sans, Figtree, Plus Jakarta Sans (totale 17)
- **REQ-032**: Ogni font deve includere il fallback stack (es. `'Playfair Display', Georgia, serif`) sia per il rendering web che per SVG/PDF
- **REQ-033**: Il componente supporta la modalità "Personalizzato" dove l'utente digita un font a mano (input libero)
- **REQ-034**: `SAFE_FONT_FAMILIES` in `documentSchemas.ts` diventa l'unica fonte di verità centrale; `FLYER_FONTS` in `FlyerStyleFields.tsx` e `FONT_OPTIONS` in `BuilderPanel.tsx` vengono rimossi
- **REQ-035**: Il font selezionato si applica in tempo reale all'anteprima (CSS `font-family` sull'elemento preview)

### REQ — Requisiti Audit — Altri Componenti Condivisibili

- **REQ-040**: Audit completo dei pattern UI duplicati tra i moduli Card, Flyer, Logo, Quote. Identificare componenti che appaiono in 2+ moduli con implementazioni indipendenti e candidate per estrazione in `src/components/ui/`
- **REQ-041**: Almeno i seguenti pattern devono essere analizzati: selettori colore, selettori layout, azioni di esportazione, anteprime con zoom, selettori template, form field wrapper

### GUD — Linee Guida

- **GUD-001**: I nuovi componenti condivisi vanno in `src/components/ai-ui/` se legati a funzionalità AI, in `src/components/ui/` altrimenti
- **GUD-002**: Ogni componente condiviso deve avere: interfaccia TypeScript esportata, unit test in `__tests__/`, documentazione inline minima (props JSDoc)
- **GUD-003**: I componenti ereditano lo stile CSS da classi globali (no CSS modules, no inline styles per layout)
- **GUD-004**: Ogni estrazione deve mantenere la compatibilità con il consumo esistente (stesse props o mapping 1:1)
- **GUD-005**: Il nome "AI Assist" non ha emoji, è scritto con iniziali maiuscole, in italiano (si traduce come "Assistente AI" solo in contesti di microcopy lunga, "AI Assist" per header)

### PAT — Pattern

- **PAT-001**: Stesso pattern di `AiSection` e `AiTierGuard` già usati in `ai-ui/` — ogni nuovo componente segue le stesse convenzioni (naming, export, struttura file)
- **PAT-002**: La generazione foto AI per la card segue lo stesso flusso della generazione hero flyer: endpoint dedicato in `api/index.ts`, hook `useAICard`, prompt builder in `src/utils/card/`, throttling lato client
- **PAT-003**: Google Fonts caricati via CSS `@import` in `GlobalStyles.tsx` (o nel componente preview/font picker) — non in `<head>` dinamico

## 4. Interfaces & Data Contracts

### 4.1 Endpoint API — Card Photo AI

```typescript
// POST /api/ai/card-photo
// Rate-limit: 5/min/IP (condiviso con /ai/card-cover)
// Auth: API key o sessione utente

Request body:
{
  "title": "Dogsitter",           // front.title
  "company": "PetCare SRL",       // front.company
  "services": ["Dog walking", "Pet sitting", "Toelettatura"],  // back.services
  "accentColor": "#01696F",       // style.accentColor
  "bgColor": "#FFFFFF",           // style.bgColor
  "logoDescription": "",          // opzionale, descrizione testo del logo
  "context": "..."                // snapshot per copertura
}

Response 200:
{
  "data": "base64-jpeg-string"
}

Response 400:
{ "error": "Richiesta non valida" }

Response 429:
{ "error": "Troppe richieste. Riprova tra X secondi." }
```

### 4.2 AiFontPicker — Interfaccia

```typescript
// src/components/ui/AiFontPicker.tsx

export interface AiFontPickerProps {
  /** Valore corrente (font-family string) */
  value: string;
  /** Callback con nuovo font selezionato */
  onChange: (font: string) => void;
  /** Label opzionale sopra il selettore */
  label?: string;
  /** Classe CSS aggiuntiva */
  className?: string;
  /** Se true, mostra input per font personalizzato (default: true) */
  allowCustom?: boolean;
  /** Lista font opzionale (default: SHARED_FONT_FAMILIES) */
  fontList?: { value: string; label: string }[];
}

export const SHARED_FONT_FAMILIES = [
  // sans-serif
  { value: 'Inter, system-ui, sans-serif', label: 'Inter (moderno)' },
  { value: 'Roboto, system-ui, sans-serif', label: 'Roboto (Android)' },
  { value: 'Open Sans, system-ui, sans-serif', label: 'Open Sans (leggibile)' },
  { value: 'Lato, system-ui, sans-serif', label: 'Lato (elegante)' },
  { value: 'Montserrat, system-ui, sans-serif', label: 'Montserrat (geometrico)' },
  { value: 'Poppins, system-ui, sans-serif', label: 'Poppins (arrotondato)' },
  { value: 'Source Sans 3, system-ui, sans-serif', label: 'Source Sans 3 (chiaro)' },
  { value: 'DM Sans, system-ui, sans-serif', label: 'DM Sans (contemporaneo)' },
  { value: 'Figtree, system-ui, sans-serif', label: 'Figtree (moderno)' },
  { value: 'Plus Jakarta Sans, system-ui, sans-serif', label: 'Jakarta Sans (fresco)' },
  { value: 'Oswald, system-ui, sans-serif', label: 'Oswald (condensato)' },
  { value: 'Raleway, system-ui, sans-serif', label: 'Raleway (elegante)' },
  // serif
  { value: 'Georgia, serif', label: 'Georgia (serif classico)' },
  { value: 'Times New Roman, serif', label: 'Times New Roman (tradizionale)' },
  { value: 'Playfair Display, Georgia, serif', label: 'Playfair Display (premium)' },
  { value: 'Merriweather, Georgia, serif', label: 'Merriweather (leggibile serif)' },
  // monospace
  { value: 'Courier New, monospace', label: 'Courier New (monospace)' },
] as const;
```

### 4.3 Modifiche a `SAFE_FONT_FAMILIES` in `documentSchemas.ts`

```typescript
// Nuovo: font di sistema per CSS
export const SHARED_FONT_FAMILIES = [
  { value: 'Inter, system-ui, sans-serif', label: 'Inter (moderno)' },
  // ... tutti i 17 font
] as const;

// Mantenuto per retrocompatibilità (card import)
export const SAFE_FONT_FAMILIES = SHARED_FONT_FAMILIES.map(f => f.value.split(',')[0]) as readonly string[];
```

### 4.4 Posizionamento feature nei pannelli

```
┌─────────────────────────────┐
│  AI Assist                  │  ← panel-kicker unificato
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │ Hero Image (flyer)    │  │  ← nuova sezione, solo flyer
│  │ [anteprima] [Genera]  │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Genera copy / Prompt  │  │  ← sezioni esistenti
│  │ ...                   │  │
│  └───────────────────────┘  │
└─────────────────────────────┘

┌─────────────────────────────┐
│  Media (tab manuale)        │  ← sezione media della card
├─────────────────────────────┤
│  Foto                       │
│  [file input] [Genera foto] │  ← nuovo bottone photo AI
│  [Rimuovi]                  │
│  Logo...                    │
└─────────────────────────────┘
```

## 5. Acceptance Criteria

### AI Assist Naming

- **AC-001**: Given il pannello AI della card (desktop), When viene renderizzato, Then l'header `panel-kicker` mostra "AI Assist"
- **AC-002**: Given il pannello AI della card (mobile bottom sheet), When viene aperto, Then l'header mostra "AI Assist"
- **AC-003**: Given il pannello AI del preventivo (quote), When renderizzato, Then l'header mostra "AI Assist"
- **AC-004**: Given il pannello AI del volantino (flyer), When renderizzato, Then l'header mostra "AI Assist"
- **AC-005**: Given il pannello AI del logo, When renderizzato, Then l'header mostra "AI Assist"
- **AC-006**: Given il test `CardEditor.basic.test.tsx`, When cerca il testo "AI Assist", Then lo trova (non cerca più "AI Design Mode")

### Card Photo AI

- **AC-010**: Given una card senza `photoUrl`, When l'utente clicca "Genera foto AI" nella sezione Media, Then viene chiamato l'endpoint `/api/ai/card-photo` e `photoUrl` viene popolato con il risultato base64
- **AC-011**: Given una card con `photoUrl` già popolato, When l'utente clicca "Genera foto AI", Then il vecchio `photoUrl` viene sovrascritto
- **AC-012**: Given tier === 'free', When l'utente visualizza la sezione Media, Then il bottone "Genera foto AI" è disabilitato
- **AC-013**: Given una foto AI generata, When l'utente clicca "Rimuovi foto", Then `photoUrl` torna a null
- **AC-014**: Given l'endpoint `/api/ai/card-photo`, When inviato con `{ title: 'Dogsitter', services: ['Dog walking'], accentColor: '#01696F', bgColor: '#FFFFFF' }`, Then ritorna 200 con un base64 JPEG valido

### Flyer Hero in AI Assist

- **AC-020**: Given il pannello AI del volantino, When aperto, Then mostra una sezione "Hero Image" con anteprima
- **AC-021**: Given il pannello AI, When la sezione Hero ha un'immagine, Then mostra il bottone "Rimuovi" per cancellarla
- **AC-022**: Given tier === 'free', When il pannello AI mostra la sezione Hero, Then il contenuto è bloccato da `AiTierGuard`

### AiFontPicker

- **AC-030**: Given un selettore font nella card (CardStyleFields), When renderizzato, Then usa `AiFontPicker` (non più il `<select>` nativo)
- **AC-031**: Given un selettore font nel flyer (FlyerStyleFields), When renderizzato, Then usa `AiFontPicker`
- **AC-032**: Given un selettore font nel logo (BuilderPanel), When renderizzato, Then usa `AiFontPicker`
- **AC-033**: Given un font non in lista, When l'utente seleziona "Personalizzato", Then appare un input libero per digitare il font
- **AC-034**: Given la lista `SHARED_FONT_FAMILIES`, When contata, Then ha esattamente 17 font
- **AC-035**: Given `SAFE_FONT_FAMILIES` in `documentSchemas.ts`, When aggiornato, Then include tutti i 17 font della lista condivisa (solo il primo nome, senza fallback stack)

### Audit Condivisione

- **AC-040**: Given il completamento dell'audit, When consegnato, Then produce un documento che elenca minimo 5 pattern duplicati con proposta di astrazione per ciascuno

## 6. Test Automation Strategy

- **Test Levels**:
  - **Unit**: `AiFontPicker` — render con varie liste, modalità personalizzato, onChange
  - **Integration**: Endpoint `POST /api/ai/card-photo` con DB mock + Gemini mock
  - **Integration**: `useAICard.generatePhoto()` — verifica chiamata endpoint + settaggio `photoUrl`
  - **E2E**: `CardMediaFields` — click "Genera foto AI", verifica anteprima

- **Framework**: Vitest (esistente). Mock Gemini via `vi.mock()` per gli endpoint
- **Copertura minima**: 70% per nuovi componenti, 80% per `AiFontPicker`
- **Test fixture**: Per endpoint card-photo, mockare `interactions.create()` di `@google/genai`
- **Snapshot**: Nessuno snapshot per componenti UI (selector-based assertion è preferito)

## 7. Rationale & Context

**Perché "AI Assist" invece di "AI Design Mode" o "AI copy"?**
- "AI Design Mode" suona come una modalità separata, non come un assistente integrabile
- "AI copy" è troppo specifico (solo copy, non altre funzioni AI)
- "AI Assist" è breve, scalabile (ci stanno dentro generazione testo, immagini, suggerimenti) e coerente con prodotti mainstream (GitHub Copilot, Google Gemini Assist)
- Senza emoji per coerenza con gli altri header dell'app

**Perché la foto AI della card è nella sezione Media e non in AI Assist?**
- Stesso pattern del bottone "Genera sfondo AI" per la card: l'azione è legata al campo specifico (foto), non al pannello AI generale
- L'utente si aspetta di trovare il controllo della foto vicino al file upload, non in un pannello separato
- AI Assist contiene le azioni di generazione testo/refinement, non la generazione di asset singoli

**Perché il flyer Hero va invece in AI Assist?**
- L'hero del flyer non è un campo editabile manualmente (non c'è upload file per hero)
- È un'azione esclusivamente AI, quindi ha senso nel pannello AI
- Consistenza con la cover AI della card (che è già nel pannello AI Assist)

**Perché Google Font?**
- L'output è sia web (anteprima) che stampa (PDF). Google Font è lo standard de facto per il web
- La maggior parte dei font aggiunti sono Google Font, che possono essere embeddati via CSS `@import`
- Per i PDF generati via pdfmake, il font non viene embedded ma specificato come nome; la stampa fisica usa i font di sistema se disponibili

**Perché estrarre componenti UI condivisi?**
- Tre implementazioni separate di font picker con logiche leggermente diverse è manutenibile ma fragile
- Aggiungere un font oggi richiede modifiche in 3 file; con un componente centralizzato, 1 file
- pattern analogo per color picker e layout selector (da auditare)

## 8. Dependencies & External Integrations

### External Systems

- **EXT-001**: **Gemini API** (via `@google/genai`) — generazione immagini per card photo AI e flyer hero. Stessa integrazione esistente in `api/index.ts`.

### Third-Party Services

- **SVC-001**: **Google Fonts CDN** — caricamento font via CSS `@import url('https://fonts.googleapis.com/css2?family=...')`. I font devono essere selezionati e testati per la disponibilità.

### Infrastructure Dependencies

- **INF-001**: **Vercel Hobby** — il nuovo endpoint `/api/ai/card-photo` rientra nei limiti di timeout 10s? Gemini impiega 5-15s. Potrebbe essere tight. Se serve, timeout a 15s (richiede Vercel Pro).

### Technology Platform Dependencies

- **PLT-001**: **React 18** + TypeScript — i componenti condivisi usano `React.FC` pattern già in uso
- **PLT-002**: **Google Fonts** — i font devono essere disponibili su fonts.google.com. Lista candidata: Playfair Display, Source Sans 3, Oswald, Raleway, Merriweather, DM Sans, Figtree, Plus Jakarta Sans (tutti verificati).

### Data Dependencies

- **DAT-001**: **Tabelle esistenti** — nessuna nuova tabella. Il `photoUrl` è già un campo in `document.data.front.photoUrl`.

## 9. Examples & Edge Cases

### Edge case: Foto AI sovrascrive foto caricata

```typescript
// Stato iniziale: utente ha caricato foto manuale
card.front.photoUrl = "data:image/jpeg;base64,/9j/4AAQ..."

// Utente clicca "Genera foto AI"
// → endpoint chiamato con profession/servizi/colori
// → risposta: nuovo base64
// → card.front.photoUrl = nuovoValore

// La foto manuale è persa (sostituita). 
// L'utente può:
//   a) Tenere la foto AI
//   b) Cancellarla (torna a null)
//   c) Ricaricare manualmente un'altra foto
```

### Edge case: Fallback endpoint card-photo

```typescript
// Se Gemini restituisce errore (rate limit, content filter, etc.):
try {
  const result = await generatePhoto(prompt);
  patchFront({ photoUrl: result.data });
  addToast('success', 'Foto AI generata.');
} catch (err) {
  // Restituire foto AI non è bloccante
  addToast('error', 'Generazione foto fallita: ' + err.message);
  // photoUrl resta invariato
}
```

### Edge case: Font non disponibile in stampa

```typescript
// Un font Google Font (es. Playfair Display) usato nella card:
// 1. Nell'anteprima web: funziona via @import CSS
// 2. Nell'SVG: specificato come 'Playfair Display, Georgia, serif'
// 3. Nel PDF (pdfmake): specificato come stringa, pdfmake usa
//    il font se disponibile nel sistema, altrimenti fallback
// 4. Nel PNG (canvas): il canvas usa il font di sistema o fallback

// Non c'è embedded font nei PDF (sarebbe complesso e costoso).
// L'utente è informato che per la stampa professionale si consigliano
// font standard (Inter, Roboto, Georgia, Times New Roman).
```

### AiFontPicker usage example

```tsx
// Sostituisce questo (CardStyleFields):
<select value={...} onChange={...}>
  {SAFE_FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
  <option value="__custom__">Personalizzato ({card.style.fontFamily})</option>
</select>

// Con questo:
<AiFontPicker
  value={card.style.fontFamily}
  onChange={(font) => patchStyle({ fontFamily: font })}
  label="Font"
/>

// Uso nel logo (BuilderPanel):
<AiFontPicker
  value={b.fontFamily}
  onChange={(font) => update('fontFamily', font)}
  label="Font"
  fontList={LOGO_FONT_SUBSET} // opzionale, subset dei 17
/>
```

## 10. Validation Criteria

- **[V-001]**: `npm run typecheck` passa senza errori
- **[V-002]**: `npm run test` — tutti i test esistenti + nuovi test verdi
- **[V-003]**: In locale, apertura pannello AI di card/flyer/logo/quote mostra "AI Assist" nell'header
- **[V-004]**: In locale, click "Genera foto AI" nella card media produce immagine (mockata o con Gemini key)
- **[V-005]**: In locale, il selettore font nella card mostra 17 font, selezionabile e applicato in anteprima
- **[V-006]**: Il selettore font del flyer e del logo usano lo stesso componente (verificabile dal codice)
- **[V-007]**: Il bottone "Genera hero" non è più presente nel pannello manuale del flyer, solo in AI Assist

## 11. Related Specifications / Further Reading

- `spec/spec-api-saas-monetization.md` — API key e rate-limit (il nuovo endpoint card-photo usa lo stesso sistema)
- `src/components/ai-ui/` — Libreria componenti AI esistente (AiSection, AiTierGuard, AiSelect, etc.)
- `src/hooks/useAICard.ts` — Hook AI card esistente, va esteso con `generatePhoto()`
- `src/hooks/useAIFlyer.ts` — Hook AI flyer esistente, contiene `generateHero()`
- `src/utils/card/coverBrief.ts` — Pattern per costruire prompt AI da dati card (da replicare per photo brief)
- `src/components/card/CardFormFields.tsx` — Sezione Media dove aggiungere bottone "Genera foto AI"
- `src/components/flyer/FlyerAiPanel.tsx` — Dove aggiungere sezione Hero
- `src/utils/documentSchemas.ts` — `SAFE_FONT_FAMILIES` da centralizzare
- `src/components/flyer/FlyerStyleFields.tsx` — `FLYER_FONTS` da rimuovere
- `src/components/BuilderPanel.tsx` — `FONT_OPTIONS` da rimuovere
