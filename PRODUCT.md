# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 18 + Vite + Vercel serverless (monolite `server.ts` + `src/server/handler.ts`), Drizzle ORM → Neon Postgres, PDF/PNG/SVG client-side.

## Users

Due ruoli confermati, scenario dual non ancora deciso:
1. **Admin (Giovanni)** — usa l'app per i suoi clienti, gestisce CRM, research e auto-build AI.
2. **Clienti** — in futuro potrebbero registrarsi e usare l'app da soli (whitelabel attivabile); ad oggi registrazione cliente disattivata (`REGISTRATION_ENABLED=false` per default), ma la decisione non è fissata.

## Product Purpose

Generare un kit branding completo per piccole attività in minuti, in un colpo solo: preventivo PDF professionale, QR Code, Bigliettino da visita, Logo, Flyer, Post social, Sito web — tutto assistito da AI con log tracciati. Success = il documento è pronto da esportare/mandare al cliente senza lasciare la suite.

## Positioning

Tutto in un colpo solo per piccole attività: una sola app produce l'intero kit branding (non un solo documento tipo Canva/Figma), con AI integrata in ogni editor e controllo sui costi (server-side proxy). Nessun prodotto adiacente replica tutto con questo prezzo e questo flusso.

## Operating Context

L'amministratore lavora direttamente nel browser sulla webapp, spesso con una raccolta di clienti/clienti-cliente in CRM. Ogni documento nasce da un brief (manuale o AI) e finisce come esportazione client-side (PDF/PNG/SVG/JSON/ZIP). La modalità dev usa localStorage, la produzione sincronizza su Neon. L'AI è co-editor, non solo "genera".

## Capabilities and Constraints

- Generatori: preventivi (4 opzioni, IVA, acconto/saldo, clausole, riepilogo), QR (7 tipi), Business Card (fronte/retro, grid editor, reference frame 640×414, gerarchia 22/16/14), Logo (SVG da testo+icona, AI 3-concept), Flyer (layout deterministico, floor print), Website (brief 14 campi, preview iframe, export ZIP).
- AI: MiniMax M3 default via Ollama Pro Cloud (flat $20/mo), DeepSeek fallback, Gemini Nano Banana per immagini (logo bg, card cover/icon, flyer hero), thinking mode configurabile; 7 provider registrati.
- **Admin-only (confermato)**: CRM, research, auto-build AI, admin routes; login admin è `admin@gmail.com` contro `ADMIN_PASSWORD` env.
- **AI identity core (confermato)**: ogni orchestrazione è tracciata (Langfuse TB-029), costo per-documento contabilizzato (`aiStats`).
- **Costi bassi / serverless-only (confermato)**: export 100% client-side, nessun upload, Vercel + Neon.
- **Registrazione clienti**: disattivata di default, ma scelta NON fissata (record as undecided).
- **Sicurezza**: niente chiavi AI al browser, rate-limit, zod, CORS.
- Struttura monolitica intenzionale: `src/server/handler.ts` non si splitpa (gotcha §1).
- Local-first storage in dev (FLAT canonical per logo/card/flyer, gotcha §23).

## Brand Commitments

- Nome: **Quickbrand**.
- Tono: diretto, operativo, niente fronzoli; tool-first, non marketing-first.
- Identità visiva: attualmente non binding (nessun palette/typography pinned ancora — viene da `document`/`new-work`).

## Evidence on Hand

- PDF e export generati lato client come dimostrazione (fixture in `e2e/fixtures/`).
- Card template Giovanni (giovanniTemplate in `e2e/fixtures/`).
- Nessun testimonial real, case study, press, benchmark o pricing claim pubblicato pubblicamente: nessuna asserzione commerciale inventabile.

## Product Principles

1. Un brief → un kit completo, non un solo documento.
2. AI visibile: ogni chiamata loggata e tracciata, costo chiaro per documento.
3. Costi bassi: serverless-only, niente upload, chiavi solo server-side, export nel browser.
4. Admin control: CRM cliente e research AI sono cuore del lavoro.
5. Qualità > velocità: preview/export devono coincidere o avvicinarsi il più possibile (CARD_REF 640×414 è la regola).

## Accessibility & Inclusion

Nessun requisito product-specifico confermato oltre ai punti già tracciati (iOS auto-zoom prevention `font-size: 16px` su input mobile; breakpoint canonici `767px`/`1023px`). Undecided: target WCAG formale non ancora impostato.
