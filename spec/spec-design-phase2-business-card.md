---
title: Phase 2 — Bigliettino da visita fronte/retro
version: 1.0
date_created: 2026-06-21
owner: Giovanni Cidu
tags: [design, business-card, pdf, print, base64, qr-integration, watermark-pending]
---

# Introduction

La fase 2 introduce il bigliettino da visita, il primo documento
"stampa-ready" della suite. Ha fronte e retro, supporta foto e logo
(upload base64 inline), QR auto-generato dal sito dell'utente, e
produce un PDF A4 con 10 bigliettini impaginati (5×2) più bleed 3mm
e crop marks per il tipografo.

Questa fase esercita l'integrazione con il QR (fase 1): il retro del
bigliettino contiene un QR generato riusando `qrGenerator.ts`. Esercita
anche l'upload di immagini client-side con compressione via canvas,
pattern che verrà riusato in volantino (hero image) e logo (eventuale
AI upload in v2).

Il sample Giovanni richiesto dall'utente viene precaricato come template
globale, con placeholder `XXXXX` per telefono ed email (nessun dato
reale).

## 1. Purpose & Scope

**Purpose**: permettere all'utente di comporre un bigliettino da visita
professionale fronte/retro, con foto/logo opzionali, QR del sito, e
esportare un PDF pronto per la tipografia (10-up A4 con bleed).

**Scope**:
- Estensione `src/utils/documentSchemas.ts` con `businessCardSchema` +
  helper `createEmptyCard()`, `createGiovanniCardTemplate()`
- Nuovo file `src/utils/cardGenerator.ts` con `generateCardPDF(card,
  { tier })`, `generateCardPng(card, side, { tier })`,
  `compressImage(file, maxBytes)` helper
- Nuovo componente `src/components/CardEditor.tsx` con 2 preview
  affiancate (fronte/retro) + form
- Estensione `src/components/Layout.tsx`: nuova voce sidebar "Bigliettini"
- Estensione `App.tsx`: view state `'card'` + render condizionale
- Estensione `src/utils/dataService.js`: nessuna (riusa `saveDocument`
  della fase 1)
- Estensione `api/index.ts`: nessuna (endpoint `/documents` già
  gestisce qualsiasi `documentType`)

**Out of scope**:
- Integrazione tipografia (Stampaprint API) — out of scope v2
- Ordine stampa diretto dall'app — out of scope v2
- Tier system e watermark — fase 5
- Layout custom drag-and-drop — out of scope (solo 3 preset: centered,
  left, split)
- Modifica del `CollectionView` — fase 6

**Intended audience**: sviluppatore che implementa il bigliettino;
reviewer che verifica i test e il PDF prodotto.

**Assumptions**:
- `qrGenerator.ts` della fase 1 è disponibile e funzionante.
- Endpoint `/documents` della fase 1 accetta qualsiasi `documentType`
  senza modifiche.
- L'utente ha almeno un browser moderno con Canvas API (tutti i
  browser supportati dal progetto).

## 2. Definitions

- **Business card**: documento `documentType='businessCard'` con
  `front` e `back` strutturati.
- **Front**: lato del bigliettino con nome, titolo, azienda, foto,
  logo. Layout `centered` | `left` | `split`.
- **Back**: lato del bigliettino con contatti (telefono, email, sito,
  indirizzo, P.IVA), social, e QR.
- **Size preset**: formato fisico del bigliettino:
  - `eu-85x55`: 85×55mm (standard europeo)
  - `us-89x51`: 89×51mm (standard US)
  - `square-65x65`: 65×65mm (formato quadrato moderno)
- **Bleed**: margine di 3mm attorno al bigliettino per il taglio. Il
  contenuto finale è 91×61mm per `eu-85x55` (85+3+3 × 55+3+3).
- **Crop marks**: linee di taglio piccole agli angoli del bigliettino
  per guide il tipografo.
- **10-up A4**: layout di 10 bigliettini su un foglio A4 (210×297mm),
  5 colonne × 2 righe, con gap 5mm tra bigliettini e crop marks.
- **Logo overlay**: per il QR del retro, vedi fase 1.

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: L'utente può creare un bigliettino da vuoto o dal
  template Giovanni (placeholder `XXXXX` per telefono/email).
- **REQ-002**: Fronte ha 6 campi: `name`, `title`, `company`,
  `photoUrl` (opzionale), `logoUrl` (opzionale), `layout`
  (`centered` | `left` | `split`).
- **REQ-003**: Retro ha 8 campi: `phone`, `email`, `website`,
  `address`, `vatNumber`, `socials` (array di `{platform, url}`),
  `qrPayload` (stringa, default = `website`), `qrLabel` (testo sotto
  il QR).
- **REQ-004**: L'utente può switchare tra 3 size preset (EU, US,
  square) con anteprima live che ridimensiona.
- **REQ-005**: L'utente può caricare foto (fronte) e logo (fronte)
  tramite drag-and-drop o click. Entrambi vengono compressi client-side
  a max 800px lato lungo e max 500KB base64.
- **REQ-006**: Il QR del retro è auto-generato dal campo `website` se
  `qrPayload` è vuoto. Se `qrPayload` è popolato manualmente, usa quel
  valore (per QR custom tipo vCard).
- **REQ-007**: Stile configurabile: `bgColor`, `textColor`,
  `accentColor`, `fontFamily`, `borderStyle` (`none` | `thin` |
  `accent-strip-left` | `accent-strip-bottom`).
- **REQ-008**: Export PDF A4 10-up con bleed 3mm e crop marks. Il PDF
  ha 1 pagina per il fronte + 1 pagina per il retro (stampabili
  fronte-retro).
- **REQ-009**: Export PNG del singolo bigliettino (fronte o retro) alla
  risoluzione scelta (150 DPI free, 300 DPI unlocked — vedi fase 5).
- **REQ-010**: Anteprima live con aggiornamento debounce 300ms.
- **REQ-011**: Salvataggio in collection tramite `dataService.saveDocument`
  con `documentType: 'businessCard'`.
- **SEC-001**: Upload immagini: MIME allowlist `image/png`, `image/jpeg`,
  `image/svg+xml`. Rifiutare altri formati.
- **SEC-002**: Upload immagini: size max 5MB prima della compressione.
  Rifiutare file più grandi.
- **SEC-003**: Upload immagini: dimensioni max 4000×4000px. Rifiutare
  immagini più grandi (potrebbero crashare il canvas).
- **SEC-004**: Validazione URL `website` con `new URL()` + protocollo
  `http:` o `https:`.
- **SEC-005**: Nessun PII (telefono, email, indirizzo) viene loggato.
  Logger client filtra `back.phone`, `back.email`, `back.address`.
- **CON-001**: PDF generato con `pdfmake` (già nel progetto). Nessun
  nuovo dependency per il PDF.
- **CON-002**: Compressione immagini via Canvas API nativa
  (`canvas.toDataURL('image/jpeg', 0.85)`). Nessun nuovo dependency.
- **CON-003**: Vercel Hobby: nessun endpoint AI nuovo in questa fase.
- **CON-004**: Base64 inline in `data` jsonb. Max 500KB per immagine
  dopo compressione. Limite totale per documento: 2MB (2 immagini ×
  500KB + altri campi).
- **GUD-001**: Seguire `AGENTS.md` "Test — OBBLIGATORI": coverage
  ≥60% per i nuovi file.
- **GUD-002**: Seguire skill `vercel-react-best-practices`:
  `React.memo` per le 2 preview, lazy-load `CardEditor`.
- **GUD-003**: Seguire skill `web-design-guidelines`: contrasto testo
  min 4.5:1, label per tutti gli input, keyboard nav tra front/back.
- **GUD-004**: Seguire skill `web-security` per validazione upload.
- **GUD-005**: Seguire skill `frontend-design` per il design delle 2
  preview — non "templated defaults", scegliere typography e
  proporzioni intenzionali.
- **GUD-006**: Seguire AGENTS.md "localStorage Schema":
  `precisionQuote_documents:v1` già introdotto nella fase 1, riusato.
- **PAT-001**: Pattern compressione immagini:
  ```ts
  async function compressImage(file: File, maxDim = 800, maxBytes = 500_000): Promise<string> {
    if (file.size > 5_000_000) throw new Error('File troppo grande (max 5MB)');
    const img = await loadImage(file);
    if (img.width > 4000 || img.height > 4000) throw new Error('Immagine troppo grande (max 4000px)');
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let quality = 0.85;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > maxBytes * 1.37 && quality > 0.3) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    if (dataUrl.length > maxBytes * 1.37) throw new Error('Immagine troppo pesante anche dopo compressione');
    return dataUrl;
  }
  ```
- **PAT-002**: Pattern preview affiancata: 2 componenti `CardPreview`
  memoizzati con props `side` (`'front' | 'back'`) e `card`.
- **PAT-003**: Pattern PDF 10-up: calcolare coordinate dei 10
  bigliettini sul A4 (margini 10mm, gap 5mm), renderizzare ogni
  bigliettino via `pdfmake` `canvas` o SVG-to-pdfmake.

## 4. Interfaces & Data Contracts

### Schema `src/utils/documentSchemas.ts` (estensione)

```ts
export const businessCardSchema = z.object({
  documentType: z.literal('businessCard'),
  id: z.string(),
  title: z.string().default(''),
  front: z.object({
    name: z.string().default(''),
    title: z.string().default(''),
    company: z.string().default(''),
    photoUrl: z.string().nullable().default(null),
    logoUrl: z.string().nullable().default(null),
    layout: z.enum(['centered', 'left', 'split']).default('left'),
  }),
  back: z.object({
    phone: z.string().default(''),
    email: z.string().default(''),
    website: z.string().default(''),
    address: z.string().default(''),
    vatNumber: z.string().default(''),
    socials: z.array(z.object({ platform: z.string(), url: z.string() })).default([]),
    qrPayload: z.string().default(''),
    qrLabel: z.string().default('Scansiona per visitare il sito'),
  }),
  style: z.object({
    sizePreset: z.enum(['eu-85x55', 'us-89x51', 'square-65x65']).default('eu-85x55'),
    bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#FFFFFF'),
    textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1a1a2e'),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#01696F'),
    fontFamily: z.string().default('Inter'),
    borderStyle: z.enum(['none', 'thin', 'accent-strip-left', 'accent-strip-bottom']).default('accent-strip-left'),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BusinessCard = z.infer<typeof businessCardSchema>;

export function createEmptyCard(): BusinessCard { /* defaults */ }

export function createGiovanniCardTemplate(): BusinessCard {
  return {
    ...createEmptyCard(),
    title: 'Bigliettino Giovanni — Web Developer',
    front: {
      name: 'GIOVANNI CIDU',
      title: 'Web Developer',
      company: '',
      photoUrl: null,
      logoUrl: null,
      layout: 'left',
    },
    back: {
      phone: 'XXXXX',
      email: 'XXXXX',
      website: 'https://webdeveloperca.netlify.app/',
      address: '',
      vatNumber: '',
      socials: [
        { platform: 'LinkedIn', url: '' },
        { platform: 'GitHub', url: '' },
      ],
      qrPayload: '', // auto-da website
      qrLabel: 'Scansiona per visitare il mio sito',
    },
    style: {
      sizePreset: 'eu-85x55',
      bgColor: '#FFFFFF',
      textColor: '#1a1a2e',
      accentColor: '#01696F',
      fontFamily: 'Inter',
      borderStyle: 'accent-strip-left',
    },
  };
}
```

### Generatore `src/utils/cardGenerator.ts`

```ts
import pdfMake from 'pdfmake/build/pdfmake';
import { generateQrSvg } from './qrGenerator';
import type { BusinessCard } from './documentSchemas';

const SIZE_PRESETS = {
  'eu-85x55': { w: 85, h: 55 },
  'us-89x51': { w: 89, h: 51 },
  'square-65x65': { w: 65, h: 65 },
};

const BLEED = 3; // mm

export async function generateCardPDF(
  card: BusinessCard,
  opts: { tier: 'free' | 'unlocked' }
): Promise<Uint8Array> {
  const size = SIZE_PRESETS[card.style.sizePreset];
  const fullW = size.w + BLEED * 2;
  const fullH = size.h + BLEED * 2;
  // A4: 210x297mm
  // Layout 5 colonne × 2 righe = 10 bigliettini
  // Gap 5mm, margini 10mm
  const pageW = 210, pageH = 297;
  const cols = 5, rows = 2, gap = 5, margin = 10;
  const totalW = cols * fullW + (cols - 1) * gap;
  const totalH = rows * fullH + (rows - 1) * gap;
  const offsetX = (pageW - totalW) / 2;
  const offsetY = (pageH - totalH) / 2;

  const frontQrSvg = card.back.qrPayload
    ? await generateQrSvg({ /* wrap come QRCode */ })
    : await generateQrSvg({ /* wrap con payload=website */ });

  // Costruisci docDefinition pdfmake con 2 pagine (front + back)
  // Ogni pagina ha 10 bigliettini posizionati + crop marks
  // Watermark se tier === 'free' (fase 5, qui no-op)
  // ...
}

export async function generateCardPng(
  card: BusinessCard,
  side: 'front' | 'back',
  opts: { tier: 'free' | 'unlocked'; dpi?: number }
): Promise<Uint8Array> {
  // Render del singolo lato via Canvas
  // ...
}

export async function compressImage(file: File, maxDim = 800, maxBytes = 500_000): Promise<string> {
  // vedi PAT-001
}
```

### Componente `src/components/CardEditor.tsx`

```tsx
interface CardEditorProps {
  card: BusinessCard;
  onPatch: (path: string, value: any) => void;
  onUploadPhoto: (file: File) => Promise<void>;
  onUploadLogo: (file: File) => Promise<void>;
  onExportPDF: () => void;
  onExportPng: (side: 'front' | 'back') => void;
  documentTheme: DocumentTemplateId;
  tier: 'free' | 'unlocked';
}

export default function CardEditor(props: CardEditorProps) {
  return (
    <div className="card-editor">
      <div className="card-form">
        {/* Form con sezioni Front/Back/Style */}
      </div>
      <div className="card-previews">
        <CardPreview side="front" card={props.card} />
        <CardPreview side="back" card={props.card} />
      </div>
    </div>
  );
}

const CardPreview = React.memo(({ side, card }: { side: 'front' | 'back'; card: BusinessCard }) => {
  // Render HTML dell'anteprima del lato, in scala
});
```

### Sidebar `Layout.tsx` (estensione)

Nuova voce "Bigliettini" con icona SVG bigliettino, chiama
`setView('card')`.

### `App.tsx` — view state (estensione)

```ts
const [view, setView] = useState<'editor' | 'qr' | 'card' | 'collection' | 'settings' | 'admin'>('editor');
```

Render condizionale: `view === 'card'` → `<Suspense><CardEditor /></Suspense>`.

## 5. Acceptance Criteria

- **AC-001**: Given utente loggato, When click "Bigliettini" sidebar,
  Then `CardEditor` renderizzato con bigliettino vuoto
  (`createEmptyCard`).
- **AC-002**: Given prima apertura, When utente vede banner "Usa
  template Giovanni", Then click carica `createGiovanniCardTemplate()`
  con `phone='XXXXX'`, `email='XXXXX'`, `website='https://webdeveloperca.netlify.app/'`.
- **AC-003**: Given `front.layout='left'`, When utente cambia in
  `'centered'`, Then anteprima fronte si riaggiorna con testo centrato
  (debounce 300ms).
- **AC-004**: Given utente trascina file PNG 3MB sulla drop-zone foto,
  When `compressImage` gira, Then `photoUrl` è un base64 JPEG max 500KB
  e max 800px lato lungo.
- **AC-005**: Given utente trascina file `.exe` 1MB sulla drop-zone,
  Then appare errore "Formato non supportato. Usa PNG, JPEG o SVG." e
  `photoUrl` resta invariato.
- **AC-006**: Given utente trascina file PNG 8MB, Then appare errore
  "File troppo grande (max 5MB)".
- **AC-006b**: Given utente trascina file PNG 6000×4000px, Then appare
  errore "Immagine troppo grande (max 4000px)".
- **AC-007**: Given `back.website='https://example.com'` e
  `back.qrPayload=''`, When anteprima retro si renderizza, Then il QR
  mostra `https://example.com` (auto-generato dal website).
- **AC-008**: Given `back.qrPayload='MATMSG:...'` popolato, When
  anteprima retro, Then il QR mostra il payload custom (non il
  website).
- **AC-009**: Given utente click "Esporta PDF", Then viene scaricato
  `card_<id>.pdf` con 2 pagine A4 (front + back), ognuna con 10
  bigliettini + crop marks + bleed 3mm.
- **AC-010**: Given utente click "Esporta PNG fronte", Then viene
  scaricato `card_<id>_front.png` con singolo bigliettino fronte alla
  risoluzione 300 DPI (o 150 DPI per free, vedi fase 5).
- **AC-011**: Given `style.sizePreset='eu-85x55'`, When utente cambia
  in `'square-65x65'`, Then anteprima si ridimensiona a quadrato 65mm.
- **AC-012**: Given card modificato, When auto-save silenzioso fire,
  Then `saveDocument` chiamato con `documentType='businessCard'`.
- **AC-013**: Given utente ha caricato foto 400KB base64 nel card,
  When salvataggio in localStorage, Then funziona senza errori (sotto
  il limite 5MB di localStorage per chiave).
- **AC-014**: Given `npm run typecheck`, Then code 0.
- **AC-015**: Given `npm run test`, Then code 0 e tutti i nuovi test
  passano.

## 6. Test Automation Strategy

- **Test Levels**: Unit (schema, generator, compressImage),
  Integration (componente con upload mock), Contract (PDF output
  shape).
- **Frameworks**: Vitest 4, React Testing Library 16, jsdom 29.
- **Test Data Management**: immagini di test come base64 string
  hardcoded nei test (piccoli PNG 10×10px). Mock `URL.createObjectURL`
  per i download. Mock `canvas.toDataURL` per i test di compressione.
- **Coverage Requirements**: ≥60% per i nuovi file.

### File di test da creare

| File | Cosa copre |
|------|-----------|
| `src/utils/__tests__/documentSchemas.test.ts` (estensione) | parse OK per `businessCardSchema`, default values, helper `createEmptyCard` e `createGiovanniCardTemplate` (verifica placeholder XXXXX) |
| `src/utils/__tests__/cardGenerator.test.ts` | `compressImage` con 4 casi (PNG OK, JPEG OK, file troppo grande, dimensioni troppo grandi); `generateCardPDF` ritorna buffer non vuoto; `generateCardPng` ritorna buffer per ogni side; size preset corrette |
| `src/components/__tests__/CardEditor.test.tsx` | render iniziale, click template Giovanni, cambio layout, upload foto (mock `FileReader` + `Image`), upload logo, validazione errori, export PDF/PNG (mock `URL.createObjectURL`), auto-generazione QR da website |
| `src/components/__tests__/CardPreview.test.tsx` | render dei 3 layout front (centered/left/split), render back con QR, render back senza QR, stile borderStyle applicato |

### Test matrice

| AC | Test file |
|----|-----------|
| AC-001 | CardEditor.test.tsx |
| AC-002 | CardEditor.test.tsx |
| AC-003 | CardEditor.test.tsx + CardPreview.test.tsx |
| AC-004 | cardGenerator.test.ts (compressImage) |
| AC-005 | CardEditor.test.tsx (upload) |
| AC-006 | cardGenerator.test.ts (compressImage size) |
| AC-006b | cardGenerator.test.ts (compressImage dim) |
| AC-007 | CardPreview.test.tsx |
| AC-008 | CardPreview.test.tsx |
| AC-009 | cardGenerator.test.ts (PDF) |
| AC-010 | cardGenerator.test.ts (PNG) |
| AC-011 | CardEditor.test.tsx + CardPreview.test.tsx |
| AC-012 | CardEditor.test.tsx (fake timers) |
| AC-013 | integration.test.ts (localStorage) |
| AC-014 | typecheck |
| AC-015 | test run |

## 7. Rationale & Context

**Perché 3 layout fissi e non editor drag-and-drop**:

Editor drag-and-drop (tipo Canva) richiederebbe 2-3 settimane di lavoro
per elemento + posizionamento + undo/redo. Per il modello di business
("72h consegna pacchetto"), l'utente non ha tempo di impazzire con il
drag. 3 preset coprono il 90% dei casi reali (formale, moderno, creativo).
Il drag-and-drop è out of scope v2 se la domanda lo giustifica.

**Perché 10-up A4 e non singolo bigliettino**:

I tipografi (Stampaprint, Pixartprinting) richiedono file A4 con
multipli per ottimizzare il taglio. Un PDF con 10 bigliettini
impaginati + crop marks è pronto per la stampa senza ulteriori
interventi. Export del singolo bigliettino è disponibile come PNG per
uso digitale (social, email signature).

**Perché base64 inline e non Vercel Blob**:

Vercel Blob su Hobby ha 500MB free tier. Per 50 clienti × 5 documenti ×
2 immagini × 300KB = 150MB, rientra. Ma:
- Aggiunge una variabile d'ambiente `BLOB_READ_WRITE_TOKEN`
- Richiede chiamata API per ogni upload (latenza)
- Complessità di gestione lifecycle (immagini orfane)

Per la v1, base64 inline nel `data` jsonb è più semplice e sufficiente.
Vercel Blob è out of scope v2 se si superano 100 clienti o si vuole CDN
per performance.

**Perché placeholder `XXXXX` per Giovanni e non dati reali**:

L'utente (Giovanni) ha esplicitamente richiesto `XXXXX` per telefono ed
email nel template personale. Nessun dato reale dei bigliettini di
esempio (le foto dei bigliettini fornite dall'utente) è stato preso —
solo ispirazione visiva per i 3 layout.

**Perché QR auto-generato dal website di default**:

Il 90% dei bigliettini ha un QR che punta al sito dell'azienda.
Auto-generare dal campo `website` risparmia un passaggio all'utente.
L'override `qrPayload` è disponibile per casi custom (vCard, link a
portfolio specifico, WiFi del locale).

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: Nessuna nuova integrazione esterna (PDF client-side).

### Third-Party Services
- **SVC-001**: Nessuna nuova dipendenza di servizio.

### Infrastructure Dependencies
- **INF-001**: Vercel Hobby plan — nessun impatto (tutto client-side).
- **INF-002**: Neon Postgres free tier — `data` jsonb cresce con base64,
  ma Neon free tier ha 10GB storage, sufficiente per la fase pre-clienti.

### Data Dependencies
- **DAT-001**: localStorage key `precisionQuote_documents:v1` (riuso da
  fase 1).
- **DAT-002**: Tabella DB `documents` con `document_type='businessCard'`
  e `data` jsonb popolato.

### Technology Platform Dependencies
- **PLT-001**: `pdfmake` 0.3.11 (già nel progetto) — supporto immagini
  base64 via `images: { photo: 'data:image/jpeg;base64,...' }`.
- **PLT-002**: Canvas API nativa del browser — per compressione
  immagini. Compatibile tutti i browser supportati.
- **PLT-003**: `qrcode` ^1.5.4 (fase 1) — riusato per QR del retro.

### Compliance Dependencies
- **COM-001**: WCAG AA contrast 4.5:1 per testo su bgColor.
- **COM-002**: GDPR — PII (telefono, email, indirizzo) non loggati.
- **COM-003**: Standard stampa ISO 15930 (PDF/X) — non implementato in
  v1 (pdfmake non lo supporta nativamente). Il PDF prodotto è PDF 1.4
  standard, accettato dalla maggior parte dei tipografi. Per tipografi
  che richiedono PDF/X, l'utente converte con Acrobat o
  `ghostscript`. Out of scope v2 integrare PDF/X nativo.

## 9. Examples & Edge Cases

### Edge case 1: Card senza foto nè logo

Layout `left` con solo testo (nome, titolo, azienda). Anteprima OK,
PDF OK senza immagini.

### Edge case 2: Card con foto ma senza logo

`photoUrl` popolato, `logoUrl` null. Layout `left` mette foto in alto
a sinistra, testo sotto. Layout `centered` mette foto in alto al
centro. Layout `split` mette foto a sinistra 50%, testo a destra 50%.

### Edge case 3: Retro senza QR

`back.qrPayload=''` e `back.website=''` → QR non renderizzato. Retro
mostra solo contatti testuali. Anteprima OK, PDF OK.

### Edge case 4: Social URL malformati

```ts
// socials: [{ platform: 'LinkedIn', url: 'not-a-url' }]
// Validazione soft: se URL non valido, mostra ma non linka nel PDF
// (pdfmake non fallisce su URL malformati, ma il QR non punta a nulla).
```

### Edge case 5: Cambio size preset dopo impaginazione

```ts
// sizePreset='eu-85x55' → 'square-65x65'
// Anteprima si ridimensiona immediatamente
// PDF 10-up ricalcola le coordinate (cols=5, rows=2 ancora valide
// perché 65×65mm × 10 = sufficiente su A4)
```

### Edge case 6: Compressione di un'immagine già piccola

```ts
// File PNG 200×200px 50KB
// compressImage: scale=1 (già <800px), quality=0.85, dataUrl ~70KB
// dataUrl.length (50_000 * 1.37) = 68500 char > 500_000 * 1.37 = 685000?
// No, 68500 < 685000 → OK, ritorna senza ulteriore compressione
```

### Edge case 7:Documento con 2 immagini alla massima size

```ts
// photoUrl 500KB + logoUrl 500KB + altri campi ~1KB
// Totale documento ~1MB → OK per localStorage (limite 5MB per chiave)
// Totale in DB jsonb → OK per Neon (riga jsonb max 1GB)
```

## 10. Validation Criteria

Prima di considerare la fase 2 completata, verificare:

1. `npm run typecheck` code 0.
2. `npm run test` code 0, tutti i nuovi test passano.
3. `git diff src/utils/documentSchemas.ts` mostra `businessCardSchema` +
   helper.
4. `git status` mostra i nuovi file:
   - `src/utils/cardGenerator.ts`
   - `src/components/CardEditor.tsx`
   - `src/utils/__tests__/cardGenerator.test.ts`
   - `src/components/__tests__/CardEditor.test.tsx`
   - `src/components/__tests__/CardPreview.test.tsx`
5. `git diff src/components/Layout.tsx` mostra nuova voce sidebar
   "Bigliettini".
6. `git diff App.tsx` mostra view state `'card'` + lazy-load
   `CardEditor`.
7. Manuale: `npm run dev`, loggare, click "Bigliettini", caricare
   template Giovanni, verificare anteprima fronte/retro, upload foto
   (test con file PNG 1MB), export PDF (verificare 10-up + crop marks
   aprendo in Acrobat o browser).
8. Manuale: verificare che il PDF scaricato ha 2 pagine A4 (front +
   back) e non 1.
9. Manuale: verificare che il QR del retro punta a
   `https://webdeveloperca.netlify.app/` nel template Giovanni.

## 11. Related Specifications / Further Reading

- `spec/spec-process-phase0-autosave-fix.md` — auto-save
- `spec/spec-tool-phase1-qr-code.md` — QR riusato per il retro
- `spec/spec-design-phase3-flyer.md` — pattern upload hero image
  riusato da questa fase
- `spec/spec-tool-phase4-logo-builder.md` — logo caricato come
  `logoUrl` qui
- `spec/spec-data-phase5-tier-system.md` — watermark PDF e risoluzione
  gate
- `spec/spec-architecture-phase6-unified-collection.md` — visualizzazione
  bigliettini in CollectionView
- `AGENTS.md` — regole test, localStorage, Vercel routing
- `README.md` — sezione "Layout Documento (PDF)" per confronto con
  PDF preventivi esistente
- `DESIGN.md` — design system (colori, typography, rounded, spacing)
- Skill `frontend-design` — design intenzionale, non templated
- Skill `vercel-react-best-practices` — memo preview, lazy-load
- Skill `web-design-guidelines` — accessibilità
- Skill `web-security` — upload validation

### Prossima fase

Dopo il completamento della fase 2, procedere con
`spec/spec-design-phase3-flyer.md` (Volantino).
