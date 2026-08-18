---
name: Quickbrand
description: Suite branding per piccole attività — un brief, un kit completo
colors:
  accent: "#E62020"
  accent-dark: "#FF3B3B"
  accent-soft: "#FCE8E8"
  accent-softer: "#FFF1F1"
  sidebar: "#082033"
  canvas: "#F6F8FC"
  ink: "#07111f"
  ink-alt: "#1a1a1a"
  ink-sec: "#344054"
  muted: "#647086"
  muted-alt: "#8892a8"
  muted-lt: "#94a3b8"
  sidebar-muted: "#8896ab"
  sidebar-text: "#a4b3cc"
  sidebar-hover: "#cfe0f2"
  sidebar-label: "#5a6b82"
  line: "#c8d0df"
  line-lt: "#f1f5f9"
  surface: "#ffffff"
  surface-sun: "#f8fafc"
  surface-hov: "#f1f5f9"
  success: "#11845b"
  success-alt: "#16a34a"
  success-bright: "#22c55e"
  warning: "#a66200"
  warning-amt: "#f59e0b"
  warning-dk: "#d97706"
  danger: "#dc2626"
  info-text: "#7A1414"
  info-link: "#1e4a7a"
  info-link-bg: "#f0f7ff"
  doc-accent: "#01696F"
  doc-accent-alt: "#0d9488"
  badge-purple: "#6D3FD1"
typography:
  display:
    fontFamily: "'Outfit', 'Inter', ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.055em"
  headline:
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.68rem"
    fontWeight: 800
    letterSpacing: "0.1em"
  mono:
    fontFamily: "'JetBrains Mono', 'Roboto Mono', ui-monospace, monospace"
    fontSize: "0.7rem"
    fontWeight: 700
    lineHeight: 1.4
  scale:
    xxs: "0.6rem"
    xxs-2: "0.62rem"
    xs: "0.65rem"
    xs-2: "0.68rem"
    sm: "0.7rem"
    sm-2: "0.72rem"
    sm-3: "0.75rem"
    sm-4: "0.78rem"
    sm-5: "0.8rem"
    sm-6: "0.82rem"
    sm-7: "0.85rem"
    sm-8: "0.88rem"
    md: "0.9rem"
    md-2: "0.95rem"
    base: "1rem"
    lg: "1.05rem"
    lg-2: "1.1rem"
    lg-3: "1.15rem"
    xl: "1.25rem"
    xl-2: "1.3rem"
    xl-3: "1.4rem"
    xxl: "1.5rem"
    xxl-2: "1.65rem"
    display: "2rem"
    display-2: "2.45rem"
    display-3: "3rem"
rounded:
  xs: "4px"
  sm: "6px"
  md: "10px"
  lg: "16px"
  xl: "20px"
  full: "9999px"
  micro: "8px"
  base: "12px"
  lgplus: "14px"
  xxl: "18px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0.72rem 0.9rem"
  button-primary-hover:
    backgroundColor: "color-mix(in srgb, var(--accent) 88%, #000)"
    rounded: "{rounded.md}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "#647086"
    rounded: "{rounded.md}"
    padding: "9px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.82rem"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "20px"
  topbar-glass:
    backgroundColor: "var(--glass-bg)"
    rounded: "0"
    height: "68px"
  table-row-alt:
    backgroundColor: "{colors.surface-sun}"
    textColor: "{colors.ink}"
---

# Design System: Quickbrand

## Overview

**Creative North Star: "Il Kit"**

Quickbrand è la valigetta del brand raccolta e pronta all'uso. Non è un editor generico decorato — è l'insieme di strumenti che, dal brief, costruisce preventivo, card, logo, flyer, social e sito in una sola sessione. Il sistema visivo deve comunicare ordine, operatività e fiducia: strutture chiare, superfici piane a riposo, accenti solo quando servono per guidare l'azione o lo stato.

Il mood è operativo e fiducioso: tool-first, niente fronzoli. Ogni pannello è uno stadio di produzione; il colore accento appare come un segnale tattile (il pulsante che agisce, lo stato che chiama). Non c'è spazio per l'estetica generica da AI-slop: niente gradienti gratuiti fuori dal contesto documentale, niente glows, niente decorazioni inutili. Il vetro esiste solo dove serve (topbar, modal) per far respirare gli strumenti.

**Key Characteristics:**
- Piatto a riposo, ombra solo come risposta allo stato (hover, attivo, errore)
- Accento rosso segnale riservato a trigger primari, badge e selezioni
- Superfici bianche con toni al ghiaccio, sidebar in navy profondo come ancore
- Tipografia da interfaccia pro: sans peso alto, mai decorativa, letter-spacing negativo sui titoli
- Raggio medio, coerente tra editor e dialog — pill solo per elementi circolari o di stato
- Vetri e sfocature controllate, mai ornamento

## Colors

La paletta è costruita per guidare l'azione e lo stato: rosso segnale su superfici piane, neutrali chiari per il lavoro quotidiano, navy profondo per l'ancora strutturale.

### Primary
- **Rosso segnale** (#E62020): azione primaria, pulsanti decisivi, accento di stato, badge attivi. Non decorativo; raro.

### Secondary
- **Teal documentale** (#01696F): usato nei temi PDF/doc (minimal, corporate) per header e accenti; vincola la stampa e la pagina, non l'interfaccia di lavoro.

### Neutral
- **Canvas ghiaccio** (#F6F8FC): fondo pagina e superfici di lavoro, sempre presente.
- **Superficie bianca** (#FFFFFF): pannelli, card, tabelle.
- **Bordo neutro** (#c8d0df): divisori leggibili senza rumore.
- **Inchiostro scuro** (#07111f): testo principale, massima leggibilità.
- **Inchiostro secondario** (#344054): testo di contesto e sottotitoli.
- **Muted** (#647086): label, hint, meta-dati.
- **Muted leggero** (#94a3b8): placeholder e microcopy.

### Named Rules
**The Rosso segnale è un verbo.** L'accento rosso appare solo su azione, selezione, stato o output decisivo; mai come sfondo decorativo. Se non guida un gesto, non deve essere rosso.
**The Navy resta solo.** Il navy profondo (#082033) è riservato alla sidebar e ai gradienti strutturali; non diventa colore di fondo dei pannelli.
**The Canvas è ghiaccio, mai grigio neutro.** Lo sfondo resta aperto, freddo ma vivo; niente tonalità sporche o warm senza causa.

## Typography

**Display Font:** Outfit (con Inter fallback)
**Body Font:** Inter (ui-sans-serif)
**Label/Mono Font:** JetBrains Mono

**Character:** Sans moderna e pesa, pronta per la scansione. Display compatta sui titoli (letter-spacing negativo), label in maiuscolo per guidare l'occhio, mono per raw output e log. Il testo non decora: informa.

### Hierarchy
- **Display** (900, 2rem, 1, -0.055em): titoli di sezione, header di pagina e momenti di ingresso.
- **Headline** (900, 1.25rem, 1, -0.03em): titoli interni ai pannelli e ai moduli principali.
- **Title** (700, 1rem, 1.2, -0.02em): nomi di sezione dentro card e blocchi.
- **Body** (400, 16px, 1.6): testo operativo, massa, dettagli.
- **Label** (800, 0.68rem, letterSpacing .1em): microcopy, hint, stato, badge e categorie.
- **Mono** (700, 0.7rem, 1.4): raw output AI, log, codice, chiavi.

### Named Rules
**The Mono = raw rule.** Mono font non si usa mai per copy utente; solo per output tecnico, log e token.
**The Label è maiuscolo per gerarchia.** Se un testo è label/hint, deve essere maiuscolo, pesa 800, letterSpacing ≥ 0.08em.
**The Spaziatura negativa non si estende al body.** Letter-spacing negativo resta ai titoli; nel body solo segnale, non stile.

## Layout

Lo spazio è struttura di lavoro: sidebar sinistra stabile, topbar in vetro che respira, editor in colonne con preview centrale. Non si inventano spazi extra quando il sistema ha già una densità: i contenitori devono essere leggibili senza bordatura extra.

Lo spacing usa una scala progressiva da 4px a 48px e i bordi si comportano come parte del sistema: bordo line-lt sui fondi, line su oggetti interattivi, niente linee decorative. Il responsive comprime le colonne e mantiene il focus sul documento; la larghezza massima dei documenti è 794px, quella dei contenuti operativi resta fluida ma ordinata.

### Named Rules
**The Documento è il fulcro.** Ogni layout deve lasciare il documento visibile e centrale; gli editor sono supporto, non frame.
**The Sidebar non è un pannello.** Resta struttura stabile e di navigazione, non spazio per contenuti extra.

## Elevation & Depth

Il sistema è piatto di default. L'ombra è risposta e non ornamento: appare su hover, stato attivo, modal o superficie in sollevazione legittima; non su card statiche o riempimento a piacere. Il vetro è riservato a topbar e layer di controllo; i moduli di lavoro restano pieni.

**Shadow Vocabulary:**
- **Soft hover** (`0 10px 22px rgba(8,32,51,.09)`): lift di bottoni e card al passaggio del mouse.
- **Panel shadow** (`0 8px 24px rgba(19,35,58,.08)`): profondità leggera su card e pannelli attivi.
- **Modal shadow** (`0 20px 60px rgba(0,0,0,.15)`): dialoghi, overlay e superfici in primo piano.
- **Document shadow** (`0 24px 80px rgba(35,44,62,.12)`): pagina stampabile, non interfaccia operativa.

### Named Rules
**The Shadow reagisce.** Se non c'è stato, non c'è ombra: piatta a riposo, elevata solo su hover/focus/attivo.
**The Vetri solo sul controllo.** Il backdrop blur esiste su topbar e modali; i pannelli di editor rimangono opachi.
**The Documento può avere più depth.** Il PDF/documento è stampabile: lì la profondità può essere più forte, perché simula la pagina reale.

## Shapes

La forma è media e rassicurante: angoli curvi ma non morbidi, pill e cerchio solo dove servono per stato o icone. Il raggio comunica la gerarchia: più alto per superfici e card, più basso per input e controllo. Non si usano squircle decorative o forme che rompano la scansione.

## Components

I componenti sono tattili e confidenti: padding leggibile, peso tipografico alto, hover con lift discreto, focus sempre visibile. Ogni stato deve essere riconoscibile a colpo e ogni superficie interattiva ha un bordo chiaro quando è selezionabile.

### Buttons
- **Shape:** media (radius-md)
- **Primary:** accent `var(--accent)` su bianco, padding `.72rem .9rem`, peso `800`, senza ombra a riposo.
- **Hover / Focus:** hover lift `-1px` + ombra soft; focus ring a 3px in `color-mix(in srgb,var(--accent) 35%,transparent)`.
- **Secondary / Ghost / Tertiary:** ghost = trasparente su line, secondary = superficie neutra con bordo, tertiary solo in contesti molto specifici (non default).

### Chips (if used)
- **Style:** superficie neutra, bordo line, testo muted; selezione con bordo accent e superficie accent-softer.
- **State:** attivo/divisibile, mai decorativo; usato per filtri, stati e piccoli tag.

### Cards / Containers
- **Corner Style:** radius-lg
- **Background:** superficie bianca
- **Shadow Strategy:** nessuna a riposo; `shadow-md` solo su hover o attiva
- **Border:** `1px solid var(--line)`
- **Internal Padding:** spacing scale da 16px a 24px a seconda della densità

### Inputs / Fields
- **Style:** bordo `line`, background `surface`, radius `radius-md`
- **Focus:** bordo in accento + box-shadow a 3px in `color-mix(in srgb,var(--accent) 10%,transparent)`
- **Error / Disabled:** error border `danger`, background `danger-bg`; disabled con opacità e cursore non consentito

### Navigation
- **Style:** sidebar con gradient navy strutturale, label maiuscolo, hover su bianco semi-trasparente; topbar glass con backdrop blur e bordo sottile; active sempre con accento e peso maggiore.
- **Mobile:** hamburger drawer + topbar contratta, ma stessi principi di stato.

### AI log panel (signature)
- **Style:** pannello scuro (surface `#0f172a` su tema chiaro, ma coerente col dark) con `JetBrains Mono`, micro testo, bordi sottili e stati colorati
- **Behavior:** feed log AI in tempo reale; entry info/success/error, mai decorativo

## Do's and Don'ts

### Do:
- **Do** mantenere l'accento rosso solo su azione, selezione, stato o output decisivo.
- **Do** tenere le superfici piane a riposo e aggiungere ombra solo quando serve a segnalare interazione o stato.
- **Do** usare `letter-spacing` negativo solo sui titoli; nel testo corrente resta leggibile e normale.
- **Do** mantenere i documenti al centro visuale; gli editor devono restare al servizio del documento.
- **Do** rispettare il raggio medio coerente: `radius-md` su button/input/nav, `radius-lg` su card e modali, `radius-sm` su micro-controllo.
- **Do** usare glass solo su topbar e modali; gli editor restano opachi.
- **Do** rendere ogni stato di input visibile: focus è sempre border + ring, non solo colore.
- **Do** seguire il token system di `GlobalStyles.tsx`; i nuovi colori non sono mai inventati alla superficie.

### Don't:
- **Don't** introdurre gradienti generici o sfumature "AI-slop" fuori dal contesto documentale o strutturale.
- **Don't** usare glows, box-shadow decorative pesanti o backdrop-filter diffusi come ornamento.
- **Don't** rendere il sistema corporate sterile: non spingere neutrali freddi e anonimi su pannelli operativi.
- **Don't** riempire di pill, badge o box rumorosi che interrompono la scansione.
- **Don't** rendere i testi label in minuscolo o maiuscolo incoerente: la gerarchia deve rimanere chiara.
- **Don't** separare i colori tra frontmatter e prose senza una ragione; il frontmatter è normativo.
