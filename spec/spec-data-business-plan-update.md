---
title: Business Plan Update — Allineamento a stack prodotto attuale, costi AI V4, roadmap post-validazione
version: 1.0
date_created: 2026-07-05
last_updated: 2026-07-05
owner: Giovanni Cidu
tags: [data, business, documentation, ai, roadmap, pricing]
---

# Introduction

Il business plan in `doc/business-plan.md` risale a giugno 2026 e riflette lo
stato del prodotto pre-fase 8 (rebrand Quickbrand), pre-fase 9 (card-refactor
submodules), pre-fase 10 (card-grid-ux 9-pos), pre-fase 11 (flyer-refactor
4×5). Da allora il prodotto è evoluto: 11 fasi completate, 1662 test verdi,
rebrand "The Classic" (Red & Ink), AI attiva in 3 moduli su 5 (preventivo,
card, flyer), pricing DeepSeek V4 confermato. Questa spec allinea il
documento alla realtà, corregge un'incoerenza di prezzo (Starter €49 vs
€149), aggiunge sezioni mancanti (AI come vantaggio competitivo, roadmap
post-validazione) e ricalcola i costi operativi.

## 1. Purpose & Scope

**Purpose**: portare `doc/business-plan.md` a riflettere lo stack prodotto
attuale e i costi reali, mantenendolo come singola fonte di verità per
decisioni commerciali.

**Scope**: solo il file `doc/business-plan.md`. Nessuna modifica a codice,
DB, o altre doc. Non introduce nuove feature.

**Audience**: founder (Giovanni), stakeholder futuri, agent AI che leggono
il BP per contesto commerciale.

**Assunzioni**:
- Il pricing DeepSeek V4 pubblicato (`api-docs.deepseek.com/quick_start/pricing`,
  consultato 2026-07-05) è corretto e stabile.
- I pacchetti commerciali attuali (Free/Pro/Starter/Apertura/Presenza/
  Manutenzione/Custom) sono confermati; solo il prezzo Starter va unificato.
- I costi fissi (OpenCode €9/mese, Minimax+GPT Image ~€10) sono invariati
  salvo nuova verifica.

## 2. Definitions

- **BP**: business plan (`doc/business-plan.md`).
- **Stack prodotto**: l'insieme dei moduli dell'app Quickbrand implementati
  nelle fasi 0-11.
- **DeepSeek V4-Flash**: modello default, ex `deepseek-chat`, deprecato
  2026-07-24. Pricing: $0.14/M input cache miss, $0.28/M output.
- **DeepSeek V4-Pro**: modello premium. Pricing: $0.435/M input, $0.87/M
  output (3× flash).
- **Cache miss**: token non presenti in cache KV del provider, pagati
  pienamente. Cache hit: $0.0028/M flash (98% sconto).
- **AI module**: modulo prodotto che usa AI (preventivo, card, flyer).
  Modulo non-AI: QR, logo (v1), collection, settings.
- **Tier system**: meccanismo technical di gating (free/unlocked) via
  `unlock_codes` (Phase 5), mappa 1:1 sui pacchetti commerciali.

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: Aggiungere sezione "Stack prodotto attuale" con tabella delle
  11 fasi (0-11) e i moduli risultanti. Per ogni fase: nome, stato, output
  utente-visible, file chiave (max 3).
- **REQ-002**: Correggere l'incoerenza Starter prezzo. Righe attuali: riga
  60 → €49, riga 223 → €149. Unificare a **€49** (coerente con tabella
  dettaglio piani riga 60 e con il valore di mercato €200-400 Canva Pro).
  La riga 223 nel mappatura tier system va aggiornata a €49.
- **REQ-003**: Ricalcolare costi AI nella sezione "Struttura dei costi"
  usando pricing V4 confermato:
  - Flash: $0.14/M input, $0.28/M output (invariato vs BP, conferma)
  - Pro: $0.435/M input, $0.87/M output (nuovo, 3× flash)
  - Stima 1000 prompt/mese Pro: ~€0.50-1.50 costo (dipende da ratio
    input/output e cache hit rate). Margine ~80-90% su Pro €9/mese.
- **REQ-004**: Aggiungere sezione "AI come vantaggio competitivo" dopo
  "Proposta di valore". Contenuto:
  - AI attiva in 3/5 moduli (preventivo, card, flyer). Logo AI v2 deferred.
  - Competitor: Looka ha AI solo nel logo (€18-88/anno), Canva ha AI
    generica non contestualizzata, VistaPrint/agency niente AI.
  - Vantaggio: AI contestualizzata per modulo (es. card AI conosce grid
    9-pos, flyer AI rispetta density target e char budget per layout).
  - Costo marginale AI per cliente: ~€0.01-0.05/prompt (flash), rende
    i pacchetti una tantum sostenibili anche includendo AI.
- **REQ-005**: Aggiungere sezione "Roadmap post-validazione (oltre 60
  giorni)". Contenuto:
  - **Stripe**: trigger a 15+ transazioni/mese o retainer >€500/mese.
    Setup stimato: 20 ore + 1 settimana monitoraggio.
  - **AI Logo v2**: abilitare tab AI in `LogoEditor.tsx` con
    `REPLICATE_API_TOKEN`. Alternativa: provider alternativo (DALL-E,
    Stable Diffusion) se Replicate non disponibile.
  - **Multi-provider**: aggiungere OpenAI/Anthropic come fallback in
    `providerRegistry` per ridondanza. DeepSeek resta default.
  - **Social AI cross-module**: generare 3 social post coordinati col
    bigliettino/volantino (spec 12).
  - **Manutenzione scale-up**: da €49/mese a €79/mese quando funzionalità
    AI più pesanti incluse (chatbot, generazione automatica contenuti).
- **REQ-006**: Rimuovere riferimenti obsoleti:
  - "LogoAiDocsPage pubblica" (rimossa deliberatamente, docs private in
    `docs/logo-ai.md`)
  - Riferimenti a `precisionQuote_quotes` legacy (sostituito da
    `precisionQuote_documents:v1`)
  - "126c9d1" commit di riferimento (aggiornare a commit corrente o
    rimuovere riferimento)
- **REQ-007**: Aggiornare la tabella "Scenario realistico mese tipo" con
  nuovi conteggi test (1662 vs 983 citati a riga 268) e conferma tariffa
  effettiva ≥€60/ora.
- **CON-001**: Nessuna modifica a codice, DB, o API. Solo documentazione.
- **CON-002**: Il BP resta in italiano, tono onesto e diretto (come
  originale). Niente marketing vuoto.
- **CON-003**: Lunghezza totale del BP non deve superare ~500 righe
  (attuale 377). Sezioni nuove aggiungono ~80-100 righe nette.
- **GUD-001**: Mantenere il formato tabellare esistente per costi,
  pacchetti, competitor. Coerenza visiva.
- **GUD-002**: I prezzi V4 vanno citati in USD (come da fonte DeepSeek)
  con conversione EUR approssimata (1 USD ≈ 0.92 EUR, luglio 2026).
- **PAT-001**: Seguire il tono del BP esistente: onestà sui punti deboli,
  dati concreti, niente hype.
- **PAT-002**: Per la sezione tier system, allinearsi con AGENTS.md
  "Phase Status & Roadmap" (fasi 0-11, commit `497100f`).

## 4. Interfaces & Data Contracts

Nessuna interfaccia codice. L'interfaccia è il file markdown stesso.

**Struttura sezioni nuove**:

```markdown
## Stack prodotto attuale

Tabella 11 fasi (0-11) con: nome, stato, modulo, file chiave (max 3).

## AI come vantaggio competitivo

Paragrafo + tabella competitor AI + stima costo/prompt.

## Roadmap post-validazione (oltre 60 giorni)

Lista puntuata: Stripe, AI Logo v2, multi-provider, social AI,
manutenzione scale-up.
```

**Schema prezzi V4** (da citare):

| Modello | Input cache miss | Input cache hit | Output |
|---------|-----------------|-----------------|--------|
| V4-Flash | $0.14/M | $0.0028/M | $0.28/M |
| V4-Pro | $0.435/M | (n/d) | $0.87/M |

## 5. Acceptance Criteria

- **AC-001**: Given il BP aggiornato, When si cerca "Stack prodotto
  attuale", Then la sezione esiste e contiene 11 righe (fasi 0-11).
- **AC-002**: Given il BP aggiornato, When si cerca il prezzo Starter,
  Then appare **solo** €49 (niente €149 residuo).
- **AC-003**: Given il BP aggiornato, When si cerca "AI come vantaggio
  competitivo", Then la sezione esiste e menziona 3/5 moduli AI.
- **AC-004**: Given il BP aggiornato, When si cerca "Roadmap
  post-validazione", Then la sezione elenca ≥4 item (Stripe, AI Logo v2,
  multi-provider, social AI).
- **AC-005**: Given il BP aggiornato, When si cerca "LogoAiDocsPage
  pubblica", Then **non** appare (rimosso).
- **AC-006**: Given il BP aggiornato, When si cerca "126c9d1", Then
  **non** appare (riferimento commit rimosso o aggiornato).
- **AC-007**: Given il BP aggiornato, When si conta il totale righe,
  Then ≤500 righe.
- **AC-008**: Given il BP aggiornato, When si cerca "$0.14" e "$0.28",
  Then appaiono nella sezione costi (pricing V4 flash confermato).
- **AC-009**: Given il BP aggiornato, When si cerca "$0.435" o "V4-Pro",
  Then appare (pricing Pro nuovo).
- **AC-010**: Given il BP aggiornato, When si legge la sezione tier
  system, Then i pacchetti e prezzi sono coerenti con AGENTS.md
  "Phase Status & Roadmap".

## 6. Test Automation Strategy

- **Test Levels**: nessun test codice. Validazione manuale + grep.
- **Frameworks**: N/A.
- **Test Data Management**: N/A.
- **CI/CD Integration**: nessuna. Il BP non è testato in CI.
- **Coverage Requirements**: N/A.
- **Performance Testing**: N/A.
- **Consistency check** (manuale post-edit):
  - `grep -n "€149" doc/business-plan.md` deve dare 0 match (Starter
    unificato a €49)
  - `grep -n "LogoAiDocsPage pubblica" doc/business-plan.md` → 0 match
  - `grep -n "126c9d1" doc/business-plan.md` → 0 match
  - `grep -nc "Stack prodotto attuale\|AI come vantaggio\|Roadmap post-validazione" doc/business-plan.md` → 3
  - `wc -l doc/business-plan.md` → ≤500

## 7. Rationale & Context

Il BP è la fonte di verità commerciale. Non aggiornarlo significa decidere
su dati vecchi: prezzo Starter incoerente (€49 vs €149) genera confusione
in fase di vendita, mancanza della sezione AI sottovaluta il vantaggio
competitivo più forte, mancanza della roadmap post-validazione lascia
decidere Stripe/provider a intuito. I costi DeepSeek V4 sono per fortuna
invariati per flash (conferma €0.14/€0.28), ma il modello Pro nuovo
($0.435/$0.87) va documentato perché è il default per AI card/flyer (vedi
`providerRegistry` in `src/ai/providers/registry.ts`, secondo provider
registrato).

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: DeepSeek API — pricing V4 confermato (`api-docs.deepseek.com`
  consultato 2026-07-05). Modelli: V4-Flash (default), V4-Pro (premium).

### Third-Party Services
- **SVC-001**: Stripe (futuro, non implementato v1). Trigger soglia: 15+
  transazioni/mese.

### Infrastructure Dependencies
- **INF-001**: Vercel Hobby + Neon free tier (costo €0, invariato).

### Data Dependencies
- **DAT-001**: `AGENTS.md` sezione "Phase Status & Roadmap" — fonte per
  fasi 0-11 e stati.

### Technology Platform Dependencies
- **PLT-001**: Nessuna. Il BP è markdown puro.

### Compliance Dependencies
- **COM-001**: Nessuna per questa spec. Stripe v2 richiederà fatturazione
  elettronica IT (out of scope qui).

## 9. Examples & Edge Cases

**Esempio sezione "Stack prodotto attuale"** (estratto):

```markdown
## Stack prodotto attuale

| Fase | Stato | Modulo | File chiave |
|------|-------|--------|-------------|
| 0, Auto-save | ✅ | Preventivo | `EditorView.tsx`, `mergeSummary.ts` |
| 1, QR Code | ✅ | QR | `qrGenerator.ts`, `QREditor.tsx` |
| 2, Card | ✅ | Bigliettini | `cardGenerator.ts`, `CardEditor.tsx` |
| 2.2, Card refactor | ✅ | Card grid | `gridUtils.ts`, `card/*` |
| 3, Flyer | ✅ | Volantini | `flyerGenerator.ts`, `FlyerEditor.tsx` |
| 4, Logo | ✅ | Logo (no AI v1) | `logoGenerator.ts`, `LogoEditor.tsx` |
| 5, Tier | ✅ | Sblocco | `watermark.ts`, `unlock_codes` |
| 6, Collection | ✅ | Collection | `CollectionView.tsx` |
| 7, Polish | ✅ | Onboarding | `OnboardingModal.tsx` |
| 8, Rebrand | ✅ | Quickbrand | `HomePage.tsx`, `LoginPage.tsx` |
| 9, Card refactor | ✅ | Card submodules | `src/utils/card/*` |
| 10, Card grid UX | ✅ | Grid 9-pos | `previewHelpers.ts` |
| 11, Flyer refactor | ⚠️ | Flyer engine | `src/utils/flyer/*` |
```

**Edge case — incoerenza Starter**: prima della correzione, riga 60
diceva €49 (tabella dettaglio piani), riga 223 diceva €149 (mappatura
tier system). Un cliente che leggeva entrambe vedeva due prezzi. Dopo:
solo €49 ovunque, coerente col valore di mercato (€200-400 Canva Pro
annuo, Starter €49 una tantum è più basso come posizionamento).

**Edge case — test count**: riga 268 originale cita "983/983 test verdi".
Attuale: 1662/1662. Aggiornare per accuratezza.

## 10. Validation Criteria

- Tutti gli AC-001..010 soddisfatti.
- `grep -n "€149" doc/business-plan.md` → 0 match.
- `wc -l doc/business-plan.md` → ≤500.
- Lettura umana: tono onesto, niente hype, dati concreti.
- Coerenza con AGENTS.md "Phase Status & Roadmap" (fasi e stati).

## 11. Related Specifications / Further Reading

- `AGENTS.md` — sezione "Phase Status & Roadmap" (fasi 0-11, commit
  `497100f`).
- `doc/business-plan.md` — file da aggiornare (stato pre-edit).
- DeepSeek pricing: https://api-docs.deepseek.com/quick_start/pricing
- `spec/spec-data-phase5-tier-system.md` — *(cancellata, traccia in git
  history)* — mappatura tier system originale.