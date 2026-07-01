---
title: Quickbrand — Rebrand, Copy & Palette "The Classic" (Red & Ink)
version: 1.0
date_created: 2026-07-01
owner: Marketing / Frontend
tags: [design, branding, copywriting, landing-page, palette]
---

# Introduction

Questo documento definisce il rebrand del prodotto attualmente noto come
**PrecisionQuote** nel nuovo marchio **Quickbrand**, la nuova palette
cromatica "The Classic" (Red & Ink) e la riscrittura integrale della copy
della landing page (`src/pages/HomePage.tsx`) con voce da Senior
Marketing Copywriter per un disruptor del design accessibile.

La spec è pensata per essere applicata in un singolo passaggio di
implementazione (rename + palette + copy) sulla sola pagina di
marketing. Il rename del brand riguarda SOLO la superficie utente
visibile (landing, documenti esportabili, watermark). I nomi interni
(localStorage keys, env vars, nomi cartelle, slug DB) NON vengono
toccati in questa fase per evitare migrazioni dati (vedi CON-001).

## 1. Purpose & Scope

**Purpose**. Trasformare la landing page da un sito "multi-doc
(Preventivi + Biglietti + QR + Logo)" in una **proposizione di brand
disruptor focalizzata su biglietti da visita + logo**, con
positioning anti-agenzia, claim "60 secondi dall'idea al file
tipografia" e identità cromatica tech-modernista.

**Audience**. Creatori, freelance e startup che hanno bisogno di un
brand professionale subito e a basso costo.

**Scope IN**:
- `src/pages/HomePage.tsx` (tutto: markup + CSS inline + copy).
- Stringhe utente visibili in export (watermark `PRECISIONQUOTE · FREE`
  → `QUICKBRAND · FREE` in `HomePage.tsx`; eventuali altri watermark
  testuali esposti in export vanno rinominati in fase di
  implementazione, vedi REQ-W04).
- Logo SVG inline nell'header della landing (il `<rect>`/`<path>` del
  brand mark).

**Scope OUT** (esplicitamente escluso da questa spec):
- Rename di variabili, file, cartelle, env vars, chiavi localStorage.
- Rename del dominio Vercel / DNS.
- Modifiche a `App.tsx`, `AppShell.tsx`, pagine `/app/*`, `LoginPage`.
- Modifiche a `api/index.ts`, `db/schema.ts`.
- Nuove feature prodotto (solo copy + palette + brand mark).
- Modifiche al sistema di tier / pricing (i prezzi restano identici,
  solo la cornice testuale cambia).

## 2. Definitions

| Termine | Definizione |
|---------|-------------|
| **Quickbrand** | Nuovo nome marchio del prodotto (ex *PrecisionQuote*). |
| **The Classic** | Nome della palette cromatica definita in questa spec (Red & Ink). |
| **Rosso Svizzero** | Colore d'accento `#E62020`. Per CTA d'azione ("Genera Logo", "Crea il tuo brand"). |
| **Nero Profondo** | Colore di testo/bordo `#1A1A1A`. Per testi, bordi griglia, icone Lucide. |
| **Bianco Assoluto** | Colore di sfondo `#FFFFFF`. Per il massimo contrasto. |
| **PDF 10-up** | Export A4 con 10 bigliettini già impaginati pronti per la tipografia. |
| **Collision detection** | Logica in `src/utils/gridUtils.ts` che impedisce sovrapposizioni di elementi nel grid editor. |
| **DeepSeek** | Provider LLM usato come AI Co-Editor (server-side, `DEEPSEEK_API_KEY`). |
| **Brand mark** | Il glifo SVG quadrato nell'header (attualmente `<rect rx=8>` + 3 linee orizzontali). |
| **Watermark** | Sovrapposizione diagonale sui documenti tier Free. |

## 3. Requirements, Constraints & Guidelines

### Brand & Naming

- **REQ-N01**: Il nome `PrecisionQuote` (con maiuscole/minuscole
  qualsiasi) NON deve comparire più in alcuna stringa **utente-visibile**
  della landing page. Sostituito con `Quickbrand` (esatto casing:
  `Q` maiuscola, `b` minuscola, resto minuscolo).
- **REQ-N02**: Il footer `© 2026 PrecisionQuote · Giovanni Cidu` diventa
  `© 2026 Quickbrand · Giovanni Cidu`.
- **REQ-N03**: La watermark SVG (`<text>` nel pattern `hp-wm-front`) usa
  `QUICKBRAND · FREE` (tutto maiuscolo, coerente con lo stile watermark).
- **REQ-N04**: Il `<title>` documentale della pagina (se presente via
  `document.title` o tag `<title>` in `index.html`) diventa
  `Quickbrand — Logo e biglietti da visita in 60 secondi`. (Verifica
  anche `index.html`.)
- **CON-N01**: NON rinominare le chiavi localStorage
  (`precisionQuote_quotes`, `precisionQuote_documents`), né le env vars
  (`ADMIN_PASSWORD`, `VITE_ADMIN_PASSWORD`), né i nomi file/cartelle.
  Il rename è SOLO di superficie utente. Razionale: evitare migrazioni
  dati e regressioni su auth/tier (vedi §7).
- **CON-N02**: L'email di contatto `webdevcagliari@gmail.com` resta
  invariata (non è legata al nome marchio).

### Palette "The Classic" (Red & Ink)

Palette a 3 colori core (più 3 token di servizio derivati). Stile:
**International Typographic Style** svizzero — bianco assoluto come
carta, nero profondo per inchiostro e griglia, rosso svizzero come
unico accento d'azione. Coerenza letterale col claim "precisione
svizzera".

Tabella dei token. **Ogni colore va definito come CSS custom property**
sul selettore `.hp` e referenziato nei CSS inline invece di hardcodare
gli hex.

| Token | Light mode | Dark mode | Ruolo |
|-------|-----------|-----------|-------|
| `--qb-red` | `#E62020` | `#FF3B3B` | Accento unico: CTA d'azione, accent H1, badge, step num, watermark fill |
| `--qb-ink` | `#1A1A1A` | `#E8EAF0` | Testi (H1/H2/body), bordi griglia, stroke icone Lucide |
| `--qb-paper` | `#FFFFFF` | `#0F1117` | Sfondo carta / card |
| `--qb-muted` | `#5C5C5C` | `#9AA0AE` | Caption / testo body lungo (AA vs paper) |
| `--qb-surface` | `#F7F7F7` | `#14161F` | Sezioni alternate (demo, steps) — quasi-bianco, non invadente |
| `--qb-border` | `#1A1A1A` | `#2D3044` | Bordo card / divider (nero profondo in light per la "griglia" svizzera) |
| `--qb-red-soft` | `#FCE8E8` | `rgba(255,59,59,.12)` | Tint di sfondo per CTA ghost hover / bullet prezzo |
| `--qb-success` | `#10B981` | `#10B981` | Tier tag "SBLOCCATO" (invariato, non fa parte del 3-color core) |

- **REQ-C01**: Sostituire **tutte** le occorrenze di `#0B57D0` (e la
  sua dark variant `#4d94ff`) nella landing con il token `--qb-red`
  (`#E62020` light / `#FF3B3B` dark). Include: brand mark, eyebrow,
  H1 accent, CTA, CTA ghost (testo), step number, price featured ring,
  price badge, price bullet, final CTA background, watermark fill.
- **REQ-C02**: Il brand mark SVG nell'header usa `fill="var(--qb-red)"`
  (`#E62020`). La forma (rettangolo arrotondato + 3 linee = layout a
  griglia) resta: nero su rosso comunicava "editor strutturato", ora
  il rosso diventa la firma cromatica svizzera. Le linee interne restano
  bianche (`stroke="white"`) per contrasto sul rosso (ratio 3.7:1 su
  elementi non testuali, accettabile per icone decorative).
- **REQ-C03**: La sezione `.hp-demo-section` (sfondo gradiente) usa
  `--qb-surface` come colore di partenza
  (`linear-gradient(180deg, var(--qb-surface) 0%, var(--qb-paper) 100%)`).
  Niente ghiaccio blu: il quasi-bianco neutro mantiene la carta svizzera.
- **REQ-C04**: Il testo dei paragrafi descrittivi (`.hp-sub`,
  `.hp-section-sub`, `.hp-create-item p`, `.hp-step p`, `.hp-price-card
  li`) usa `--qb-ink` per titoli e `--qb-muted` per body lungo;
  eyebrow, numeri step, badge prezzo, accent H1 usano `--qb-red`.
- **REQ-C05**: Il `fill` della watermark SVG è **neutro** (nero profondo
  a opacity bassa), NON brand red. La watermark è utility/discrezione,
  non accent: `fill="#1A1A1A" fillOpacity="0.10"` in light; in dark
  resta neutro via `mix-blend-mode` + override opacity. Razionale: il
  pattern ripetuto rosso su tutta la card era visivamente rumoroso e
  confondeva con "errore/azione" (red = azione, non "marchio discreto").
- **REQ-C06**: I bordi delle card (`.hp-create-item`, `.hp-price-card`)
  in **light mode** diventano `1px solid var(--qb-border)` con opacity
  ridotta via `rgba(26,26,26,.18)` — non nero pieno (troppo pesante),
  ma visibilmente nero-nero, non grigio-blu come prima. Questo è il
  dettaglio che rende la griglia "svizzera" invece di "corporate soft".
- **REQ-C07 (raffinamento)**: il rosso è **accent chirurgico**, non
  onnipresente. Regola: il rosso appare SOLO su (a) brand mark
  nell'header, (b) CTA d'azione primari, (c) H1 accent span, (d) badge
  prezzo Pro / price-featured ring, (e) focus rings (sottili, 10%
  opacity), (f) role-badge admin. Tutto il resto — watermark, numeri
  stat, password-strength "good", AI log entry info, shapes decorative
  404, brand-logo sidebar — resta **neutro** (ink/muted/grigio).
- **GUD-C01**: Le icone Lucide (SVG inline `stroke`) usano
  `currentColor` con `color: var(--qb-ink)` di default,
  `var(--qb-red)` su hover/focus. Nessun hex hardcoded negli stroke.
- **GUD-C02**: Contrast ratio AA (4.5:1) verificato:
  `--qb-ink` `#1A1A1A` su `--qb-paper` `#FFFFFF` = 16.2:1 ✓✓;
  `--qb-red` `#E62020` su `--qb-paper` = 4.6:1 ✓ (testo piccolo OK per
  AA, appena sopra soglia — usare `--qb-ink` per body lungo, `--qb-red`
  solo per accenti/headline grandi);
  `--qb-muted` `#5C5C5C` su `#FFFFFF` = 7.3:1 ✓;
  `--qb-paper` `#FFFFFF` su `--qb-red` `#E62020` = 4.6:1 ✓ (testo CTA
  bianco su rosso OK).
- **GUD-C03**: Niente blu da nessuna parte. Verificare con grep
  post-implementazione: zero `#0B57D0`, zero `#4d9`, zero `#e8f0fe`
  (il vecchio tint blu). I tint di sfondo diventano `--qb-red-soft`
  (`#FCE8E8`). **Eccezione**: i semantic colors della AI log console
  (`#60a5fa` info, `#34d399` success, `#f87171` error) restano
  standard — sono semantica di stato, non brand color.

### Copy & Messaging (Senior Copywriter)

Posizionamento: **disruptor anti-agenzia**. Tono: diretto, tecnico ma
non nerd, sicuro di sé, niente parole vuote ("rivoluzionario",
"innovativo" da evitare — i fatti parlano). Voce in **italiano**,
sentence case, verbi attivi, niente esclamativi.

- **REQ-M01 — Hero eyebrow**:
  `Logo · Biglietti · Pronti per la stampa`
- **REQ-M02 — H1** (3 righe, a capo come da layout attuale):
  ```
  Smetti di pagare le agenzie.
  Il tuo brand, pronto per la
  tipografia in 60 secondi.
  ```
  L'accento (`hp-h1-accent`) cade su `60 secondi.` (non sull'intera
  ultima riga, per dare ritmo). Sostituire il blocco `Tutto quello che
  serve... pronto in 3 giorni.`.
- **REQ-M03 — Sub-hero**:
  ```
  Quickbrand ti dà logo in SVG e biglietti da visita professionali
  in pochi clic. Editor a griglia con precisione svizzera, AI che
  ottimizza palette e testi in tempo reale, export PDF 10-up e
  vettoriali puri. Dall'idea al file pronto in 60 secondi.
  ```
- **REQ-M04 — CTA primaria** (utente non loggato): `Crea il tuo brand →`
  (era "Inizia gratis →"). CTA secondaria resta `Vedi i pacchetti`.
- **REQ-M05 — Hero foot**:
  `Nessuna carta di credito · File pronti per la tipografia · 60 secondi`
  (era "Prova senza limiti di tempo").
- **REQ-M06 — Sezione "Cosa puoi creare" → ribattezzata "Cosa include Quickbrand"**:
  Mantenere 4 card ma **riordinare** per rilevanza brand: 1) Biglietti
  da visita, 2) Logo SVG, 3) QR Code, 4) Preventivi. Copy per ogni card
  (titolo + descrizione):
  1. **Biglietti da visita** — `Layout split, centrato o sinistro. Foto,
     logo, QR sul retro con contatti e social. Export PDF 10-up pronto
     tipografia (A4 con 10 bigliettini già posizionati), PNG alta
     risoluzione o SVG vettoriale puro.`
  2. **Logo SVG** — `Builder con 4 template per settore (tech, food,
     fashion, professionista), 3 layout, 48 icone Lucide. Esporta SVG
     editabile o PNG fino a 2048px. Zero costi AI: qualità deterministica.`
  3. **QR Code** — `7 tipi: URL, testo, email, telefono, vCard, WiFi,
     SMS. Stili square, rounded o dots. Logo overlay opzionale. Export
     SVG vettoriale.`
  4. **Preventivi** — `Fino a 4 opzioni per preventivo, con costi una
     tantum e mensili, IVA, acconto, saldo e clausole. PDF
     professionale. Per chi serve anche la parte commerciale.`
- **REQ-M07 — Sezione demo flip**: titolo diventa
  `Gratis con watermark. Sbloccata, pronta per la stampa.` (era
  "pulita"). Sub: `Tocca o passa il mouse sulla card per vedere il
  file finale.` Hint post-flip resta funzionale
  (`◀ Torna al fronte (Free)` / `Vai al retro (Sbloccato) ▶`).
- **REQ-M08 — Sezione "Come funziona"** (3 step, riadattata al flusso
  brand-first):
  1. **Scegli il settore** — `Logo builder con template tech, food,
     fashion o professionista. Personalizza testo, colori e icone
     Lucide. Anteprima live.`
  2. **Lascia lavorare l'AI** — `L'AI Co-Editor (DeepSeek) ottimizza
     palette e testi in tempo reale. Il grid editor con collision
     detection impedisce errori di layout: non puoi sbagliare.`
  3. **Esporta per la tipografia** — `SVG vettoriali puri per il logo,
     PDF 10-up A4 con 10 bigliettini già impaginati per la stampa.
     Senza watermark, 300 DPI.`
  (I numeri step restano 1/2/3 — la sequenza è informativa, legittimo
  uso dei marker numerici.)
- **REQ-M09 — Sezione pricing**: titolo primario
  `Un piano. Tutto incluso.` (era "Piano mensile"). Sub:
  `Il piano Pro copre l'AI che usi davvero e sblocca i file pronti per
  la tipografia su tutti i tuoi documenti.` I prezzi €0/€9 e i pacchetti
  €49/€349/€690 RESTANO IDENTICI (CON-N03). Solo la cornice testuale
  cambia. Il badge "Per chi usa l'app" → `Per chi va in tipografia`.
- **REQ-M10 — Pricing note finale**: sostituire con
  ```
  Manutenzione mensile €49/mese: aggiornamenti, 1-2 grafiche, hosting
  gestito. A confronto: un'agenzia chiede €2.500-8.000 e 2-4 settimane
  di attesa. Quickbrand te li consegna in 60 secondi.
  ```
- **REQ-M11 — Final CTA**:
  H2: `Dall'idea alla tipografia in 60 secondi.` (era "Inizia ora,
  gratis."). P: `Crea logo e biglietti da visita adesso.` CTA primaria
  (non loggato): `Crea il tuo brand →` (coerente con M04).
- **REQ-M12 — Footer**: `© 2026 Quickbrand · Giovanni Cidu` + riga
  piccola `Pagamenti gestiti personalmente via email · Cagliari, Italia`
  (invariata).
- **GUD-M01**: Evitare parole-vuote: "rivoluzionario", "innovativo",
  "potente", "intelligente" (l'AI si dimostra, non si autocelebra).
  Verificare con grep post-implementazione che non compaiano.
- **GUD-M02**: Niente punti esclamativi in tutta la landing. Tono
  sicuro, non entusiasta da brochure.
- **GUD-M03**: "60 secondi" è il numero-chiave ripetuto: H1, sub-hero,
  hero-foot, final CTA, pricing note. La ripetizione è intenzionale
  (anchor cognitivo). Non aggiungerlo in altre sezioni (saturazione).

### Brand mark (logo inline header)

- **REQ-L01**: Il brand mark resta un SVG 26×26 inline nell'header.
  Aggiornare `fill="#0B57D0"` → `fill="var(--qb-blue)"`. La forma
  (rettangolo arrotondato + 3 linee che simulano un layout a griglia)
  resta: comunica "editor strutturato". Nessun nuovo asset esterno.

## 4. Interfaces & Data Contracts

Nessuna nuova API. Nessun nuovo contratto dati. La pagina continua a
consumare:
- `user` prop (da `AppShell`/router) per mostrare CTA `Vai all'App` vs
  `Crea il tuo brand`.
- `createGiovanniCardTemplate()` da `src/utils/documentSchemas.ts` per
  la card demo (invariato).
- `CardPreview` da `src/components/CardPreview.tsx` (invariato).

**CSS token contract** (nuovo, interno alla landing):

```css
.hp{
  --qb-red:#E62020;
  --qb-ink:#1A1A1A;
  --qb-paper:#FFFFFF;
  --qb-muted:#5C5C5C;
  --qb-surface:#F7F7F7;
  --qb-border:rgba(26,26,26,.18);
  --qb-red-soft:#FCE8E8;
  --qb-success:#10B981;
}
[data-theme="dark"] .hp{
  --qb-red:#FF3B3B;
  --qb-ink:#E8EAF0;
  --qb-paper:#0F1117;
  --qb-muted:#9AA0AE;
  --qb-surface:#14161F;
  --qb-border:#2D3044;
  --qb-red-soft:rgba(255,59,59,.12);
}
```

Tutti i selettori esistenti che hardcodano `#0B57D0`/`#4d94ff` (e i tint
`#e8f0fe`/`#d2e3fc` blu) vanno migrati ai token `--qb-red` /
`--qb-red-soft`. I testi grigi (`#475569`/`#647086`/`#8892a8`) migrano a
`--qb-muted`/`--qb-ink`. I bordi `#e2e8f0`/`#c7d2e0` migrano a
`--qb-border` (nero profondo a opacity in light).

## 5. Acceptance Criteria

- **AC-001**: Given la landing renderizzata, When si cerca la stringa
  `PrecisionQuote` (case-insensitive) nel DOM visibile, Then zero match
  (footer, header, watermark, title, meta).
- **AC-002**: Given la landing in light mode, When si ispeziona il CTA
  primario `.hp-cta`, Then `background` computa `#E62020` (non `#0B57D0`).
- **AC-003**: Given la landing in dark mode, When si ispeziona l'H1
  accent `.hp-h1-accent`, Then `color` computa `#FF3B3B`.
- **AC-004**: Given la landing, When si legge l'H1, Then il testo è
  `Smetti di pagare le agenzie. / Il tuo brand, pronto per la /
  tipografia in 60 secondi.` con `60 secondi.` nello span accent.
- **AC-005**: Given la sezione "Cosa include Quickbrand", When si
  contano le card, Then sono 4 nell'ordine Biglietti → Logo → QR →
  Preventivi.
- **AC-006**: Given la sezione pricing, When si legge il prezzo Pro,
  Then è `€9 /mese` (invariato rispetto a pre-rebrand).
- **AC-007**: Given la watermark SVG, When si ispeziona il `<text>`,
  Then il contenuto è `QUICKBRAND · FREE` con `fill` **neutro** (non
  `#E62020`): la watermark è utility, non brand accent.
- **AC-008**: Given grep su `src/pages/HomePage.tsx`, When si cerca
  `#0B57D0`, `#4d94ff`, `#4d9`, `#e8f0fe` o `#d2e3fc`, Then zero match.
- **AC-009**: Given grep su `src/pages/HomePage.tsx`, When si cerca
  `!` in stringhe utente (escluse commenti CSS e selettori), Then zero
  punti esclamativi nella copy.
- **AC-010**: Given un screen reader, When si naviga la hero, Then
  `aria-label` del flip demo resta descrittivo e funzionale (non
  modifica semantica, solo copy watermark rinominata).

## 6. Test Automation Strategy

- **Framework**: Vitest + React Testing Library + jsdom (stack esistente).
- **Livello**: Unit/Component su `HomePage.tsx`.
- **Nuovi test** in `src/pages/__tests__/HomePage.test.tsx` (o file
  dedicato `HomePage.rebrand.test.tsx`):
  1. Renderizza `Quickbrand` nello span brand (non `PrecisionQuote`).
  2. H1 contiene `Smetti di pagare le agenzie` e `60 secondi`.
  3. Lo span `.hp-h1-accent` contiene `60 secondi.`.
  4. Sezione "Cosa include Quickbrand" ha 4 card in ordine
     Biglietti/Logo/QR/Preventivi (verifica testo primo `<h3>` di ogni
     card).
  5. Footer contiene `© 2026 Quickbrand`.
  6. Watermark `<text>` contiene `QUICKBRAND · FREE`.
  7. Pricing Pro prezzo `€9` invariato.
  8. Nessun punto esclamativo nella copy utente (query testi rendered).
- **Regression**: aggiungere snapshot assertion che il documento NON
  contiene la stringa `PrecisionQuote` (case-insensitive) nel
  `container.textContent`.
- **Coverage**: target 60% sul file `HomePage.tsx` (righe di copy
  coperte dai test sopra).
- **CI**: `npm run test` deve essere verde prima di proporre push
  (vedi AGENTS.md §Pre-push Checklist).

## 7. Rationale & Context

**Perché solo superficie utente (CON-N01).** Le chiavi localStorage
`precisionQuote_*` sono già in produzione su utenti esistenti. Un
rename forzato spezzerebbe la lettura dei documenti salvati e
richiederebbe una migrazione con fallback (vedi AGENTS.md
§localStorage Schema). Il brand marketing è indipendente dalla
chiave di archiviazione: l'utente non vede mai `precisionQuote_quotes`.
Stessa logica per env vars e cartelle. Un rename profondo va pianificato
come fase separata (post-fase 7 Polish).

**Perché riordinare le card (REQ-M06).** Il nuovo positioning è
brand-first (logo + biglietti). I preventivi diventano il 4° elemento
("per chi serve anche la parte commerciale"), non più l'apripista.
L'ordine comunica gerarchia di valore.

**Perché "60 secondi" ripetuto 4 volte (GUD-M03).** È l'anchor
cognitivo del disruptor. Ripeterlo in H1 + sub + hero-foot + final CTA
+ pricing note lo fissa. Oltre 5 si satura; sotto 3 non attecchisce.

**Perché Rosso Svizzero `#E62020` + nero `#1A1A1A` + bianco.** La
palette è in **3 colori** e segue letteralmente l'International
Typographic Style svizzero (Müller-Brockmann, Helvetica, griglie
visibili). Il claim "precisione svizzera" del prodotto diventa
visivamente vero: bordi neri visibili (non grigio-blu soft), carta
bianca assoluta, un solo accento rosso chirurgico sui CTA d'azione
("Genera Logo", "Crea il tuo brand"). `#0B57D0` (Google Blue) era
corporate/passivo; il rosso svizzero è azione + tipografia. Il
contrasto nero/bianco = 16.2:1 massimizza leggibilità e accessibilità.
Il rosso su bianco = 4.6:1: appena sopra AA per testo piccolo, quindi
il rosso si usa **solo** per headline accent / CTA / badge, mai per
body lungo (che resta `--qb-ink`/`--qb-muted`). In dark mode il rosso
si schiarisce a `#FF3B3B` per mantenere vividezza su carta scura.

**Perché niente esclamativi (GUD-M02).** Il tone-of-voice disruptor
funziona con certezza asciutta, non con entusiasmo da volantino.
"Smetti di pagare le agenzie." (punto) è più forte di "Smetti di
pagare le agenzie!".

**Perché la forma del brand mark non cambia (REQ-L01).** Le 3 linee
orizzontali nel rettangolo arrotondato suggeriscono già un layout a
griglia = il grid editor. Il cambio cromatico al Electric Blue basta
a rinfrescarne la lettura senza rifare il logo design (out of scope).

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: DeepSeek API — già integrato server-side
  (`DEEPSEEK_API_KEY`), menzionato nella copy come "AI Co-Editor".
  Nessuna modifica all'integrazione, solo copy.

### Third-Party Services
- Nessuna nuova dipendenza. `lucide-react` e `qrcode` restano.

### Infrastructure Dependencies
- **INF-001**: Vercel Hobby plan — la landing è statica (Vite build),
  nessun nuovo function. Nessun impatto sul limite 12-function.

### Data Dependencies
- Nessuna. La pagina non legge dati dinamici oltre a `user`.

### Technology Platform Dependencies
- **PLT-001**: React 18 + Vite — invariato.

### Compliance Dependencies
- **COM-001**: GDPR — nessun nuovo dato utente raccolto. Email
  contatto `mailto:` esistente, invariata.

## 9. Examples & Edge Cases

### Esempio: H1 con accent mirato

```tsx
<h1 className="hp-h1">
  Smetti di pagare le agenzie.<br />
  Il tuo brand, pronto per la<br />
  <span className="hp-h1-accent">tipografia in 60 secondi.</span>
</h1>
```

Nota: l'accent cade SOLO su `tipografia in 60 secondi.` (non su tutta la
terza riga) per dare un secondo punto focale dopo l'apertura. Verificare
visivamente che `60 secondi.` resti leggibile (Rosso Svizzero `#E62020`
su bianco = 4.6:1 ✓ AA, ma usare font-weight 800+ per robustezza).

### Edge case: dark mode watermark

In dark mode il `--qb-red` diventa `#FF3B3B` (più luminoso). Il rosso è
intrinsecamente invadente; con `mix-blend-mode:multiply` su sfondo
scuro può coprire troppo il retro card. Se in QA il watermark risulta
eccessivo in dark, abbassare l'opacity del solo overlay:

```css
[data-theme="dark"] .hp-watermark-overlay{opacity:.55}
```

Da validare a video, non automatizzare. In light mode l'opacity `0.12`
su bianco è già calibrato.

### Edge case: card demo Giovanni

`createGiovanniCardTemplate()` ha `company: 'HPE CDS'` e QR che punta al
sito personale. NON va toccato: la card demo è un caso realistico
d'uso, il rebrand riguarda il container (landing) non l'oggetto demo.

## 10. Validation Criteria

Prima di considerare la spec implementata, verificare:

1. `npm run typecheck` verde.
2. `npm run test` verde (inclusi i nuovi test §6).
3. Grep su `src/pages/HomePage.tsx`: zero `#0B57D0`, zero `#4d94ff`,
   zero `PrecisionQuote` (case-insensitive), zero `!` in copy utente.
4. Controllo visivo manuale in light + dark mode di: header, hero,
   card demo (front con watermark + back sbloccato), pricing, final
   CTA, footer.
5. Controllo accessibilità: focus visibile sul flip demo
   (`outline:3px solid var(--qb-blue)`), contrasto AA su tutti i
   testi colorati.
6. Lighthouse SEO/Accessibilità ≥ 95 (la pagina è quasi tutta
   statica, non deve regredire).

## 11. Related Specifications / Further Reading

- `spec/spec-design-phase2-business-card.md` — modulo biglietti (riferimento prodotto).
- `spec/spec-design-phase2-2-card-refactor.md` — grid editor + collision detection (richiamato in REQ-M08 step 2).
- `spec/spec-tool-phase4-logo-builder.md` — logo SVG builder (richiamato in REQ-M06 card 2 e REQ-M08 step 1).
- `AGENTS.md` §localStorage Schema — ragione per cui il rename è solo superficie (CON-N01).
- `AGENTS.md` §Pre-push Checklist — `typecheck && test` obbligatori prima del push.
