---
title: Phase 7 — Polish, onboarding, docs update
version: 1.0
date_created: 2026-06-21
owner: Giovanni Cidu
tags: [process, polish, onboarding, homepage, docs, readme, requirements, design]
---

# Introduction

La fase 7 chiude l'espansione multi-documento con polish: aggiornamento
dell'onboarding per spiegare le 4 feature nuove, refactor della
HomePage per mostrarle in showcase, e aggiornamento di tutta la docs
(README, REQUIREMENTS, DESIGN, AGENTS) per riflettere il nuovo stato.

È la fase più "leggera" tecnicamente (poca logica nuova) ma la più
importante per la prima impressione: un utente che arriva sul sito
vede subito "Preventivi + QR + Bigliettini + Volantini + Loghi" invece
di solo "Preventivi". E un nuovo sviluppatore che legge la docs capisce
l'architettura multi-documento senza dover reverse-engineerare il
codice.

## 1. Purpose & Scope

**Purpose**: completare l'espansione con polish UX (onboarding +
HomePage) e docs (README + REQUIREMENTS + DESIGN + AGENTS), così
l'app è pronta per essere mostrata a potenziali clienti e
mantenuta da sviluppatori futuri.

**Scope**:
- Estensione `src/components/OnboardingModal.tsx`:
  - Step 5 nuovo: "Cosa vuoi creare per primo?" con 5 bottoni
    (Preventivo, QR, Bigliettino, Volantino, Logo). Click →
    `setView(...)` corrispondente dopo onboarding complete.
  - Step 1 aggiornato: welcome text menziona "suite di branding"
    invece di solo "preventivi"
- Refactor `src/pages/HomePage.tsx`:
  - Hero section: titolo "Tutto il branding per la tua attività,
    pronto in 3 giorni" + sottotitolo pacchetti
  - Sezione "Cosa puoi creare": 5 card (Preventivo, QR, Bigliettino,
    Volantino, Logo) con icona + descrizione + link "Prova gratis"
  - Sezione "Pacchetti": tabella prezzi (Starter €149, Apertura €349,
    Presenza €690, Manutenzione €59/mese)
  - Sezione "Come funziona": 3 step (Brief → Bozza AI → Consegna 72h)
  - Sezione "Perché noi": 3 differenziazioni vs Canva/Looka/web
    agency
  - CTA finale: "Inizia gratis" → /login
- Aggiornamento `README.md`:
  - Sezione "Funzionalità": 5 nuove entry (QR, Bigliettino, Volantino,
    Logo, Tier system)
  - Sezione "Struttura file": nuovi file elencati
  - Sezione "Schema Database": tabella `documents` (rinominata) +
    tabella `unlock_codes`
  - Sezione "Variabili d'ambiente": rimossa `BLOB_READ_WRITE_TOKEN`
    (mai usata), aggiunta nota "REPLICATE_API_TOKEN opzionale,
    solo per AI logo in v2"
  - Sezione "localStorage keys": aggiunte
    `precisionQuote_documents:v1`, `pq_migration_v1_done_<email>`,
    `unlock_codes` (dev only)
- Aggiornamento `REQUIREMENTS.md`:
  - Sezione "Dati localStorage": nuove chiavi elencate
  - Sezione "Schema Database": tabella `documents` + `unlock_codes`
- Aggiornamento `DESIGN.md`:
  - Sezione "components": aggiungere `QREditor`, `CardEditor`,
    `FlyerEditor`, `LogoEditor`, `TierLimitModal`,
    `CollectionTabs` (se estratto), `CollectionCard`
  - Sezione "Modularizzazione corrente": riflette la struttura
    multi-documento
- Aggiornamento `AGENTS.md`:
  - Sezione "Key Files": aggiungere i nuovi file significativi
    (`documentSchemas.ts`, `qrGenerator.ts`, `cardGenerator.ts`,
    `flyerGenerator.ts`, `logoGenerator.ts`, `watermark.ts`)
  - Sezione "Environment Variables": rimuovere `BLOB_READ_WRITE_TOKEN`
    (mai usata), aggiungere `REPLICATE_API_TOKEN` (opzionale, v2)
  - Sezione "localStorage Schema": aggiungere nuove chiavi
    versionate
- Nuova pagina `src/pages/LogoAiDocsPage.tsx` (link dal tab "AI
  Generation" del LogoEditor): spiega perché AI generation non è
  attiva nella v1 e come attivarla in v2 (Vercel Pro + token)
- Route aggiunta in `src/main.tsx`: `/docs/logo-ai` →
  `LogoAiDocsPage`
- Verifica finale: `npm run typecheck && npm run test` verdi

**Out of scope**:
- NuovaHomePage con animazioni / video — out of scope (CSS statico
  inline, come HomePage attuale)
- SEO optimization (meta tags, structured data) — out of scope v2
- A/B testing CTA — out of scope v2
- Traduzione inglese — out of scope v2

**Intended audience**: sviluppatore che fa polish; reviewer che
verifica docs aggiornate; potenziali clienti che visitano HomePage;
nuovi sviluppatori che leggono README/AGENTS.

**Assumptions**:
- Tutte le fasi 0-6 sono completate e `npm run typecheck && npm run
  test` verdi.
- L'HomePage attuale è inline-CSS (vedi `src/pages/HomePage.tsx`),
  si mantiene questo stile.

## 2. Definitions

- **Onboarding**: wizard 5-step che utenti nuovi vedono al primo
  login. Step 1-4 esistenti (displayName, companyName, profession,
  color, VAT). Step 5 nuovo ("Cosa vuoi creare per primo?").
- **HomePage**: landing page pubblica a `/`. Visibile senza login.
- **Pacchetto**: bundle commerciale (Starter €149, Apertura €349,
  Presenza €690, Manutenzione €59/mese) dal business plan.
- **Tier**: livello utente (`free` o `unlocked`), introdotto nella
  fase 5.
- **Watermark**: pattern diagonale + footer sui PDF/PNG per utenti
  free, introdotto nella fase 5.

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: OnboardingModal step 5 mostra 5 bottoni: "Preventivo"
  (icona doc), "QR Code" (icona qr), "Bigliettino" (icona id-card),
  "Volantino" (icona file-text), "Logo" (icona sparkle).
- **REQ-002**: Click su bottone step 5 → salva preferenza in
  `user_settings.preferredDocumentType` (campo nuovo opzionale),
  chiude onboarding, setta `view` al tipo scelto.
- **REQ-003`: OnboardingModal step 1 welcome text: "Benvenuto in
  PrecisionQuote — la suite di branding per la tua attività.
  Preventivi, QR, bigliettini, volantini e logo, pronti in 3
  giorni." (sostituisce text solo preventivi).
- **REQ-004`: HomePage hero section: H1 "Tutto il branding per la
  tua attività, pronto in 3 giorni", sottotitolo "Preventivi, QR,
  bigliettini, volantini e logo. Tutto in un posto. Pacchetti da
  €149." CTA "Inizia gratis" → /login.
- **REQ-005`: HomePage sezione "Cosa puoi creare": grid 5 card, ogni
  card ha icona (SVG inline), titolo, descrizione 1-line, link
  "Prova gratis" → /login.
- **REQ-006`: HomePage sezione "Pacchetti": tabella 4 righe (Starter
  €149, Apertura €349, Presenza €690, Manutenzione €59/mese) con
  colonne: Pacchetto, Contenuto, Prezzo. Sotto tabella: "Tutti i
  pacchetti includono 1 round di revisione, consegna entro 72 ore,
  formati PDF stampa + PNG web."
- **REQ-007`: HomePage sezione "Come funziona": 3 step numerati con
  icona + titolo + descrizione:
  1. Brief — "Ci dici cosa ti serve: tipo di attività, stile,
     colori."
  2. Bozza AI — "Il nostro editor compone il preventivo, il QR, il
     bigliettino. AI aiuta con copy e design."
  3. Consegna 72h — "Ricevi PDF stampa-ready + PNG web. Modifiche
     incluse per 1 round."
- **REQ-008`: HomePage sezione "Perché noi": 3 card differenziazione:
  - "Più veloce di una web agency" — "72 ore vs 2-4 settimane"
  - "Più completo di Canva" — "Tu non fai niente, facciamo tutto noi"
  - "Più personalizzato di Looka" — "Logo, bigliettino, volantino
    coordinati, non separati"
- **REQ-009`: HomePage CTA finale: banner con "Inizia gratis oggi"
  + bottone "Registrati" → /login?register=1.
- **REQ-010`: README.md aggiornato:
  - Front matter: titolo "PrecisionQuote — Suite branding per
    piccole attività"
  - Sezione "Funzionalità": tabella esistente + 5 nuove righe (QR,
    Bigliettino, Volantino, Logo, Tier system)
  - Sezione "Struttura file": albero aggiornato con nuovi file
  - Sezione "Schema Database": tabella `documents` (ex `quotes`) +
    nuova `unlock_codes` + nuove colonne `user_settings`
  - Sezione "Variabili d'ambiente": rimosssa `BLOB_READ_WRITE_TOKEN`
    (mai usata), aggiunta `REPLICATE_API_TOKEN` (opzionale, v2)
  - Sezione "localStorage keys": aggiunte
    `precisionQuote_documents:v1`, `pq_migration_v1_done_<email>`,
    `unlock_codes` (dev only)
- **REQ-011`: REQUIREMENTS.md aggiornato: nuove chiavi localStorage
  + nuove tabelle DB.
- **REQ-012`: DESIGN.md aggiornato: nuovi componenti + sezione
  "Modularizzazione corrente" riflette struttura multi-documento.
- **REQ-013`: AGENTS.md aggiornato:
  - Sezione "Key Files": aggiungere `documentSchemas.ts`,
    `qrGenerator.ts`, `cardGenerator.ts`, `flyerGenerator.ts`,
    `logoGenerator.ts`, `watermark.ts`
  - Sezione "Environment Variables": rimossa
    `BLOB_READ_WRITE_TOKEN`, aggiunta `REPLICATE_API_TOKEN`
    (opzionale, v2)
  - Sezione "localStorage Schema": nuove chiavi versionate
- **REQ-014`: Nuova pagina `LogoAiDocsPage.tsx` a `/docs/logo-ai`:
  - H1 "AI Logo Generation — Disponibile in v2"
  - Sezione "Perché non è attivo nella v1": 3 bullet (Vercel Hobby
    timeout 10s, costo AI, focus su validazione modello)
  - Sezione "Come attivarlo in v2": 3 step (Upgrade Vercel Pro,
    configura `REPLICATE_API_TOKEN`, riattiva tab AI nel
    `LogoEditor`)
  - Link "Torna al logo builder" → /app (dopo login)
- **REQ-015`: Route `/docs/logo-ai` aggiunta in `src/main.tsx`
  (public, no auth).
- **REQ-016`: Verifica finale: `npm run typecheck` code 0, `npm run
  test` code 0, tutti i 100+ test passano.
- **SEC-001`: LogoAiDocsPage è pubblica (no auth). Nessun PII
  esposto. Contenuto statico.
- **SEC-002`: HomePage non espone PII. Nessun form (CTA è link a
  /login).
- **CON-001`: Vercel Hobby: nessun endpoint nuovo, nessun impatto.
- **CON-002`: Nessuna migrazione DB in questa fase.
- **CON-003`: HomePage resta inline-CSS (no Tailwind, no CSS-in-JS
  library). Stile coerente con HomePage attuale.
- **GUD-001`: Seguire `AGENTS.md` "Test — OBBLIGTORI": anche se è
  fase di docs, i componenti nuovi (OnboardingModal step 5,
  LogoAiDocsPage) devono avere test.
- **GUD-002`: Seguire skill `writing-guidelines` per docs: active
  voice, sentence case headings, no em dashes, contractions
  encouraged, no banned words (`easy`, `simple`, `quick`).
- **GUD-003`: Seguire skill `frontend-design` per HomePage — design
  intenzionale, non "templated Canva look". Tipografia decisa,
  proporzioni, colori brand.
- **GUD-004`: Seguire skill `web-design-guidelines` per
  accessibilità: contrasto 4.5:1, keyboard nav, ARIA, focus visibile.
- **GUD-005`: Seguire skill `vercel-react-best-practices` per
  performance: HomePage resta code-split (già nella bundle
  principale, niente lazy load); LogoAiDocsPage lazy load.
- **PAT-001`: Pattern OnboardingModal step 5:
  ```tsx
  <Section title="Cosa vuoi creare per primo?">
    <div className="onboarding-doc-grid">
      {DOCUMENT_TYPES.map(dt => (
        <button key={dt.id} onClick={() => selectPreferred(dt.id)}
          className={preferred === dt.id ? 'selected' : ''}>
          <Icon name={dt.icon} />
          <span>{dt.label}</span>
        </button>
      ))}
    </div>
  </Section>
  ```
- **PAT-002`: Pattern HomePage card grid:
  ```tsx
  <section className="home-section">
    <h2>Cosa puoi creare</h2>
    <div className="feature-grid">
      {FEATURES.map(f => (
        <article key={f.id} className="feature-card">
          <svg>{/* inline icon */}</svg>
          <h3>{f.title}</h3>
          <p>{f.description}</p>
          <a href="/login" className="feature-cta">Prova gratis</a>
        </article>
      ))}
    </div>
  </section>
  ```

## 4. Interfaces & Data Contracts

### `src/components/OnboardingModal.tsx` (estensione)

```tsx
const DOCUMENT_TYPES = [
  { id: 'quote', label: 'Preventivo', icon: 'doc', view: 'editor' },
  { id: 'qrCode', label: 'QR Code', icon: 'qr', view: 'qr' },
  { id: 'businessCard', label: 'Bigliettino', icon: 'card', view: 'card' },
  { id: 'flyer', label: 'Volantino', icon: 'flyer', view: 'flyer' },
  { id: 'logo', label: 'Logo', icon: 'logo', view: 'logo' },
];

// Nuovo step 5 nel wizard
```

### `src/pages/HomePage.tsx` (refactor)

Struttura:
1. Hero (H1 + sottotitolo + CTA)
2. Cosa puoi creare (5 card)
3. Pacchetti (tabella)
4. Come funziona (3 step)
5. Perché noi (3 card)
6. CTA finale (banner)

### `src/pages/LogoAiDocsPage.tsx` (nuovo)

```tsx
export default function LogoAiDocsPage() {
  return (
    <main className="docs-page">
      <h1>AI Logo Generation — Disponibile in v2</h1>
      {/* 3 sezioni come da REQ-014 */}
      <a href="/app">Torna al logo builder</a>
    </main>
  );
}
```

### `src/main.tsx` (estensione)

```tsx
const LogoAiDocsPage = lazy(() => import('./src/pages/LogoAiDocsPage'));

<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/app" element={<ProtectedRoute><App /></ProtectedRoute>} />
  <Route path="/docs/logo-ai" element={<Suspense><LogoAiDocsPage /></Suspense>} />
  <Route path="/" element={<HomePageWrapper />} />
  <Route path="*" element={<NotFoundPage />} />
</Routes>
```

### `user_settings` (estensione schema, opzionale)

```ts
preferredDocumentType: varchar('preferred_document_type', { length: 30 }),
// opzionale, null se non scelto
```

Questo campo va aggiunto in fase 7 (migration Drizzle) per persistere
la preferenza dell'utente. Se l'utente non completa step 5, resta null.

## 5. Acceptance Criteria

- **AC-001`: Given nuovo utente si registra, When completa step 1-4
  dell'onboarding, Then step 5 appare con 5 bottoni.
- **AC-002`: Given utente allo step 5, When click "QR Code", Then
  onboarding chiude, `view='qr'` settato, `QREditor` renderizzato.
- **AC-003`: Given utente ha saltato step 5 (click "Salta"), When
  onboarding chiude, Then `view='editor'` default (comportamento
  attuale mantenuto).
- **AC-004`: Given visitatore anonimo a `/`, When carica HomePage,
  Then vede hero "Tutto il branding per la tua attività, pronto in 3
  giorni" + sottotitolo + CTA "Inizia gratis".
- **AC-005`: Given visitatore anonimo, When scroll HomePage, Then
  vede sezione "Cosa puoi creare" con 5 card (Preventivo, QR,
  Bigliettino, Volantino, Logo).
- **AC-006`: Given visitatore anonimo, When scrollHomePage, Then
  vede tabella pacchetti (4 righe con prezzi).
- **AC-007`: Given visitatore anonimo, When click "Prova gratis" in
  una card, Then redirect a `/login`.
- **AC-008`: Given utente loggato in LogoEditor, When click tab "AI
  Generation" e poi link "Vedi docs", Then naviga a `/docs/logo-ai`.
- **AC-009`: Given visitatore a `/docs/logo-ai`, When legge pagina,
  Then vede 3 sezioni (perché non attivo, come attivare, torna al
  builder).
- **AC-010`: Given `README.md` aperto, When si legge la sezione
  "Funzionalità", Then 5 nuove voci presenti (QR, Bigliettino,
  Volantino, Logo, Tier system).
- **AC-011`: Given `README.md` aperto, When si legge "Schema
  Database", Then tabella `documents` (rinominata) + `unlock_codes`
  documentate.
- **AC-012`: Given `AGENTS.md` aperto, When si legge "Key Files",
  Then 6 nuovi file listati (`documentSchemas.ts`,
  `qrGenerator.ts`, `cardGenerator.ts`, `flyerGenerator.ts`,
  `logoGenerator.ts`, `watermark.ts`).
- **AC-013`: Given `AGENTS.md` aperto, When si legge "Environment
  Variables", Then `BLOB_READ_WRITE_TOKEN` rimossa e
  `REPLICATE_API_TOKEN` aggiunta con note "opzionale, v2".
- **AC-014`: Given `npm run typecheck`, Then code 0.
- **AC-015`: Given `npm run test`, Then code 0 e tutti i test
  passano.
- **AC-016`: Given `npm run build`, Then build riuscito, bundle
  size sotto 1MB (verifica no regression bundle).
- **AC-017`: HomePage passa check accessibilità: contrasto 4.5:1,
  tutti i link hanno focus visibile, heading hierarchy corretta
  (H1 → H2 → H3).

## 6. Test Automation Strategy

- **Test Levels**: Unit (LogoAiDocsPage rendering), Integration
  (OnboardingModal step 5 flow), E2E (HomePage → login flow).
- **Frameworks**: Vitest 4, React Testing Library 16, jsdom 29.
- **Test Data Management**: mock user settings, mock useNavigate per
  LogoAiDocsPage link.
- **Coverage Requirements**: ≥60% per i nuovi file (LogoAiDocsPage).
  OnboardingModal estensione coperta da test esistenti + 2 nuovi
  test per step 5.

### File di test da creare

| File | Cosa copre |
|------|-----------|
| `src/components/__tests__/OnboardingModal.step5.test.tsx` | step 5 render con 5 bottoni, click "QR Code" → onboarding complete + view='qr', click "Salta" → view='editor' default |
| `src/pages/__tests__/LogoAiDocsPage.test.tsx` | render 3 sezioni, link "Torna al logo builder" naviga a /app |
| `src/pages/__tests__/HomePage.updated.test.tsx` | render hero con nuovo titolo, 5 feature card, tabella pacchetti, 3 step, 3 card differenziazione, CTA finale |
| `src/__tests__/docsConsistency.test.ts` | verifica che README.md, REQUIREMENTS.md, AGENTS.md menzionino i nuovi file/tabelle/chiavi (parsing markdown con regex) |

### Test matrice

| AC | Test file |
|----|-----------|
| AC-001 | OnboardingModal.step5.test.tsx |
| AC-002 | OnboardingModal.step5.test.tsx |
| AC-003 | OnboardingModal.step5.test.tsx |
| AC-004 | HomePage.updated.test.tsx |
| AC-005 | HomePage.updated.test.tsx |
| AC-006 | HomePage.updated.test.tsx |
| AC-007 | HomePage.updated.test.tsx |
| AC-008 | LogoAiDocsPage.test.tsx |
| AC-009 | LogoAiDocsPage.test.tsx |
| AC-010 | docsConsistency.test.ts |
| AC-011 | docsConsistency.test.ts |
| AC-012 | docsConsistency.test.ts |
| AC-013 | docsConsistency.test.ts |
| AC-014 | typecheck |
| AC-015 | test run |
| AC-016 | build |
| AC-017 | manuale + axe-core (opzionale) |

## 7. Rationale & Context

**Perché fase 7 (polish) e non "faccio polish mentre sviluppo le
altre fasi"**:

Polish durante le fasi 0-6 è controproducente perché:
- Le feature non sono finalizzate, polish su UI temporanea è lavoro
  sprecato
- Il focus è su far funzionare le cose, non su farle belle
- Cambia il mark up ogni fase, polish va rifatto

Fase 7 dedicata alla fine dà:
- Visione completa del prodotto, polish coerente
- Tempo per testare il flusso utente end-to-end
- Documentazione che riflette lo stato final, non intermedio

**Perché HomePage refactor e non solo aggiunta sezioni**:

La HomePage attuale parla solo di preventivi. Aggiungere 5 sezioni
nuove senza toccare hero e copy esistente crea dissonanza. Refactor
completo dà messaggio coerente: "suite di branding", non "preventivi
+ altre cose".

**Perché OnboardingModal step 5 e non step 1**:

Step 1 esistente chiede displayName (necessario per tutta l'app).
Step 5 è preferenza soft ("cosa vuoi creare per primo"), non blocca
l'uso di altre feature. Permette all'utente di scegliere dove
iniziare ma non lo costringe.

**Perché persistere `preferredDocumentType` in DB**:

Per analytics futura (v2): "quanti utenti scelgono QR come primo
documento?" aiuta a capire cosa吸引 di più. Costo: 1 colonna
nullable in `user_settings`, trascurabile.

**Perché LogoAiDocsPage pubblica e non dietro login**:

L'utente che valuta l'app (visitor anonimo) vuole sapere se il logo
AI è disponibile. Mostrare "disponibile in v2, ecco come attivarlo"
è trasparente e costruisce trust. Se fosse dietro login, l'utente
deve registrarsi per scoprire che non c'è ancora — friction negativa.

**Perché docs consistency test**:

I docs manuali (`README.md`, `AGENTS.md`) si desincronizzano dal
codice facilmente. Un test che verifica "README menziona
`documentsTable` se `db/schema.ts` la definisce" previene docs
stale. Implementazione semplice con regex parsing markdown.

**Perché rimuovere `BLOB_READ_WRITE_TOKEN` da AGENTS.md**:

La variabile non è mai stata usata (PDF è client-side, vedi
AGENTS.md "PDF Generation — Client-Side Only"). Lasciarla in
documento confonde sviluppatori futuri. Rimozione cleanup.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001`: Nessuna nuova integrazione esterna.

### Third-Party Services
- **SVC-001`: Nessuna nuova dipendenza di servizio.

### Infrastructure Dependencies
- **INF-001`: Vercel Hobby — nessun impatto.
- **INF-002`: Neon Postgres — 1 migration per aggiungere
  `preferred_document_type` a `user_settings` (nullable, no
  default).

### Data Dependencies
- **DAT-001`: localStorage invariato in questa fase.
- **DAT-002`: Tabella `user_settings` estesa con
  `preferred_document_type` (opzionale).

### Technology Platform Dependencies
- **PLT-001`: React 18 — `lazy` per `LogoAiDocsPage`.
- **PLT-002`: React Router v6 — nuova route `/docs/logo-ai`.

### Compliance Dependencies
- **COM-001`: WCAG AA — HomePage accessibile.
- **COM-002`: Nessun PII raccolto in questa fase.

## 9. Examples & Edge Cases

### Edge case 1: Utente esistente (pre-fase 7) logga dopo deploy

```ts
// user con user_settings.onboardingDone=true (pre-fase 7)
// After deploy, apre l'app
// → onboarding NON riappare (flag onboardingDone rispettato)
// → user vede HomePage nuova solo se naviga a / (app è su /app)
// → user vede CollectionView unificata (fase 6)
// → user può usare tutte le 5 feature dalla sidebar
```

Onboarding step 5 è solo per utenti nuovi. Esistenti non lo vedono.

### Edge case 2: Visitatore anonimo click "Prova gratis" su HomePage

```ts
// visitor click "Prova gratis" → redirect /login
// /login è la pagina esistente (LoginPage.tsx)
// login o register ?register=1 → /app
// /app è protetta, dopo auth redirect a editor
```

Flusso standard, nessun cambiamento a LoginPage.

### Edge case 3: LogoAiDocsPage visitata da utente loggato

```ts
// user loggato naviga a /docs/logo-ai (manualmente o dal link nel
// LogoEditor tab AI)
// → pagina pubblica, accessibile anche con auth
// → link "Torna al logo builder" → /app (non /app/logo, perché
//   l'utente potrebbe voler vedere altri documenti)
// → se user vuole tornare al logo specifico, usa sidebar
```

### Edge case 4: HomePage su mobile

```ts
// 5 card feature grid su mobile → 1 colonna stack
// tabella pacchetti su mobile → orizzontale scroll o card stack
// 3 step "Come funziona" → 1 colonna stack
// → responsive CSS inline, media queries
```

### Edge case 5: README.md sezione "Struttura file" outdated

```ts
// docsConsistency.test.ts verifica che README menzioni i nuovi file
// se developer dimentica di aggiornare README, test fallisce
// → prompt per developer: "README.md non menziona
//   'src/utils/documentSchemas.ts'. Aggiorna la sezione 'Struttura
//   file'."
```

### Edge case 6: Onboarding step 5 con user settings_save fallito

```ts
// user completa step 5, click "QR Code"
// saveUserSettings fallisce (network error)
// → onboarding chiude comunque (preferredDocumentType non critico)
// → view='qr' settato
// → toast "Preferenza non salvata, riprova da Impostazioni"
// → user può usare QR editor
```

Soft fail: la preferenza è opzionale, non blocca l'uso.

### Edge case 7: HomePage caricata su browser vecchio (IE 11)

```ts
// PrecisionQuote non supporta IE 11 (React 18 richiede browser
// moderni)
// → HomePage non renderizza, schermata bianca
// → nessun polyfill aggiunto in fase 7
// → out of scope: supporto browser vecchi
```

## 10. Validation Criteria

Prima di considerare la fase 7 completata (e l'espansione multi-documento
finalizzata), verificare:

1. `npm run typecheck` code 0.
2. `npm run test` code 0, tutti i test passano (100+ test totali).
3. `npm run build` riuscito, `dist/` generato.
4. `git diff src/components/OnboardingModal.tsx` mostra step 5 con 5
   bottoni.
5. `git diff src/pages/HomePage.tsx` mostra refactor completo con 6
   sezioni.
6. `git status` mostra i nuovi file:
   - `src/pages/LogoAiDocsPage.tsx`
   - `src/components/__tests__/OnboardingModal.step5.test.tsx`
   - `src/pages/__tests__/LogoAiDocsPage.test.tsx`
   - `src/pages/__tests__/HomePage.updated.test.tsx`
   - `src/__tests__/docsConsistency.test.ts`
7. `git diff README.md` mostra:
   - Titolo aggiornato a "Suite branding"
   - 5 nuove righe in "Funzionalità"
   - Albero file aggiornato
   - Tabella `documents` + `unlock_codes`
   - `REPLICATE_API_TOKEN` (opzionale, v2) al posto di
     `BLOB_READ_WRITE_TOKEN`
   - Nuove chiavi localStorage
8. `git diff REQUIREMENTS.md` mostra nuove chiavi e tabelle.
9. `git diff DESIGN.md` mostra nuovi componenti + modularizzazione
   aggiornata.
10. `git diff AGENTS.md` mostra:
    - 6 nuovi file in "Key Files"
    - `BLOB_READ_WRITE_TOKEN` rimossa, `REPLICATE_API_TOKEN`
      aggiunta
    - Nuove chiavi localStorage in "localStorage Schema"
11. `git diff src/main.tsx` mostra route `/docs/logo-ai`.
12. `npm run db:generate` produce migration `*_add_preferred_document_type/`.
13. Manuale: `npm run dev`:
    - Naviga a `/` come anonimo → verifica HomePage nuova
    - Registrati → verifica onboarding 5 step
    - Verifica step 5 click "QR Code" → view='qr'
    - Login come admin → verifica AdminDashboard tab "Codici
      sblocco" (fase 5)
    - Naviga a `/docs/logo-ai` → verifica pagina docs
14. Manuale: verifica accessibilità HomePage con Lighthouse o axe
    devtools (contrasto, heading hierarchy, focus).
15. Manuale: verifica bundle size con `npm run build` + `ls -la
    dist/assets/*.js` → main bundle <800KB (gzipped).
16. `git status` pulito dopo commit (no file dimenticati).

## 11. Related Specifications / Further Reading

- `spec/spec-process-phase0-autosave-fix.md` — fix auto-save
- `spec/spec-tool-phase1-qr-code.md` — QR
- `spec/spec-design-phase2-business-card.md` — Bigliettino
- `spec/spec-design-phase3-flyer.md` — Volantino
- `spec/spec-tool-phase4-logo-builder.md` — Logo (con link a
  LogoAiDocsPage)
- `spec/spec-data-phase5-tier-system.md` — Tier system
- `spec/spec-architecture-phase6-unified-collection.md` —
  CollectionView unificata
- `AGENTS.md` — regole test, guardrails, env vars
- `README.md` — docs面向 utente (dev essere aggiornato)
- `REQUIREMENTS.md` — prerequisiti e setup
- `DESIGN.md` — design system
- `AI_ARCHITECTURE.md` — architettura AI (invariato in questa
  espansione)
- Skill `writing-guidelines` — per docs style
- Skill `frontend-design` — per HomePage design intenzionale
- Skill `web-design-guidelines` — accessibilità
- Skill `vercel-react-best-practices` — lazy load, performance

### Conclusioni espansione multi-documento

Dopo il completamento della fase 7, l'app è pronta per:
- Mostrare a potenziali clienti (HomePage updated)
- Onboardare nuovi utenti (5-step wizard)
- Essere mantenuta da sviluppatori futuri (docs updated)
- Trattenere utenti free con watermark (tier system)
- Monetizzare via codici sblocco manuali (fase 5) → Stripe in v2

Prossimi step (out of scope v1, da pianificare in v2):
- Stripe integration (automatizzare redeem codici)
- AI logo generation con Replicate (richiede Vercel Pro)
- Storage immagini su Vercel Blob (per >50 clienti)
- Integrazione tipografia (Stampaprint API)
- QR dinamici con short-url e statistiche
- Brand book automatico
- Mockup generator (logo su prodotti)
