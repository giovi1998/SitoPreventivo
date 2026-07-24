---
title: AI Logo Generation, Disponibile in v2
audience: sviluppatori che riattiveranno il flusso in v2
status: placeholder, vedi Roadmap in AGENTS.md
---

# AI Logo Generation, Disponibile in v2

Il tab "AI Generation" del Logo Editor mostra un messaggio breve e basta. È una scelta deliberata, non un bug. Questa pagina spiega perché e come riattivarlo in v2. È documentazione interna, non è servita dal sito.

## Perché non è attivo nella v1

### Vercel Hobby ha timeout di 10 secondi

La generazione logo con Replicate Recraft-V3 richiede 20-40 secondi per immagine. Il piano Hobby tronca la Serverless Function a 10 secondi e la chiamata muore prima di ricevere il file.

### Costo AI non sostenibile in v1

Recraft-V3 costa circa 0,04€ per generazione. Senza un flusso di pagamento attivo (Stripe è v2), il costo lo assorbe il progetto e diventa negativo dopo pochi utenti attivi.

### Focus sulla validazione del modello

Meglio confermare che il builder templated (48 icone Lucide, 4 settori, 3 layout) copra il 90% dei casi reali prima di aggiungere il costo e la latenza dell'AI. Se il templated basta, l'AI può restare opzionale.

## Come attivarlo in v2

### 1. Upgrade piano Vercel

Passa a Vercel Pro (timeout Function sale a 60 secondi per la regione di deploy).

### 2. Configura il token Replicate

Vai su Vercel Dashboard, Settings, Environment Variables e aggiungi `REPLICATE_API_TOKEN` con scope Production e Preview.

### 3. Riattiva il tab AI

In `src/components/LogoEditor.tsx` sostituisci il placeholder in `aiPanelMessage` con il flusso Replicate:

- chiama `POST /api/logo/ai` con il prompt e i parametri
- mostra progress (la generazione è lenta)
- sostituisci `logo.builder` al termine

## Checklist prima di andare in produzione

- [ ] Variabile `REPLICATE_API_TOKEN` settata su Vercel (Production + Preview)
- [ ] Piano Vercel Pro attivo (60s timeout)
- [ ] Rate limit per-IP sul nuovo endpoint `POST /api/logo/ai` (es. 10 generazioni / ora)
- [ ] Costo AI tracciato per utente e mostrato nella Dashboard admin
- [ ] Watermark "AI" sul logo generato se l'utente è free tier (consistency con PDF)

## Riferimenti interni

- `src/utils/logoGenerator.ts`, builder SVG templated che la AI dovrà sostituire
- `src/components/LogoEditor.tsx`, `aiPanelMessage` da rimuovere
- `AGENTS.md`, sezione "Environment Variables" per la nota su `REPLICATE_API_TOKEN`
- `spec/spec-tool-phase4-logo-builder.md`, sezione 7 Rationale per il contesto originale
