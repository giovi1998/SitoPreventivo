---
title: Phase 2.2 — Refactor & fix del modulo Bigliettino (griglia, AI, parità mobile, preview, testo, feedback, DX)
version: 2.0
date_created: 2026-06-30
last_updated: 2026-06-30
owner: Giovanni Cidu
tags: [design, business-card, refactor, clean-code, grid, ai, responsive, vercel, mobile-parity, qr, typography, feedback, dx, headroom, caveman]
---

> **Stato (2026-06-30)**: Phase 2.2 **completata**. Fasi A-K tutte
> implementate e coperte da test. **1042 test verdi** (90 file),
> typecheck pulito. Tutti i bug bloccanti chiusi; restano solo due
> questioni di scope minore (UX mobile + persistenza selezione grid)
> documentate in "Known Issues — Card".

# Introduction

La fase 2.2 è un intervento di **refactor e bug-fixing** sul modulo
Bigliettino (`CardEditor`) già consegnato in fase 2/2.1. Non aggiunge
funzionalità di prodotto radicalmente nuove: rende affidabili, prevedibili
e coerenti quelle esistenti, elimina bug confermati nel codice, colma i
gap di parità desktop/mobile, e migliora UX (feedback, testo che va a
capo, controllo dimensione font, QR ridimensionabile) e DX (token saving
attivo di default).

Questo documento è scritto per essere **eseguito da un'altra AI** senza
contesto pregresso. Ogni requisito è numerato, ha rationale, file
coinvolti, contratto dati e criteri di accettazione testabili. Le sezioni
§3 (Requirements) e §4 (Interfaces) sono la fonte di verità; §7
(Rationale) spiega il "perché"; §6 (Test) e §5 (Acceptance) definiscono
il "fatto = verde".

> **Stato corrente (IMPORTANTE per chi implementa)**: la **Fase A è già
> implementata e committata** (commit `0fa88c1`, `d5bf3b6`, `0b3e68e`).
> Le fasi **B, C, D, E, F, G, H, I, J, K sono DA FARE**. La Fase A ha
> introdotto il flag `front.useGrid`/`back.useGrid` e una semantica di
> grid-mode che **viene RIVISTA** dalla Fase E (vedi REQ-E01): chi
> implementa la Fase E deve modificare il comportamento introdotto in A02
> seguendo il nuovo modello. Vedi §3.0 "Stato di implementazione".

Vincoli architetturali invariati: PDF/PNG/SVG 100% client-side, API
monolitica Vercel (`api/index.ts`) immutata, nessun nuovo endpoint, push
manuale (mai automatico), test obbligatori verdi prima di ogni commit.

## 1. Purpose & Scope

**Purpose**: rendere il modulo Bigliettino corretto, prevedibile,
accessibile e a parità completa desktop/mobile, con feedback chiaro
all'utente, testo sempre leggibile, QR e tipografia controllabili sia
manualmente sia via AI, e con un'esperienza di sviluppo che attiva di
default lo stack di risparmio token (headroom + caveman).

**Scope** (file coinvolti, raggruppati per fase):

| Area | File |
|------|------|
| Schema/dominio | `src/utils/documentSchemas.ts`, `src/ai/aiCardInputSchema.ts` |
| Editor | `src/components/CardEditor.tsx`, `src/components/MobileGridEditor.tsx` |
| Preview | `src/components/CardPreview.tsx` |
| Stili | `src/components/CardEditor.css` |
| Griglia (logica) | `src/utils/gridUtils.ts` |
| Export | `src/utils/cardGenerator.ts` |
| AI | `src/ai/cardMerge.ts`, `src/ai/cardOrchestrator.ts`, `src/ai/prompts/cardSystem.ts`, `src/hooks/useAICard.ts` |
| Zoom | `src/hooks/useCardPreviewZoom.ts` |
| Componenti estratti (NEW) | `src/components/card/*` |
| DX/tooling | `package.json`, `scripts/start-agent.mjs`, **NEW** `scripts/dev.mjs` |
| Docs | `AGENTS.md`, `README.md` |
| Test | `src/**/__tests__/*` |

**Out of scope**:
- Drag-and-drop diretto sulla griglia mobile (si mantengono frecce +
  selettore lato — decisione utente confermata). Il drag-and-drop resta
  un'idea futura non vincolante.
- Nuovi formati di export.
- Modifiche all'API monolitica `api/index.ts` o a `db/schema.ts`
  (lo schema dei documenti è già `documentType`-agnostico).
- Modifiche alla `HomePage` (resta esclusa da commit/push).
- Integrazione Stripe / pagamenti (fase 5, già consegnata).
- Generazione AI di immagini/logo (fase 4 v2, deferred).

**Intended audience**: AI/sviluppatore che implementa il refactor;
reviewer che verifica test e assenza di regressioni.

**Assumptions**:
- `src/utils/gridUtils.ts` espone funzioni pure corrette:
  `collides`, `wouldCollideOnMove`, `wouldCollideOnResize`, `canMove`,
  `canResize`, `clampMove`, `clampResize`, `stepMove`, `stepResize`
  (le ultime due aggiunte in Fase A).
- La suite test è verde (al momento della v2.0: **1022 test**) e
  `typecheck` è pulito.
- Esiste `createGiovanniCardTemplate()` come fixture realistica con tutti
  gli elementi popolati (foto, logo, nome, ruolo, azienda, contatti, QR,
  social) — usarla nei test come richiesto dall'utente.

## 2. Definitions

- **Card / Bigliettino**: documento `documentType='businessCard'` con
  `front`, `back`, `style`, `grid` (fronte), `backGrid` (retro).
- **Grid-mode**: modalità di rendering in cui gli elementi vengono
  posizionati via CSS Grid usando `grid`/`backGrid`, invece del layout
  flexbox (`centered`/`left`/`split`).
- **Flexbox-mode**: layout classico non-grid (i tre preset
  `centered`/`left`/`split` sul fronte; layout fisso sul retro).
- **Master switch griglia ("Griglia ON/OFF")**: il toggle in alto a
  destra nella preview (stato React `showGrid`). Dalla Fase E è il
  **controllo unico** che attiva/disattiva il grid-mode editabile **e**
  l'overlay delle linee guida (vedi REQ-E01). Quando OFF, gli elementi
  NON si possono spostare.
- **Linee guida (overlay)**: SVG di linee tratteggiate sovrapposto alla
  preview, visibile solo quando il master switch è ON.
- **Grid editor**: i controlli (select elemento + frecce + ridimensiona
  su desktop; select + popup frecce su mobile) per spostare/ridimensionare
  gli elementi quando il grid-mode è attivo.
- **`activeGrid`**: la griglia del lato attualmente in modifica
  (`card.grid` se fronte, `card.backGrid` se retro), con fallback al
  preset del lato se non ancora definita.
- **Init-from-layout**: derivazione della griglia iniziale a partire dal
  layout flexbox corrente, così che attivare il grid-mode NON sposti
  visivamente gli elementi (REQ-E03).
- **Clamp**: limitazione di una mossa/resize alla posizione valida più
  vicina (entro i bordi e senza collisione). All-or-nothing.
- **Clamp graduale (per-asse)** (`stepMove`/`stepResize`): applicazione
  separata del delta su X e Y (e su W e H), avanzando finché possibile
  invece di scartare l'intera mossa.
- **fontScale**: moltiplicatore globale della dimensione del testo della
  card (es. 0.8 = -20%, 1.2 = +20%), applicato come CSS variable.
- **qrSize**: dimensione del QR in flexbox-mode (small/medium/large). In
  grid-mode la dimensione deriva dalla cella della griglia.
- **Block label**: etichetta/heading editabile per una sezione/lista di
  elementi (es. heading "Servizi che offro" sopra la lista servizi).
- **Token Optimization Stack**: headroom (proxy HTTP che comprime i
  prompt verso l'LLM) + caveman (skill che comprime l'output). Vedi
  AGENTS.md §"Token Optimization Stack".

## 3. Requirements, Constraints & Guidelines

### 3.0 Stato di implementazione (leggere prima)

- **Fase A — FATTA** (commit `0fa88c1`, `d5bf3b6`, `0b3e68e`). Include:
  `useGrid` su `front`/`back`; routing front/back in `cardMerge`;
  `stepMove`/`stepResize`; fix collision check desktop (no più cast
  `bounds as CardGrid`); unificazione azione AI `fill`; attivazione
  `useGrid` su move/resize; select grid-editor filtrata per contenuto;
  `.card-back-val`/`.card-back-socials` (grid-mode) con `word-break`.
- **Revisione richiesta in Fase E**: il comportamento "move attiva
  useGrid automaticamente" e "useGrid indipendente da showGrid"
  introdotti in A02 vanno **modificati** secondo REQ-E01 (master switch).
  Non è una regressione: è un'evoluzione del modello su richiesta utente.
- **Fasi B, C, D, E, F, G, H, I, J, K — DA FARE.**

### Fase A — Griglia + AI (FATTA, riferimento)

- **REQ-A01** *(done)*: collision check desktop usa `activeGrid` reale.
- **REQ-A02** *(done, RIVISTO da REQ-E01)*: separazione grid-mode/overlay.
- **REQ-A03** *(done, esteso da REQ-E03)*: cambi layout/sizePreset in
  grid-mode non producono overflow.
- **REQ-A04** *(done)*: routing elementi retro→`backGrid`, fronte→`grid`.
- **REQ-A05** *(done)*: azione AI `fill` unificata desktop/mobile.
- **REQ-A06** *(done)*: clamp graduale per-asse (`stepMove`/`stepResize`).

### Fase B — Parità mobile

- **REQ-B01**: Ogni sezione del form editabile su desktop DEVE essere
  editabile su mobile: Fronte (nome/ruolo/azienda/layout), Retro
  (telefono/email/web/indirizzo/P.IVA), **Foto**, **Logo** (+ sfondo
  logo), **Servizi** (+ block label, vedi REQ-F02), **Social**, **Opzioni
  QR avanzate** (payload/label/**qrSize**), **Stile** (formato, bordo,
  colori sfondo/testo/accento, **font**, **fontScale**).
- **REQ-B02**: Le sezioni del form DEVONO essere estratte in componenti
  riutilizzabili in `src/components/card/` e renderizzate sia dal layout
  desktop 3-colonne sia dai tab mobile, **senza duplicazione del JSX**
  (oggi il form mobile e desktop sono due alberi JSX separati di ~600
  righe; il mobile omette quasi tutto).
- **REQ-B03**: Il grid editor mobile (`MobileGridEditor`) DEVE permettere
  di selezionare il lato (fronte/retro) come la versione desktop,
  mantenendo l'interazione a frecce + popup, e DEVE rispettare il master
  switch (REQ-E01) e mostrare solo elementi con contenuto (come desktop).
- **CON-B01**: Su mobile gli `input`/`select`/`textarea` mantengono
  `font-size: 16px` per evitare l'auto-zoom iOS.

### Fase C — Preview stabile

- **REQ-C01**: Lo zoom della preview NON DEVE causare overflow né
  sovrapposizione con la UI: lo spazio occupato deve scalare col fattore
  di zoom. Sostituire `transform: scale()` puro su `.card-previews` con
  una tecnica che riserva il layout (es. wrapper con `width`/`height`
  scalati, oppure `zoom` CSS con fallback, oppure scala via
  `font-size`/dimensioni del contenitore).
- **REQ-C02**: Il fattore di zoom di default DEVE adeguarsi al cambio di
  breakpoint mobile/desktop durante la sessione (non solo al primo
  render). Oggi `useCardPreviewZoom(isMobile ? 0.7 : 1)` usa l'initial
  una sola volta.
- **GUD-C01**: Mantenere `ZOOM_MIN`/`ZOOM_MAX` correnti; il testo deve
  restare leggibile a zoom minimo.

### Fase D — Stile (font family + dimensione)

- **REQ-D01**: La sezione Stile DEVE includere un selettore di
  `fontFamily` con set sicuro (`SAFE_FONT_FAMILIES`), riflesso in tempo
  reale nella preview e nell'export. Se la card ha un `fontFamily` fuori
  set (card importata), il selettore mostra l'opzione corrente come
  "Personalizzato" senza sovrascriverla.
- **REQ-D02**: I controlli colore (sfondo/testo/accento) DEVONO applicare
  il valore alla preview in tempo reale su entrambe le viste.
- **REQ-D03**: La selezione dell'elemento nel grid editor
  (`selectedGridElement`) DEVE persistere al cambio di tab/pannello e
  l'elemento selezionato DEVE essere evidenziato nella preview (outline
  accent).
- **REQ-D04** *(punto utente 6)*: La sezione Stile DEVE includere un
  controllo **dimensione testo** (`style.fontScale`, default `1`, range
  `0.7`–`1.5`, step `0.05`) con bottoni −/+ o slider, applicato come CSS
  variable `--card-font-scale` su tutto il testo della card (nomi,
  contatti, servizi, social, label) e replicato nell'export
  (`cardGenerator.ts`). L'AI DEVE poterlo impostare (vedi REQ-I01).

### Fase E — Modello griglia (master switch, QR, no-destroy)

- **REQ-E01** *(punto utente 4 — RIVEDE REQ-A02)*: Il toggle "Griglia
  ON/OFF" (`showGrid`) è il **master switch unico** del grid-mode:
  - Quando **OFF**: la preview renderizza in **flexbox-mode** su entrambi
    i lati (ignorando `useGrid`); l'overlay linee guida è nascosto; i
    controlli del grid editor (frecce, ridimensiona, select elemento)
    sono **disabilitati** (e visivamente in stato disabled). Gli elementi
    **non si possono spostare**.
  - Quando **ON**: la preview renderizza in **grid-mode** per ogni lato
    che ha elementi grid; l'overlay è visibile; i controlli sono attivi;
    move/resize applicano con collision-block + feedback (Fase G).
  - `useGrid` (persistito) viene impostato a `true` per il lato quando si
    attiva il master switch e si conferma il grid-mode; serve a far
    sopravvivere lo stato a reload/export. La sorgente di verità per il
    rendering è: `isGridMode = showGrid && hasGridElements(side)`.
  - **Nota di migrazione dalla Fase A**: rimuovere l'attivazione
    automatica di `useGrid` dentro `moveSelectedElement`/`resizeSelected
    Element` come *unica* condizione di rendering; il rendering ora
    dipende da `showGrid`. Le mosse restano gated su `showGrid===true`.
- **REQ-E02** *(punto utente 1 — QR ridimensionabile/spostabile)*:
  - In **grid-mode**, la dimensione renderizzata del QR DEVE derivare
    dalla cella che occupa (`grid.elements.qr.w × h`): ridimensionare la
    cella ridimensiona il QR visibile. Rimuovere il vincolo CSS fisso
    (`.card-back-qr-svg { width:120px }` / `.grid-mode … svg { width:72px }`)
    a favore di un dimensionamento proporzionale alla cella (mantenendo
    aspect-ratio quadrato e un minimo leggibile ~44px).
  - In **flexbox-mode**, aggiungere il controllo `back.qrSize`
    (`'small' | 'medium' | 'large'`, default `'medium'`) nelle "Opzioni QR
    avanzate"; mappa a dimensioni px (es. small 84, medium 120, large 160)
    in preview ed export.
  - Il QR DEVE poter essere spostato a destra/sinistra/su/giù nei limiti
    della griglia (già supportato dalla logica; assicurare che con grid
    4×4 e celle 1×N il QR abbia posizioni libere — vedi REQ-E04).
- **REQ-E03** *(punto utente 3 — non distruggere tutto)*: Attivare il
  grid-mode (master switch ON) su un lato che non ha ancora una grid DEVE
  **inizializzare la griglia dal layout corrente** (init-from-layout), in
  modo che gli elementi restino visivamente dov'erano. Spostare **un**
  elemento NON deve riposizionare gli altri. Vietato far "saltare" l'intera
  card a un preset generico (`gridPresetLeft`) quando l'utente tocca un
  solo elemento: questo è il bug "distrugge tutto" causato dal fallback
  introdotto in Fase A (`activeGrid = card.grid ?? gridPresetLeft()` +
  persistenza dell'intero preset alla prima mossa).
  - Implementazione: derivare la grid iniziale mappando il layout flexbox
    corrente (`front.layout`) a uno dei preset esistenti
    (`left`→`gridPresetLeft`, `centered`→`gridPresetCentered`,
    `split`→`gridPresetSplit`) **e** filtrando gli elementi a quelli con
    contenuto. Per il retro usare `gridPresetBackDefault`. Persistere
    questa grid una sola volta al passaggio OFF→ON.
- **REQ-E04**: La granularità della griglia DEVE permettere uno
  spostamento "fine" del QR e degli altri elementi. Mantenere il default
  4×4, ma consentire all'utente (e all'AI) di aumentare `cols`/`rows`
  della griglia attiva (range 2–8, già nello schema AI) tramite controllo
  UI "Griglia fine" o bottoni +/− su cols/rows. Spostare il QR di una
  cella su una griglia 6×6 dà passi più piccoli.
- **REQ-E05** *(punto utente 3 — blocchi)*: Ogni mossa/resize (manuale e
  AI) DEVE rispettare i blocchi di collisione/bordo già implementati
  (`clampMove`/`clampResize`/`stepMove`/`stepResize`). Nessuna operazione
  può produrre sovrapposizioni o elementi fuori dai bordi. Vedi anche
  Fase G per il feedback quando un'azione è bloccata.

### Fase F — Testo: wrapping, label, leggibilità

- **REQ-F01** *(punto utente 2 — tutto va a capo)*: TUTTI i campi testuali
  della card (nome, ruolo, azienda, contatti, servizi, social, label QR,
  wordmark) DEVONO andare a capo invece di essere troncati con "…". Usare
  `overflow-wrap: break-word; word-break: break-word;` e rimuovere
  `white-space: nowrap` + `text-overflow: ellipsis` ovunque presenti
  (residui noti: `.card-back-socials` flexbox riga ~1549, eventuali altri).
  Già fatto in Fase A: `.card-back-val` e `.card-back-socials` (grid-mode).
- **REQ-F02** *(punto utente 2 — label per elementi aggiunti)*: Le liste
  di elementi aggiungibili DEVONO supportare una **block label** editabile:
  - `back.servicesLabel` (`string`, default `'Servizi'`, max 40): heading
    mostrato sopra la lista servizi nel retro. Editabile nel form
    (desktop + mobile). Se vuoto, nessun heading.
  - Predisporre il pattern per future liste (es. `back.socialsLabel`,
    default `''` opzionale). Implementare almeno `servicesLabel`.
  - I singoli item servizio restano stringhe (`back.services: string[]`),
    ma DEVONO andare a capo (REQ-F01) ed essere coerenti con `fontScale`.
- **REQ-F03** *(punto utente 2 — auto-riduzione carattere)*: Per i blocchi
  di testo lungo, oltre al wrap, prevedere un comportamento di leggibilità:
  quando un valore supera una soglia di lunghezza, ridurre leggermente la
  dimensione del font di quel blocco (via classe CSS condizionale o
  `clamp()`), così che email/servizi lunghi restino su poche righe.
  Mantenere comunque il wrap come fallback. Non deve sovrascrivere
  `fontScale` globale ma combinarsi con esso.

### Fase G — Feedback (popup/toast)

- **REQ-G01** *(punto utente 5 — feedback su modifiche/errori)*: Ogni
  azione utente rilevante nel grid editor DEVE produrre feedback via toast
  (`useToast`), in particolare:
  - Mossa/resize **applicata**: toast `success`/`info` breve (es.
    "Spostato QR a destra").
  - Mossa/resize **bloccata** (collisione o bordo): toast `info`/`warning`
    (es. "Bloccato: collisione con Social" / "Bloccato: bordo della
    griglia"). Oggi il blocco è silenzioso.
  - Attivazione/disattivazione master switch: toast (es. "Griglia attiva —
    ora puoi spostare gli elementi" / "Griglia disattivata").
  - Cambi che disattivano il grid-mode (layout/sizePreset): toast già
    presente (Fase A) — mantenere.
- **REQ-G02**: Le azioni AI già loggano nel pannello AI
  (`AILogPanel`/`useAICard`). Aggiungere un toast riepilogo a fine
  esecuzione AI (già presente in `runCardAI`) e assicurare che gli errori
  AI (`error:empty`, `error:not_json`, `error:invalid_card`) producano un
  toast comprensibile (non solo log). Vedi REQ-I03.
- **GUD-G01**: I toast devono essere brevi, non bloccanti, e non
  sovrapporsi tra loro in modo illeggibile (rispettare il `useToast`
  esistente, durate ~3–5s).

### Fase H — (riservata; vedi Fase D REQ-D04 per la dimensione font)

> La dimensione del font (punto utente 6) è specificata in **REQ-D04**.
> Questa lettera resta come segnaposto per non rinumerare le fasi.

### Fase I — Parità AI ("anche l'AI deve poterlo fare") + harness

- **REQ-I01** *(punto utente 7)*: L'AI DEVE poter applicare TUTTE le nuove
  capacità utente. Aggiornare:
  - `aiCardInputSchema` (`src/ai/aiCardInputSchema.ts`): aggiungere
    `back.services` (array string), `back.servicesLabel`, `back.qrSize`,
    `style.fontScale`, e l'elemento **`logo`** in `grid.elements`
    (oggi MANCANTE: l'AI non può posizionare il logo via questo schema,
    incoerenza con `cardMerge` che lo gestisce). Allineare l'enum
    `front.layout`/`borderStyle`/`sizePreset` (già presenti).
  - `cardSystem.ts` (system prompt): documentare i nuovi campi
    (`services`, `servicesLabel`, `qrSize`, `fontScale`, elemento `logo`
    nel grid), con esempi ("rimpicciolisci il QR" → riduci
    `grid.elements.qr.w/h` o `back.qrSize='small'`; "testo più grande" →
    `style.fontScale=1.2`; "intitola i servizi" → `back.servicesLabel`).
  - `cardMerge.ts`: gestire merge di `services`, `servicesLabel`,
    `qrSize`, `fontScale` con le stesse protezioni anti-hallucination e
    `shouldUpdateString`/clamp range (`fontScale` clampato a 0.7–1.5).
- **REQ-I02**: L'harness AI (test) DEVE coprire le nuove capacità:
  - `cardMerge.test.ts`: merge di `qrSize`, `fontScale` (clamp range),
    `servicesLabel`, `services`; posizionamento `logo` via grid; il
    clamp graduale per QR resize/move sul `backGrid`.
  - `aiCardInputSchema` test (nuovo o esistente): i nuovi campi passano la
    validazione; i campi inventati vengono strippati.
  - Un test "AI end-to-end simulato" che parte dal template Giovanni,
    invia un JSON AI realistico (es. "rendi premium + rimpicciolisci QR +
    font più grande") e verifica il risultato mergiato (mock del provider,
    nessuna chiamata di rete).
- **REQ-I03**: Gli errori e i successi dell'AI DEVONO essere riportati
  all'utente con feedback (toast + log), inclusi i casi `error:empty`
  (risposta vuota), `error:not_json`, `error:invalid_card`. L'utente non
  deve mai restare senza riscontro dopo un'azione AI (collegamento a
  REQ-G02). Verificare/estendere il retry su risposta vuota già presente.
- **CON-I01**: Nessun nuovo endpoint AI. Riuso di `CardAIOrchestrator`,
  provider DeepSeek esistente, flusso `processPrompt`. Il merge resta
  l'unico punto che applica modifiche al dominio.

### Fase J — Documentazione

- **REQ-J01** *(punto utente 8)*: Aggiornare `AGENTS.md`:
  - Sezione "Business Card Module": riflettere il nuovo modello grid
    (master switch, init-from-layout, QR sizing, fontScale, servicesLabel,
    text wrap), e la parità mobile.
  - Sezione "Known Issues — Card Module": chiudere le voci risolte
    (collision desktop, grid mode, AI routing, email troncata, QR size,
    feedback) e aggiornare quelle aperte.
  - Sezione "Token Optimization Stack" e "Quick Commands": documentare il
    nuovo `npm run dev` (vedi Fase K).
  - Sezione "Active Skills"/"Key Files": aggiungere i componenti estratti
    `src/components/card/*` e le nuove proprietà schema.
- **REQ-J02** *(punto utente 8)*: Aggiornare/creare `README.md` con: setup,
  comandi (`npm run dev`, `npm run agent`, test, build), descrizione del
  modulo bigliettino aggiornata, e nota sullo stack token-saving.
- **REQ-J03**: Aggiornare il `last_updated` di questa spec e la tabella
  "Phase Status & Roadmap" in `AGENTS.md` per Fase 2.2.

### Fase K — DX: headroom + caveman di default con `npm run dev`

- **REQ-K01** *(punto utente 9)*: `npm run dev` DEVE, oltre ad avviare
  Vite, **avviare lo stack di risparmio token** in modo best-effort:
  - Avviare il proxy **headroom** se non già attivo (riuso della logica di
    `scripts/start-agent.mjs`: `cmdProxy`/`isProxyUp`/`startProxy`),
    persistente, log in `.headroom.log`.
  - Aprire la dashboard headroom nel browser **solo in dev**
    (`openBrowserInDev`, già esistente).
  - Avviare Vite (`vite`) in parallelo, con output in foreground.
  - **Degradare con grazia**: se `headroom` non è installato o non parte,
    stampare un warning chiaro (con istruzioni
    `pip install "headroom-ai[all]"`) e **continuare comunque** con Vite.
    Il dev server non deve mai fallire per colpa di headroom.
  - **caveman**: è una skill auto-caricata (`.agents/skills/caveman/`),
    non un processo; non c'è nulla da "avviare". Documentare in
    `AGENTS.md`/`README` che è attiva di default e stampare nel banner di
    `npm run dev` una riga informativa ("caveman: output compresso attivo
    via skill"). Non tentare di lanciarla come processo.
- **REQ-K02**: Implementare un wrapper Node `scripts/dev.mjs` che orchestra
  i due processi (no nuove dipendenze npm: usare `child_process`).
  `package.json`: `"dev": "node scripts/dev.mjs"` e mantenere
  `"dev:app": "vite"` come fallback senza headroom.
- **CON-K01**: Non introdurre dipendenze pesanti (no `concurrently`); usare
  `node:child_process`. Il proxy headroom NON deve bloccare l'avvio di
  Vite (avviarlo async/non-bloccante).
- **CON-K02**: Il comportamento headroom riguarda l'**agente AI di
  sviluppo** (opencode), non l'app: il proxy comprime i prompt
  dell'agente. `npm run dev` lo attiva per comodità del developer; l'app
  React non passa per il proxy.

### Vincoli architetturali e di processo (tutte le fasi)

- **CON-001**: Generazione PDF/PNG/SVG resta **client-side**. Nessuna
  chiamata di rete aggiuntiva, nessun nuovo endpoint.
- **CON-002**: `api/index.ts` (serverless monolitica) e `db/schema.ts`
  restano **invariati**.
- **CON-003**: L'AI riusa il flusso esistente (`CardAIOrchestrator`,
  provider DeepSeek, nessun tool).
- **CON-004**: **Nessun push automatico.** Commit separati per fase.
- **CON-005**: Aggiunte allo schema (`fontScale`, `qrSize`,
  `servicesLabel`, `useGrid`, ecc.) DEVONO avere `default`
  retro-compatibili così da non invalidare card salvate (le card prive
  del campo devono validare con il default). Aggiornare anche
  `createEmptyCard()`/`createGiovanniCardTemplate()`.
- **SEC-001**: Upload immagini mantiene controlli esistenti (MIME
  allowlist PNG/JPEG/SVG, limite 5MB, compressione canvas, PNG per il
  logo per la trasparenza).
- **SEC-002**: `cardMerge` mantiene la sanitizzazione Zod
  (`businessCardSchema.partial()`) e la protezione anti-hallucination; non
  sovrascrive mai `photoUrl`/`logoUrl`; clampa i valori numerici
  (`fontScale`, grid) ai range validi.
- **SEC-003**: `servicesLabel` e gli altri testi liberi vanno trattati
  come testo (no HTML injection): in preview sono renderizzati come text
  node React (già sicuro); nell'export SVG vanno escapati come gli altri
  campi (`cardGenerator` usa già escaping XML — riusarlo).
- **PAT-001**: Clean code — single responsibility per componente, funzioni
  pure dove possibile, niente prop-drilling superfluo, **niente
  `as unknown as`** per aggirare i tipi.
- **PAT-002**: Vercel/React best practices — `React.memo` sui componenti
  preview pesanti, `useCallback`/`useMemo` per handler e valori derivati,
  **conditional render** (non CSS hide) per evitare DOM duplicato
  desktop/mobile, componenti estratti riutilizzati da entrambe le viste.
- **GUD-PROC-01**: Prima di ogni commit: `npm run typecheck` +
  `npm run test` verdi. Ogni modifica a produzione accompagnata da test
  (nuovo codice → nuovi test; bug fix → regression test).

## 4. Interfaces & Data Contracts

### 4.1 Schema dominio (`src/utils/documentSchemas.ts`) — aggiunte v2

```ts
// front (già aggiunto in Fase A): useGrid
front: z.object({
  // ...campi esistenti
  useGrid: z.boolean().default(false),
}),

back: z.object({
  // ...campi esistenti: phone,email,website,address,vatNumber,
  //                     services, socials, qrPayload, qrLabel, useGrid
  services: z.array(z.string().max(80)).max(8).default([]),   // esistente
  servicesLabel: z.string().max(40).default('Servizi'),       // NEW (REQ-F02)
  qrSize: z.enum(['small', 'medium', 'large']).default('medium'), // NEW (REQ-E02)
  useGrid: z.boolean().default(false),                        // (Fase A)
}),

style: z.object({
  // ...campi esistenti: sizePreset,bgColor,textColor,accentColor,
  //                     fontFamily, borderStyle
  fontScale: z.number().min(0.7).max(1.5).default(1),         // NEW (REQ-D04)
}),

// Set font sicuri per il selettore UI (REQ-D01). Stringa libera mantenuta
// nello schema per retro-compat (card importate con altri font).
export const SAFE_FONT_FAMILIES = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
  'Poppins', 'Georgia', 'Times New Roman', 'Courier New',
] as const;

// Mappa qrSize → px in flexbox-mode (REQ-E02)
export const QR_SIZE_PX = { small: 84, medium: 120, large: 160 } as const;
```

> Tutte le aggiunte hanno `.default(...)` ⇒ retro-compatibili (CON-005).
> Aggiornare `createEmptyCard()` e `createGiovanniCardTemplate()` per
> includere i nuovi campi con valori sensati
> (`servicesLabel:'Servizi'`, `qrSize:'medium'`, `fontScale:1`).

### 4.2 Schema AI (`src/ai/aiCardInputSchema.ts`) — allineamento (REQ-I01)

```ts
back: z.object({
  // ...esistenti
  services: z.array(z.string()).optional(),        // NEW
  servicesLabel: z.string().optional(),            // NEW
  qrSize: z.enum(['small','medium','large']).optional(), // NEW
}).optional(),

style: z.object({
  // ...esistenti
  fontScale: z.number().optional(),                // NEW (merge clampa 0.7–1.5)
}).optional(),

grid: z.object({
  cols: z.number().min(2).max(8).optional(),
  rows: z.number().min(2).max(8).optional(),
  elements: z.object({
    photo, name, title, company,
    logo:    rect.optional(),   // NEW — oggi MANCANTE (REQ-I01)
    qr, contacts, socials,
  }).optional(),
}).optional(),
// dove rect = z.object({ x:number, y:number, w:number, h:number })
```

### 4.3 Componenti estratti (`src/components/card/`) — REQ-B02

```ts
interface CardSectionProps {
  card: BusinessCard;
  patchFront: (p: Partial<BusinessCard['front']>) => void;
  patchBack:  (p: Partial<BusinessCard['back']>)  => void;
  patchStyle: (p: Partial<BusinessCard['style']>) => void;
}

function CardFrontFields(p: CardSectionProps): JSX.Element;     // nome, ruolo, azienda, layout
function CardMediaFields(p: CardSectionProps & {                // foto, logo, sfondo logo
  onUpload: (f: File, field: 'photoUrl' | 'logoUrl') => void;
  onRemovePhoto: () => void; onRemoveLogo: () => void;
  uploadError: string | null;
}): JSX.Element;
function CardBackFields(p: CardSectionProps): JSX.Element;       // telefono, email, web, indirizzo, p.iva
function CardServicesFields(p: CardSectionProps): JSX.Element;   // servicesLabel + lista (max 8)
function CardSocialsFields(p: CardSectionProps): JSX.Element;    // social CRUD
function CardQrAdvanced(p: CardSectionProps): JSX.Element;       // payload + label + qrSize
function CardStyleFields(p: CardSectionProps): JSX.Element;      // formato, bordo, colori, font, fontScale
function CardGridControls(p: {                                   // selettore lato + select + frecce + resize + cols/rows
  card: BusinessCard;
  side: 'front' | 'back';
  gridEnabled: boolean;                 // = showGrid (master switch)
  onSideChange: (s: 'front' | 'back') => void;
  selected: keyof CardGrid['elements'] | '';
  onSelect: (k: keyof CardGrid['elements'] | '') => void;
  availableElements: Array<{ value: keyof CardGrid['elements']; label: string }>;
  onMove:  (dx: number, dy: number) => void;
  onResize:(dw: number, dh: number) => void;
  onApplyPreset: (p: 'left' | 'centered' | 'split') => void;
  onSetGridSize?: (cols: number, rows: number) => void; // REQ-E04 (opz.)
}): JSX.Element;
```

> Sia il layout desktop 3-colonne sia i tab mobile importano e
> renderizzano questi componenti. Zero duplicazione di JSX (REQ-B02).

### 4.4 cardMerge — instradamento + nuovi campi

```ts
const FRONT_KEYS = ['photo','name','title','company','logo'] as const;
const BACK_KEYS  = ['contacts','qr','socials'] as const; // routing già fatto (A04)

// Merge nuovi campi (REQ-I01), con protezioni esistenti:
// - back.services: sostituisci se array non vuoto e diverso
// - back.servicesLabel: shouldUpdateString
// - back.qrSize: enum valido → assegna
// - style.fontScale: number → clamp(0.7, 1.5)
```

### 4.5 CSS — variabili e regole chiave

```css
/* REQ-D04: scala font globale */
.card-preview-side { font-size: calc(1rem * var(--card-font-scale, 1)); }
/* applicare --card-font-scale come inline style dal componente:
   style={{ '--card-font-scale': card.style.fontScale }} */

/* REQ-F01: wrapping ovunque (rimuovere nowrap/ellipsis residui) */
.card-back-val, .card-back-socials, .card-back-services li,
.card-name, .card-title, .card-company {
  overflow-wrap: break-word; word-break: break-word;
  white-space: normal; text-overflow: clip;
}

/* REQ-E02: QR dimensionato dalla cella in grid-mode */
.card-preview-side.grid-mode .card-back-qr-svg,
.card-preview-side.grid-mode .card-back-qr-svg svg {
  width: 100%; height: 100%; max-width: 100%; aspect-ratio: 1 / 1;
}
/* flexbox-mode: dimensione da qrSize via classe o inline var */
.card-back-qr-svg { width: var(--card-qr-size, 120px); height: var(--card-qr-size, 120px); }
```

## 5. Acceptance Criteria

- **AC-B01**: Given la vista mobile (`max-width:900px`) nel tab
  "Modifica", Then sono presenti e funzionanti i controlli per foto, logo
  (+sfondo), servizi (+label), social, opzioni QR (incl. qrSize) e Stile
  (formato, bordo, colori, font, fontScale).
- **AC-B02**: Given `MobileGridEditor`, When seleziono "Fronte"/"Retro",
  Then la select elemento mostra solo gli elementi con contenuto del lato
  scelto e posso spostarli/ridimensionarli (rispettando il master switch).
- **AC-B03**: The system shall renderizzare le sezioni del form da un
  unico set di componenti (`src/components/card/*`): nessun blocco JSX di
  form duplicato tra desktop e mobile (verifica statica + test di render).
- **AC-C01**: Given la preview a zoom 150%, Then nessuna sovrapposizione
  con i controlli adiacenti né overflow orizzontale; lo spazio riservato
  cresce con lo zoom.
- **AC-C02**: Given una sessione su desktop, When la finestra scende sotto
  900px, Then il fattore di zoom di default si adegua (mobile 0.7).
- **AC-D01**: Given la sezione Stile, When cambio il font, Then la preview
  aggiorna `font-family` in tempo reale; un `fontFamily` fuori set appare
  come "Personalizzato" senza essere sovrascritto.
- **AC-D04**: Given il controllo dimensione testo, When porto `fontScale`
  a 1.2, Then tutto il testo della card cresce del 20% in preview e
  nell'export, senza rompere il layout (wrap attivo).
- **AC-E01a**: Given master switch OFF, Then la preview è in flexbox-mode,
  i controlli grid sono disabilitati e gli elementi non si muovono.
- **AC-E01b**: Given master switch ON, When sposto un elemento, Then la
  preview (grid-mode) riflette lo spostamento e l'overlay è visibile.
- **AC-E02a**: Given master switch ON e QR selezionato, When riduco la
  larghezza/altezza della cella QR, Then il QR renderizzato rimpicciolisce.
- **AC-E02b**: Given flexbox-mode, When imposto `qrSize='small'`, Then il
  QR in preview/export usa la dimensione small (~84px).
- **AC-E03**: Given una card in layout 'split' senza grid, When attivo il
  master switch, Then gli elementi restano nelle stesse posizioni visive
  (init-from-layout) e NON saltano a un preset generico; spostando un
  elemento gli altri restano fermi.
- **AC-E04**: Given la griglia 4×4, When aumento a 6×6, Then il QR si
  sposta a passi più piccoli (1/6 invece di 1/4 di larghezza).
- **AC-E05**: Given due elementi adiacenti, When provo a sovrapporli, Then
  l'azione è bloccata (nessuna sovrapposizione) e il bottone è disabilitato
  o la mossa non avviene.
- **AC-F01**: Given un'email/servizio molto lungo, Then il testo va a capo
  (più righe) e NON viene troncato con "…", su entrambi i lati e in
  grid/flexbox-mode.
- **AC-F02**: Given la sezione Servizi, When imposto la label "Servizi che
  offro", Then il retro mostra quel heading sopra la lista servizi (in
  preview ed export).
- **AC-G01**: Given master switch ON e una mossa bloccata da collisione,
  When clicco la freccia (se abilitata) o l'azione viene bloccata, Then
  appare un toast che spiega il blocco ("collisione"/"bordo").
- **AC-G02**: Given un'azione AI, When termina (successo o errore), Then
  l'utente vede un toast riepilogativo coerente col log AI.
- **AC-I01**: Given un input AI con `style.fontScale=1.3`,
  `back.qrSize='small'`, `back.servicesLabel='I miei servizi'` e
  `grid.elements.logo`, When `cardMerge` lo elabora, Then i campi sono
  applicati (fontScale clampato a [0.7,1.5]) e il logo è posizionato.
- **AC-I03**: Given una risposta AI vuota/non-JSON, Then l'utente vede un
  toast d'errore comprensibile (non solo un log silenzioso).
- **AC-J01**: `AGENTS.md` e `README.md` riflettono il nuovo modello grid,
  i nuovi campi, la parità mobile e il nuovo `npm run dev`.
- **AC-K01**: Given `headroom` installato, When eseguo `npm run dev`, Then
  il proxy headroom è attivo (`/livez` 200), la dashboard si apre in dev,
  e Vite parte. Given `headroom` NON installato, When eseguo `npm run
  dev`, Then appare un warning e Vite parte comunque.

## 6. Test Automation Strategy

- **Test Levels**: Unit (utility/merge/schema), Component (RTL), nessun
  E2E. Per `scripts/dev.mjs` un test unit del wrapper (mock di
  `child_process`/`isProxyUp`) che verifica il degrado con grazia.
- **Frameworks**: Vitest + React Testing Library + jsdom.
- **Test Data**: usare **`createGiovanniCardTemplate()`** come fixture
  primaria per i test grid (richiesta esplicita utente): spostare e
  ridimensionare ogni elemento (photo/name/title/company/logo,
  contacts/qr/socials) e verificarne l'esito (mossa applicata o bloccata,
  preview in grid-mode). Pattern già introdotto in Fase A — estenderlo a
  B/E.
- **Nuovi test obbligatori per fase**:
  - **B**: `CardEditor.test.tsx` (mobile) — presenza/funzionamento di
    foto, logo, servizi(+label), social, QR(+qrSize), Stile(font,
    fontScale) nel tab Modifica mobile; `MobileGridEditor.test.tsx` —
    selettore lato + filtro per contenuto + gating master switch.
  - **C**: `useCardPreviewZoom.test.ts` — reattività breakpoint; test
    CSS/render che lo zoom non causa overflow (verifica stile contenitore).
  - **D**: `CardPreview.test.tsx` — `fontFamily` e `fontScale` applicati;
    `CardStyleFields` render + patch.
  - **E**: `CardEditor.test.tsx` — master switch OFF disabilita i controlli
    e mantiene flexbox; ON abilita e renderizza grid; init-from-layout (no
    "salto"); QR resize cambia dimensione; cols/rows fine; collision block.
    `cardGenerator` — export rispetta qrSize/fontScale.
  - **F**: `CardPreview.test.tsx` — wrap di email/servizi lunghi (no
    ellipsis); `servicesLabel` mostrato; auto-shrink classe applicata.
  - **G**: `CardEditor.test.tsx` — toast su mossa applicata/bloccata e su
    master switch (mock `useToast`, assert su `addToast`).
  - **I**: `cardMerge.test.ts` — merge `qrSize`/`fontScale`(clamp)/
    `servicesLabel`/`services`/`logo` grid; schema AI accetta i nuovi
    campi e strippa gli inventati; test AI simulato end-to-end (mock
    provider).
  - **K**: `scripts/__tests__/dev.test.mjs` (o equivalente) — wrapper
    degrada con grazia se headroom assente; non blocca Vite.
- **CI/CD**: `npm run typecheck` + `npm run test` verdi prima di ogni
  commit/push.
- **Coverage**: ≥60% sui nuovi file estratti; nessun `.skip`.

## 7. Rationale & Context

- **REQ-E01 (punto 4)**: l'utente vuole un modello mentale semplice — un
  unico interruttore "Griglia ON/OFF" che decide se può spostare le cose.
  La separazione introdotta in A02 (utile per il bug "i cambi non si
  vedono") va consolidata: ora il master switch governa rendering, overlay
  e abilitazione controlli insieme.
- **REQ-E02 (punto 1)**: il QR non si può rimpicciolire perché la sua
  dimensione è fissata in CSS (`width:120px`/`72px`), indipendente dalla
  cella grid. Va legata alla cella (grid-mode) e a `qrSize` (flexbox).
- **REQ-E03 (punto 3)**: alla prima mossa la Fase A persiste l'intero
  `gridPresetLeft` come `card.grid`, facendo "saltare" la card dal layout
  'split' al preset 'left' → l'utente percepisce "distrugge tutto".
  L'init-from-layout deriva la grid dal layout corrente così nulla salta.
- **REQ-F01/F02/F03 (punto 2)**: email/servizi lunghi vengono troncati con
  "…" (residui `white-space:nowrap`+`text-overflow:ellipsis`). I contatti
  e i servizi sono dati essenziali: devono andare a capo. L'utente vuole
  anche dare un titolo ai blocchi (es. "Servizi che offro") e un carattere
  che si adatti (auto-shrink + fontScale).
- **REQ-G01 (punto 5)**: i blocchi di collisione/bordo sono silenziosi →
  l'utente non capisce perché "non succede nulla". Servono toast.
- **REQ-D04 (punto 6)**: manca un controllo dimensione testo; lo schema ha
  solo `fontFamily`. Aggiungere `fontScale` globale.
- **REQ-I01/I02/I03 (punto 7)**: l'AI deve poter fare tutto ciò che fa
  l'utente. Oggi `aiCardInputSchema` non include nemmeno `logo` nel grid e
  ignora i nuovi campi. L'harness va esteso con test che partono dal
  template Giovanni.
- **REQ-J/K (punti 8,9)**: docs da allineare; `npm run dev` deve attivare
  lo stack di risparmio token (headroom proxy + caveman skill) di default,
  degradando con grazia se headroom non è installato.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: DeepSeek Chat API — solo via `CardAIOrchestrator`
  esistente; nessuna nuova integrazione.
- **EXT-002**: headroom (`headroom-ai`, CLI Python ≥3.10) — proxy locale
  `:8787`, opzionale, best-effort in `npm run dev`. Degradare se assente.

### Third-Party Services
- **SVC-001**: Nessun nuovo servizio runtime. Export/rendering client-side.

### Infrastructure Dependencies
- **INF-001**: Vercel Hobby — funzione serverless monolitica invariata.

### Data Dependencies
- **DAT-001**: localStorage/Neon via `dataService.saveDocument`; le card
  serializzate devono restare valide con i nuovi default (CON-005).

### Technology Platform Dependencies
- **PLT-001**: React 18 + Vite 5; Vitest + RTL + jsdom; Canvas API per
  export; Node ≥18 per gli script DX.

### Compliance Dependencies
- **COM-001**: Watermark tier-free (fase 5) preservato in preview ed
  export; il refactor non deve rimuoverlo. `fontScale`/`qrSize` non devono
  permettere di nascondere il watermark.

## 9. Examples & Edge Cases

```ts
// REQ-E03 — init-from-layout (pseudo)
function deriveGridFromLayout(card, side): CardGrid {
  if (side === 'back') return filterByContent(gridPresetBackDefault(), card, 'back');
  const preset = card.front.layout === 'centered' ? gridPresetCentered()
               : card.front.layout === 'split'    ? gridPresetSplit()
               : gridPresetLeft();
  return filterByContent(preset, card, 'front'); // rimuove elementi senza contenuto
}

// REQ-E02 — QR size in grid deriva dalla cella; in flexbox da qrSize
const qrPx = isGridMode ? '100%' : QR_SIZE_PX[card.back.qrSize];

// REQ-D04 — fontScale come CSS var, clampata
const fontScale = Math.min(1.5, Math.max(0.7, card.style.fontScale ?? 1));
<div className="card-preview-side" style={{ ['--card-font-scale']: fontScale }} />

// REQ-I01 — merge fontScale con clamp
if (typeof s.fontScale === 'number') {
  updated.style.fontScale = Math.min(1.5, Math.max(0.7, s.fontScale));
  changes.push(`Stile: dimensione testo → ${updated.style.fontScale}`);
}
```

**Edge cases**:
- Card vecchie senza `fontScale`/`qrSize`/`servicesLabel`: i default le
  rendono valide (CON-005). `createEmptyCard` aggiornato.
- Master switch ON con un lato senza alcun elemento con contenuto: nessun
  grid-mode per quel lato (resta flexbox), controlli disabilitati per quel
  lato. Nessun crash.
- `fontScale` fuori range da AI: clampato a [0.7,1.5].
- QR a `qrSize='large'` su card piccola (square 65×65): non deve uscire
  dai bordi della card (cap via CSS `max-width:100%`).
- Servizio lungo (80 char): va a capo, font auto-ridotto, non rompe la
  card.
- `headroom` non installato: `npm run dev` stampa warning e avvia solo
  Vite (AC-K01).
- AI invia `grid.elements.logo`: ora accettato (prima strippato).

## 10. Validation Criteria

- Tutti gli Acceptance Criteria (AC-B01…AC-K01) coperti da test verdi.
- `npm run typecheck` pulito; `npm run test` verde (≥ 1022 test attuali +
  nuovi; nessun `.skip`).
- Nessuna modifica a `api/index.ts`, `db/schema.ts`, `vercel.json`,
  `HomePage`.
- Nessun `as unknown as` nel grid editor; nessuna duplicazione di JSX del
  form tra desktop e mobile (componenti `src/components/card/*` condivisi).
- Watermark tier-free presente in preview ed export.
- `npm run dev` avvia headroom (se presente) + Vite, degradando con grazia.
- `AGENTS.md` e `README.md` aggiornati.
- Commit separati per fase (B, C, D, E, F, G, I, J, K); nessun push
  automatico.

## 11. Related Specifications / Further Reading

- `spec/spec-design-phase2-business-card.md` — spec originale Bigliettino.
- `spec/spec-data-phase5-tier-system.md` — watermark e tier (COM-001).
- `AGENTS.md` — sezioni "Business Card Module", "Responsive Patterns",
  "Token Optimization Stack", "Test — OBBLIGATORI", "Pre-push Checklist",
  "Known Issues — Card Module", "Git Guardrails".
- `scripts/start-agent.mjs` — sorgente riusabile per il proxy headroom
  (REQ-K01): `isProxyUp`, `startProxy`, `waitForProxy`, `openBrowserInDev`.
- `.agents/skills/caveman/SKILL.md` — regole della skill di compressione
  output (REQ-K01).
- `.agents/skills/vercel-react-best-practices/SKILL.md` — PAT-002.
- `.agents/skills/vercel-composition-patterns/SKILL.md` — estrazione
  componenti condivisi (REQ-B02).

## 12. Implementation Order (suggerito per l'AI esecutrice)

1. **Schema** (§4.1/4.2): aggiungere `fontScale`, `qrSize`,
   `servicesLabel`, allineare `aiCardInputSchema` (+`logo`), aggiornare
   factory e default. Test schema/migration.
2. **Fase F** (testo/wrap/label): CSS + `servicesLabel` UI + preview/export.
3. **Fase D/REQ-D04** (font family + fontScale): UI Stile + CSS var + export.
4. **Fase E** (master switch + init-from-layout + QR sizing + cols/rows):
   il cuore del refactor griglia; coordinare con Preview e CSS.
5. **Fase G** (feedback toast) — si appoggia a E.
6. **Fase B** (estrazione componenti + parità mobile) — usa i campi di
   F/D/E già pronti.
7. **Fase C** (zoom stabile).
8. **Fase I** (AI: prompt + merge + harness/test).
9. **Fase K** (`scripts/dev.mjs` + `package.json`).
10. **Fase J** (AGENTS.md + README) — per ultima, riflette tutto.

Ogni step: implementazione + test + `typecheck`/`test` verdi + commit
dedicato (messaggio `phase 2.2 (X): ...`). Nessun push.
</content>
