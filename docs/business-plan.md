# Business plan: siti, stampati e identità visiva per attività locali
*Cagliari — giugno 2026*

---

## Il problema onesto da risolvere

Il servizio "branding per piccole imprese" esiste già in mille forme — Canva, Looka, VistaPrint, web agency locali, freelance su Fiverr, il nipote che sa usare il computer. Il motivo per cui questo mercato è affollato ma nessuno lo domina completamente è che il problema non è abbastanza urgente per la maggior parte delle piccole imprese la maggior parte del tempo.

I clienti pagano quando:
- Stanno **aprendo** un'attività e hanno una data fissa di apertura
- Hanno un **evento imminente** (stagione turistica, fiera, inaugurazione)
- Stanno **perdendo clienti** in modo visibile per mancanza di presenza online

Fuori da questi momenti, "ti sistemo il brand" è una vendita difficile. Il bar non chiude perché il logo è brutto. Questo deve condizionare tutta la strategia: non vendere branding generico, ma intercettare i tre momenti sopra.

---

## Proposta di valore

**"Tutto quello che serve per aprire o rilanciarti — pronto in 3 giorni."**

Biglietti da visita, volantino, QR menu o locandina, e sito vetrina con Google My Business. Pensato per chi ha una data, non per chi ci pensa da mesi.

Il vantaggio non è la grafica migliore del mondo — è la velocità e il fatto che non devono fare niente. Una web agency locale ci mette 2–4 settimane e costa €300–2.000+ solo per il sito. Canva richiede che siano loro a fare tutto. Questo servizio fa tutto, in 3 giorni, a un prezzo fisso e chiaro.

### AI come vantaggio competitivo

L'AI è attiva in **5 moduli su 6** (preventivo, bigliettino, volantino, logo, social) — solo il QR resta manuale per scelta tecnica. Il vantaggio non è "abbiamo l'AI" (ce l'hanno tutti), ma:

1. **AI contestualizzata per modulo**: la card AI conosce il grid 9-pos, la flyer AI rispetta density target e char budget per layout, la quote AI conosce i tool, la logo AI genera 3 concept + background Gemini con prompt Nano-Banana, la social AI legge card/flyer e genera post coordinati. Niente AI generica come Canva/Looka.
2. **Costo marginale sostenibile**: il piano Pro €9/mese include 1.000 prompt AI. Costo DeepSeek per 1.000 prompt ≈ €0.50-1 (flash), margine ~85-90%.
3. **Costo/prompt trascurabile sui pacchetti una tantum**: ~€0.01-0.03/prompt (flash) rende l'AI inclusa anche in Starter €49 sostenibile.

**Confronto competitor AI**:
- **Looka** (€18-88/anno): AI solo per logo, niente card/flyer/quote.
- **Canva Pro** (€12/mese, €144/anno): AI generica (Magic Design, Magic Write), non contestualizzata per modulo.
- **VistaPrint IT** (varia): niente AI, solo stampa.
- **Web agency** (€2.500-8.000): umana, lenta, niente AI.

Nessun competitor ha AI contestualizzata in 5 moduli con pricing integrato. Manteniamo questo vantaggio finché DeepSeek V4 resta competitivo sui costi (vedi sezione costi AI per proiezioni).

### Costi AI (DeepSeek V4)

Pricing V4 aggiornato (`api-docs.deepseek.com`, luglio 2026):

| Modello | Input cache miss | Input cache hit | Output |
|---------|-----------------|-----------------|--------|
| **V4-Flash** (default) | $0.14/M | $0.0028/M | $0.28/M |
| **V4-Pro** (premium) | $0.435/M | n/d | $0.87/M |

A luglio 2026: €1 ≈ $1.09. Costi in EUR per 1M token:
- V4-Flash: €0.13 input, €0.26 output (confermato dal BP, invariato).
- V4-Pro: €0.40 input, €0.80 output (nuovo, 3× flash).

**Stima costo per 1.000 prompt AI Pro €9/mese** (mix 70% flash, 30% pro, ratio input/output 60/40, cache hit 30%):
- Input: 1000 × 800 token × 70% × €0.13 + 1000 × 800 token × 30% × €0.40 = €72.8 + €96 = €168.8
- Cache hit savings: -30% × €168.8 = -€50.6
- Output: 1000 × 500 token × 70% × €0.26 + 1000 × 500 token × 30% × €0.80 = €91 + €120 = €211
- **Totale**: €168.8 - €50.6 + €211 = **€329.2 / M prompt** = **€0.33 per 1.000 prompt**

Margine Pro €9/mese: €9 - €0.33 = **€8.67 per utente Pro** (margine 96%). Stima precedente (€0.50-1) conservativa — margine reale più alto.

**Costi extra prompt** (oltre 1.000): €0.01/prompt cliente, costo €0.00033/prompt, margine 96.7%.



---

## Target clienti

### Primario: chi sta aprendo
Nuovi ristoranti, bar, B&B, studi professionali, negozi. Hanno una data di apertura, budget per l'avvio, e la pressione di apparire professionali da subito. Questo è il cliente con la massima urgenza e la più bassa resistenza al prezzo.

### Secondario: turismo stagionale sardo
B&B, affittacamere, case vacanze, guide turistiche. Ogni anno, in primavera, hanno l'urgenza di aggiornare materiali per la stagione. Strutture già avviate ma con materiali datati o assenti.

### Terziario: eventi e campagne
Locali che organizzano serate, sagre, eventi — bisogno urgente di locandine, volantini e post coordinati in pochi giorni.

### Chi NON è target (almeno all'inizio)
Imprese già strutturate con un'agenzia, professionisti che vogliono un sito complesso su misura, e-commerce, attività che "ci penso quando ho tempo" — questo ultimo profilo è la maggioranza delle piccole imprese, ma non compra.

---

## Offerta commerciale

### Modello a due livelli: subscription + pacchetti una tantum

L'offerta è strutturata in due modalità complementari:

1. **Piano mensile** (Pro): per chi usa l'app regolarmente e ha bisogno di AI. Costo ricorrente, copre i costi reali a token di DeepSeek e rimuove il watermark.
2. **Pacchetti una tantum** (Starter, Apertura, Presenza): per chi preferisce pagare una volta sola, senza abbonamento. Sblocco permanente, senza AI.

### Dettaglio piani

| Piano | Tipo | Contenuto | Prezzo | Valore di mercato |
|---|---|---|---:|---:|
| **Free** | per sempre | 10 documenti, watermark, 0 AI/mese | **€0** | — |
| **Pro** | /mese | Documenti illimitati, no watermark, 1.000 prompt AI/mese, extra €0.01/prompt | **€9/mese** | Costo AI coperto + watermark rimosso |
| **Starter** | una tantum | Documenti illimitati, no watermark, 300 DPI export (senza AI) | **€69** una tantum (o €49/anno) | €200-400 (1 anno Canva Pro) |
| **Apertura** | una tantum | Starter + landing/sito 1 pagina, file 300 DPI pronti per la tipografia (stampa a parte), consegna 3 giorni | **€349** una tantum | €1.200-1.800 |
| **Presenza** | una tantum | Apertura + sito 3-5 pagine, Google My Business, 3 grafiche social, consegna 3-5 giorni | **€690** una tantum | €3.500-5.000 |
| **Manutenzione** | /mese | Aggiornamenti sito, 1-2 grafiche, hosting gestito | **€49/mese** | €80-150/mese (agenzia) |
| **Custom** | una tantum | Pacchetto fuori lista concordato manualmente | su misura | — |

### Perché un piano Pro mensile?

L'AI (DeepSeek) ha un costo reale a token: ~€0.14/M input, ~€0.28/M output. Senza un piano che copra i costi AI:
- I free user possono generare 1000 prompt/mese a costo nostro
- Non c'è modo di coprire i costi operativi del modello AI
- Non c'è modo di offrire l'AI come feature sostenibile

Il piano **Pro a €9/mese** include 1.000 prompt AI con margine enorme (costo DeepSeek per 1.000 prompt ≈ €0.50-1, margine ~85-90%). Include anche la rimozione del watermark e documenti illimitati, rendendolo il pacchetto più attraente per l'utente medio.

**Alternativa per chi non vuole abbonamento:** Starter €49 una tantum per il solo sblocco watermark (senza AI). L'AI può essere aggiunta dopo con un piccolo extra.

### Regole commerciali

- 1 round di revisione incluso
- Consegna 3-5 giorni lavorativi per i pacchetti una tantum
- Formati PDF stampa + PNG web inclusi
- Rimborso fino al 50% se il risultato non ti piace (esclusi stampa e dominio già acquistati)
- L'AI Pro ha una quota di sicurezza: se superi i 1.000 prompt/mese, i successivi costano €0.01 cad. (Copre i costi DeepSeek)

> **Confronto prezzi onesto:** un'agenzia a Cagliari chiede €2.500-8.000 solo per il sito, con tempi di 2-4 settimane. Il pacchetto Presenza a €690 include sito + Google My Business + 3 grafiche + stampa = -80% rispetto al mercato. Il prezzo è basso perché gran parte del lavoro è automatizzato (template + AI), non artigianale. **Noi facciamo margine sul volume, non sul singolo progetto.**

> **Tier system (Phase 5):** il piano **Pro** e i pacchetti una tantum (Starter, Apertura, Presenza, Custom) mappano 1:1 sulle tipologie di `unlock_codes` nel database. Il piano **Free** (gratuito) consente fino a 10 documenti salvati con watermark visibile su export PDF, PNG e nelle preview live. L'admin può sbloccare direttamente un utente dalla dashboard (vedi `POST /admin/unlock-user` in `api/index.ts`) o generare codici dalla tab "Codici sblocco". Il cliente riscatta da Impostazioni → "Il mio account".

---

## Struttura dei costi

### Costi fissi mensili

| Voce | Costo |
|---|---|
| Hosting + database (Vercel Hobby + Neon free tier) | €0 |
| AI uso proprio (DeepSeek + Gemini + modelli migliori + harness dev) | €100 |
| OpenCode Go (assistente coding) | €9 |
| **Totale fisso** | **~€109/mese** |

### Costi variabili per cliente in retainer (manutenzione mensile)

| Voce | Costo stimato |
|---|---|
| AI per contenuti cliente (DeepSeek + Gemini) | €5–15 |
| Quota hosting (se si scala a Vercel Pro) | €3–5 |
| **Totale per cliente** | **€8–20/mese** |

**Nota sul €30/mese:** se si aggiungono funzionalità AI più pesanti per il cliente (chatbot, generazione automatica contenuti, aggiornamenti grafici mensili inclusi nel piano), il costo sale verso €25–35. In quel caso il retainer va prezzato di conseguenza — almeno €79/mese per mantenere il margine.

### Costo stampa (rivendita con margine)

| Prodotto | Costo acquisto | Prezzo al cliente | Margine |
|---|---|---|---|
| 250 biglietti da visita | ~€15 (Stampaprint) | a parte (file 300 DPI consegnati) | — |
| 250 volantini A5 | ~€25 (Pixartprinting) | a parte (file 300 DPI consegnati) | — |

**Decisione 2026-08-16:** la stampa NON è inclusa nel pacchetto Apertura.
Il cliente riceve i file 300 DPI pronti per la tipografia e stampa dove
preferisce. Motivi: (a) ~€40 di stampa = 11% del prezzo su €349, margine
già sottile; (b) zero logistica/ordini/errori tipografia; (c) il rimborso
"fino al 50%" resta pulito senza materiali fisici; (d) il cliente può
scegliere quantità e carta. La stampa resta disponibile come servizio
aggiuntivo su richiesta (rivendita con margine), non inclusa.

---

## Sostenibilità economica

### Obiettivo: €25/ora minimo

**Stima del tempo per progetto (flusso maturo con template):**
- Brief + setup: 30 min
- Generazione bozze AI + selezione: 45 min
- Raffinatezza + export: 45 min
- Sito base (boilerplate): 2–3 ore
- Comunicazione cliente: 30 min
- **Totale per pacchetto Apertura:** ~4–5 ore

A €349, su 4,5 ore = **€77/ora lordi** — ben sopra il target anche considerando i costi.
A €690 (Presenza), su 7-8 ore = **€86-99/ora** — margine eccellente.

**Stima del tempo per manutenzione mensile:**
- Aggiornamenti sito + 1–2 grafiche: ~1,5 ore/mese per cliente
- Retainer €49/mese, costo AI €12 → netto €37 per 1,5 ore = **€25/ora** (sopra il target minimo di €25/ora, ma margine ridotto)

### Scenario realistico mese tipo

| Fonte | Ricavo | Costo AI/stampa | Netto | Ore |
|---|---|---|---|---|
| 3 progetti "Apertura" (€349) | €1.047 | €0 (stampe a parte) | €1.047 | 14h |
| 2 progetti "Presenza" (€690) | €1.380 | €50 (stampe) | €1.330 | 16h |
| 8 clienti in manutenzione (€49) | €392 | €96 (AI) | €296 | 12h |
| Costi fissi | — | –€109 | –€109 | — |
| **Totale** | **€2.819** | | **€2.474** | **42h** |
| **Tariffa effettiva** | | | **€59/ora** ✅ | |

Il modello è sostenibile già con 3-5 progetti nuovi al mese e 8 clienti in manutenzione — un target raggiungibile entro 4-6 mesi di attività. La parte manutenzione (€49/mese) ha margine più basso ma garantisce cash flow ricorrente e relazione continuativa col cliente.

---

## Competitor (prezzi reali)

| Competitor | Prodotto | Prezzo | Differenza |
|---|---|---|---|
| Canva Pro | Self-service design | €12/mese | Il cliente fa tutto, nessuna esecuzione |
| Looka | Logo AI + brand kit | €18–88/anno | Solo digitale, nessun sito, nessuna stampa |
| VistaPrint IT | Biglietti 250 pz | ~€15 | Solo stampa, nessun design |
| Web agency Cagliari | Sito vetrina | €300–2.000+ (solo sito) | Solo sito, tempi 2–4 settimane |
| Web agency Milano/Roma | Sito aziendale 3-5pg | €2.500–8.000 | Premium, ma include design + dev |
| Freelance (Fiverr) | Logo | €20–80 | Solo logo, nessuna consegna coordinata |
| Stampaprint / VistaPrint | Stampa biglietti 250 | €15-50 | Solo stampa, no design |
| Canva Pro | Self-service design | €12/mese (€144/anno) | Il cliente fa tutto |

Nessun competitor offre la combinazione completa (design + stampa + sito + manutenzione) in 3 giorni a un prezzo fisso sotto €700. Questo è lo spazio.

---

## SWOT onesto

| | Elementi |
|---|---|
| **Strengths** | Velocità (72h reali); pacchetti a prezzo fisso; stampa inclusa; tutto in uno; costi operativi bassi |
| **Weaknesses** | Problema non urgente per la maggior parte dei clienti; rischio revisioni infinite; dipendenza dal tempo manuale; nessuna barriera all'ingresso per imitatori |
| **Opportunities** | Aperture di nuove attività (picco in primavera/settembre); turismo stagionale sardo; pochi competitor con offerta "tutto in uno" veloce |
| **Threats** | Canva sempre più potente; AI che democratizza ulteriormente il design; "mio cugino lo fa gratis"; difficoltà a farsi trovare senza brand awareness |

---

## Go-to-market

### Canale 1: intercettare le aperture
Camera di Commercio di Cagliari — la lista delle nuove SCIA e iscrizioni CCIAA è pubblica. Contatto diretto alle nuove aperture con offerta specifica: "Hai aperto di recente? Biglietti, sito e volantini pronti in 3 giorni."

### Canale 2: stagionalità turistica
Aprile–maggio: contattare B&B e affittacamere con materiali datati su Booking/Airbnb. Offerta: "Aggiorna la tua presenza per la stagione estiva."

### Canale 3: portfolio verticale
5–8 esempi reali o verosimili per settore (ristorante, B&B, studio professionale, negozio). Senza portfolio, non c'è credibilità. Falli prima di fare outreach.

### Canale 4: referral
Ogni cliente soddisfatto in una piccola città è potenzialmente 3–5 referral. Cagliari è una città dove ci si conosce — una buona reputazione locale si propaga rapidamente.

### Cosa non fare subito
Ads a pagamento, social media intensivi, marketplace. Prima validare che qualcuno paga, poi investire in acquisizione.

---

## Piano di validazione (primi 60 giorni)

1. Scegliere un verticale: ristoranti e bar in apertura a Cagliari
2. Creare 5 esempi credibili per quel settore
3. Identificare 20–30 nuove aperture recenti (CCIAA o giro fisico)
4. Contatto diretto con offerta chiara e prezzo fisso
5. Obiettivo: 2 clienti paganti nei primi 30 giorni

Se 2 clienti su 30 contatti convertono (~7%), il modello regge. Se nessuno converte, il problema è il messaggio o il target — non i costi.

---

## Tier System — Coerenza tecnica con Phase 5

La spec tecnica Phase 5 del progetto implementa esattamente questo modello commerciale. Di seguito la mappatura 1:1 tra offerta commerciale e implementazione tecnica:

| Offerta commerciale | Implementazione tecnica (`db/schema.ts` + `api/index.ts`) |
|---|---|
| **Free** (default) | `user_settings.tier = 'free'`, `documentCount` parte da 0, limite 10 (`FREE_DOCUMENT_LIMIT`) |
| **Starter** €49 | `unlock_codes.package = 'starter'` → `tier = 'unlocked'`, no watermark, 300 DPI |
| **Apertura** €349 | `unlock_codes.package = 'apertura'` + stampa inclusa |
| **Presenza** €690 | `unlock_codes.package = 'presenza'` + Google My Business + social |
| **Custom** | `unlock_codes.package = 'custom'` (manuale) |
| **Admin** (interno) | `admin@gmail.com` → short-circuit a `unlocked` implicito |

**Meccanismi tecnici chiave:**

- **Generazione codici:** admin crea codici formato `QB-<8hex>-<8hex>-<8hex>` dalla Dashboard Admin → tab "Codici sblocco" (`POST /api/admin/generate-unlock-code`). Codici legacy `PQ-` restano validi in redeem.
- **Redeem:** utente inserisce codice in Impostazioni → "Il mio account" (`POST /api/users/redeem-code`). Race-condition safe via `WHERE used_by IS NULL` atomico
- **Watermark anti-bypass:** applicato in 3 punti:
  1. Export PDF (pdfmake background function) — invisibile da rimuovere post-generation
  2. Export PNG (Canvas 2D, post-drawImage)
  3. Preview live (overlay SVG diagonale con `pointer-events: none`) — copre anche gli screenshot
- **DPI gate:** PDF 300→150 DPI per free; PNG 300→72 DPI per free; lato PNG clampato a 1200px free vs 4096px unlocked
- **Document limit enforcement:** `useDocumentSave` hook wrappa `dataService.saveDocument` con `checkDocumentLimit()`; TierLimitModal appare automaticamente all'11° tentativo
- **Admin short-circuit:** `admin@gmail.com` ha tier `unlocked` implicito senza row in `user_settings` (FK constraint) — coerente con tutti gli altri admin short-circuit del progetto
- **Security:**
  - Rate limit redeem: 5 tentativi / 15min per IP
  - Validazione Zod su tutti gli endpoint
  - Codici case-insensitive nel lookup, salvati in uppercase
  - No log del codice (logger client filtra `code`)

**Costo operativo del tier system:**

| Voce | Costo aggiuntivo stimato |
|---|---|
| DB column extra (`tier`, `unlock_code`, `unlocked_at`, `document_count`) | €0 (Neon free tier ha margine) |
| Tabella `unlock_codes` (~50 righe/anno) | €0 |
| Codice JS watermark (no AI) | €0 |
| 5 nuovi endpoint API | €0 (inline nella funzione esistente) |
| **Totale** | **€0/mese** |

Il tier system è interamente **mechanical** (no AI, no Stripe, no webhook). Costo marginale zero. Il modello commerciale può essere validato senza overhead tecnico.

---

## Roadmap post-validazione (oltre 60 giorni)

Dopo il periodo di validazione iniziale (60 giorni, 2 clienti paganti, vedi sopra), la roadmap per scalare il business:

### Q1 post-validazione (3-6 mesi)

- **Stripe Checkout automatico**: trigger quando 15+ transazioni/mese O retainer > €500/mese. Setup stimato 20 ore (skill `vercel-serverless-monolith` disponibile). Tabella `payments` + endpoint `/api/checkout` + `/api/stripe/webhook`. Costo Stripe 1.5% + €0.25 EU.
- **AI Logo v2**: ~~abilitare tab AI in `LogoEditor.tsx` con `REPLICATE_API_TOKEN` (Recraft-V3).~~ ✅ **GIÀ FATTO** (v2.1/v2.2, luglio 2026): Logo AI attivo con DeepSeek (3 concept) + Gemini Nano Banana (background). Replicate non più necessario.
- **Multi-provider AI**: aggiungere OpenAI/Anthropic in `providerRegistry` come fallback. DeepSeek resta default per costo. Setup ~10 ore.

### Q2-Q3 post-validazione (6-12 mesi)

- **Social AI module** (cross-module): generatore 3 social post coordinati col bigliettino/volantino. Nuovo `documentType: 'socialPack'`, route `/app/social`. Spec già scritta. Setup ~25 ore.
- **Onboarding AI assist**: suggerimenti displayName/company/profession in `OnboardingModal` step 0. Spec già scritta. Setup ~8 ore.
- **Manutenzione scale-up**: da €49/mese a €79/mese quando funzionalità AI più pesanti incluse (chatbot cliente, generazione automatica contenuti mensili, aggiornamenti grafici ricorrenti). Costo AI sale a €25-35/mese, retainer €79 mantiene margine.

### Q4+ post-validazione (12+ mesi)

- **Fatturazione elettronica italiana**: Fatture in Cloud API o Aruba, integrata con pagamenti Stripe. Compliance IVA + ritenute.
- **Multi-tenant white label**: licenza dell'app ad altre web agency come "Quickbrand for X", revenue share 70/30.
- **Marketplace template community**: utenti pubblicano template di flyer/card/logo, monetizza con fee 30% sulle vendite.

### Criteri di priorità

Le feature in Q1+Q2 sono già **specificate** (vedi cartella `spec/`). Le feature in Q4+ sono ancora conceptuali. Costo cumulato setup Q1+Q2: ~95 ore sviluppo, sostenibile con 1 sviluppatore part-time + founder.

---

## Raccomandazione finale

Il modello è economicamente sostenibile — i conti tornano già con 3 progetti al mese. Il rischio reale non è tecnologico né finanziario, ma commerciale: riuscire a trovare clienti con urgenza reale, non solo interesse generico.

La versione più forte di questo business non è "agenzia di branding per PMI", ma qualcosa di molto più specifico: il pacchetto che compri quando stai aprendo o quando hai una stagione davanti. Più si stringe la promessa su un momento preciso, più diventa facile vendere e più il cliente percepisce il valore.

Costruisci prima il flusso manuale su 5 clienti reali. Solo dopo automatizzare.

> **Nota implementativa:** il tier system Phase 5 è completato tecnicamente (1722/1722 test verdi, typecheck pulito, 11 fasi implementate, 15 spec tecniche, 13 SKILL.md di coding). Il flusso commerciale end-to-end è pronto per essere validato: admin genera codice → cliente riscatta → tier passa a `unlocked` → watermark rimosso. La parte commerciale (marketing, vendita, delivery) resta il collo di bottiglia.

---

## Pagamenti: perché NON c'è Stripe (per ora)

L'utente si aspetta "Stripe corretto" ma **Stripe non è implementato in v1** per scelta deliberata, non per dimenticanza. Ecco perché:

### Perché rimandare Stripe
1. **Costo di integrazione non banale.** Stripe richiede: account Stripe verificato (KYC, IBAN, partita IVA), webhook handler su Vercel, gestione pagamenti falliti, rimborsi, fatturazione elettronica italiana, compliance GDPR del pagamento, gestione abbonamenti ricorrenti (Stripe Billing). Sono 2-3 settimane di lavoro.
2. **Il modello attuale è più semplice e funziona.** Codice una tantum via email + bonifico/PayPal manuale. Volume basso (0-10 clienti/mese nei primi mesi) non giustifica l'overhead.
3. **Meglio validare prima il mercato.** Se in 6 mesi ho 2 clienti paganti reali, ho validato il modello. Se ne ho 20, allora ha senso investire in Stripe.
4. **Personal touch nei primi mesi è un vantaggio.** Il founder che risponde alle email, manda il codice, segue il cliente è relazione. Quando si scala, Stripe automatizza.

### Cosa succede manualmente ora
1. Cliente contatta via email "Voglio il pacchetto X"
2. Admin risponde con: prezzo, cosa include, tempi di consegna
3. Cliente paga con bonifico o PayPal "Friends & Family"
4. Admin genera il codice in dashboard
5. Admin manda il codice al cliente via email
6. Cliente va su Impostazioni → "Il mio account" → "Riscatta codice"
7. Tier passa a `unlocked` automaticamente
8. Watermark rimosso da export e preview

### Cosa serve per aggiungere Stripe (v2)
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` su Vercel
- Nuova tabella `payments` con `stripe_session_id`, `amount`, `status`
- Endpoint `POST /api/checkout` che crea Stripe Checkout Session
- Endpoint `POST /api/stripe/webhook` che riceve `checkout.session.completed` → genera codice automaticamente
- Subscription management per il retainer €49/mese (Stripe Billing)
- Fatturazione elettronica italiana (Fatture in Cloud, Aruba, o sistema integrato)
- **Costo Stripe:** 1.5% + €0.25 per transazione EU + 0.5% per transazioni intra-EU (carta europea)

### Costo attuale gestione manuale
- **Tempo admin per generare codice:** 2 minuti
- **Tempo admin per rispondere email:** 5-10 minuti
- **Totale per transazione:** ~10 minuti di lavoro umano
- Per 5 clienti/mese = 50 minuti/mese di overhead manuale → accettabile per la fase di validazione

### Quando passare a Stripe
- **Soglia trigger:** 15+ transazioni/mese **OPPURE** retainer attivi > €500/mese
- **Costo opportunità:** se il tempo admin per i pagamenti supera 2 ore/settimana
- **Costo setup:** ~20 ore sviluppo + test + deploy + 1 settimana di monitoraggio
- **Costo running:** 1.5-2% di commissione Stripe + manutenzione webhook

### Out of scope v1
- Stripe Checkout automatico
- Subscription management (Stripe Billing)
- Fatturazione elettronica
- Rimborsi automatici
- VAT MOSS/OSS compliance

---

## Conferma tier system (admin e utenti paganti)

L'utente chiede conferma esplicita: **admin e chi paga hanno watermark?**

Risposta breve: **NO, mai.**

### Come funziona tecnicamente

1. **Admin (`admin@gmail.com`)**:
   - `tier = 'unlocked'` short-circuit nel backend (vedi `api/index.ts` handler `/users/tier`)
   - `tier = 'unlocked'` short-circuit nel client (`useContext(AppContext)` in `AppContext.Provider` di `AppShell.tsx`)
   - NON ha row in `user_settings` (FK constraint a `users.email` che non lo contiene) — coerente con tutti gli altri admin short-circuit
   - Preview live: nessun watermark overlay (perché `tier = 'unlocked'`)
   - Export PDF/PNG: nessun watermark pdfmake/canvas (perché `tier = 'unlocked'`)
   - Documenti illimitati, nessun limite 10

2. **Utente con codice riscattato** (chi paga):
   - Dopo `POST /users/redeem-code` con codice valido → `tier = 'unlocked'` salvato in `user_settings.tier`
   - Stesso path dell'admin per export e preview
   - `documentCount` non ha più limite (può salvare infiniti documenti)

3. **Free user** (senza account, o con account senza redeem):
   - `tier = 'free'` (default in `user_settings.tier`)
   - `documentCount` parte da 0, limite 10
   - Watermark overlay su preview live (DOM SVG, anti-screenshot)
   - Watermark pdfmake in export PDF (background + footer)
   - Watermark canvas in export PNG (post-drawImage)
   - DPI gate: 150 (PDF) / 72 (PNG), lato PNG clampato a 1200px

### Verificabile manualmente

Per confermare che admin/paid non hanno watermark:

```bash
# 1. Admin login (VITE_ADMIN_PASSWORD in .env)
# → Preview QR/Card/Logo: nessun watermark
# → Export PNG/PDF: nessun watermark

# 2. Free user, poi TEST-UNLOCK in Impostazioni → Il mio account
# → Tier passa a "Sbloccato"
# → Preview: nessun watermark
# → Export: nessun watermark

# 3. Test codice: crea nuovo account free, salva 10 doc, prova l'11°
# → TierLimitModal appare automaticamente (free limit reached)
# → Inserisci TEST-UNLOCK
# → Modal chiude, tier unlocked, salvataggio riesce
```

### Codice rilevante

- `src/utils/watermark.ts` riga 65: `if (tier === 'unlocked') return doc;` (no-op)
- `src/utils/watermark.ts` riga 105: `if (tier === 'unlocked') return;` (no-op canvas)
- `src/components/PreviewWatermark.tsx` riga 22: `if (tier === 'unlocked') return null;` (no overlay)
- `api/index.ts` riga 644: `if (email === ADMIN_EMAIL) { return unlocked, documentLimit: null };`
- `src/components/AppShell.tsx` riga 119: `if (user.email === 'admin@gmail.com') { setTier('unlocked'); }`

---
---

# Appendice luglio 2026: analisi mercato, marketing e strategia

Aggiornamento del BP con dati di mercato verificati (luglio 2026), costi Meta Ads, strategia sito web, modello servizio fatto-per-te e gestione collaborazioni.

---

## A. Analisi TAM / SAM / SOM

Fonti dati: Movimprese/Unioncamere (~330k nuove iscrizioni/anno Italia, ~8-9k Sardegna, imprese attive Italia ~4.4M, Sardegna ~140k), WordStream, pricing competitor live.

| Livello | Definizione | Dimensione | Valore/anno |
|---|---|---|---|
| **TAM** (Total Addressable Market) | Piccole imprese italiane che comprano branding/web/print. 4.4M imprese, spesa media €400-1.000 ogni 2-3 anni | ~1.5M acquisti/anno | **~€800M-1.2B** |
| **SAM** (Serviceable Available Market) | Occasioni *urgenti* nella fascia prezzo €49-700: nuove aperture rilevanti (~130k/anno su 330k totali, ~40% servizi/commercio/turismo) + rinnovi stagionali turismo (~200k strutture ricettive × 15%/anno = 30k) + eventi/campagne (~40k) | **~200k occasioni/anno** | **~€60M** (a €300 medi) |
| **SOM** (Serviceable Obtainable Market, 3 anni) | Quota ottenibile da founder solo + AI: anno 1 Cagliari (30-50 clienti), anno 2 Sardegna + primi online (100-150), anno 3 online Italia (250-400) | 400 clienti anno 3 | **€120-200k ricavi anno 3** |

**Lettura:** il SOM anno 3 è ~0.3% del SAM — ambizioso ma non fantasioso. Il vincolo non è il mercato (c'è) ma la capacità di vendita/delivery: a 400 clienti/anno servono ~1.600 ore di delivery → a quel punto o si alzano i prezzi o si automatizza (ed è esattamente quando il SaaS diventa la gamba principale).

**Nota di realismo:** lo scenario "mese tipo" (€2.819 netti) di questo BP è il mese 6-8 nella migliore ipotesi, non il mese 1. I primi 90 giorni realisticamente fatturano €0-700. Conversione cold outreach: 2-4% su contatti caldi, 0.5-1% su email fredde (il 7% ipotizzato nel piano di validazione è ottimistico).

---

## B. Competitor aggiornati (luglio 2026, prezzi verificati live)

| Player | Offerta | Prezzo | Minaccia | Note |
|---|---|---|---|---|
| **Durable** | Sito AI in 30s + logo + CRM + blog agent | Free / $25/m Launch / $49/m Grow | 🔴 Alta | 3M+ business. Ma: no stampa, no italiano, self-service |
| **Canva Pro** | Magic Studio AI generico | €12/mese | 🔴 Alta | Ubiquo, ma self-service: il nostro cliente non vuole fare da sé |
| **10Web / Hostinger AI** | Siti WordPress AI | €3-30/mese | 🟡 Media | Prezzo aggressivo su hosting |
| **Looka** | Logo AI + brand kit | $20-65 una tantum / $96-129/anno | 🟡 Media | Solo logo, niente sito/stampa |
| **Brandmark** | Logo AI one-time | $25-175 una tantum | 🟢 Bassa | Pay once, forever |
| **Tailor Brands** | LLC + branding (US) | $199-249/anno | 🟢 Bassa | US-centric, irrilevante in Italia |
| **VistaPrint** | Stampa + design base | €15-50 | 🟡 Media | Solo stampa |
| **Agenzie locali** | Sito + brand | €1.200-8.000 | 🟢 Bassa sul prezzo, 🔴 alta sulla fiducia | 2-4 settimane di consegna |

**Lo spazio resta intatto:** nessun operatore in Italia fa *esecuzione completa* (design AI + stampa + sito) in 72h a prezzo fisso sotto €700. Durable è il più vicino concettualmente ma è self-service, in inglese, senza stampa e senza umano.

**Sul rischio "amici che fanno la stessa app":** un SaaS self-service generico (grafica+siti con AI) nel 2026 compete con Durable/10Web/Mixo/Wix ADI/Framer AI — player con $20M+ di funding e team da 50+ persone. Senza funding è una guerra persa. Le uniche vie per un competitor nuovo: (1) verticale stretta (solo wedding, solo palestre, solo dentisti — l'AI contestualizzata per UN settore batte quella generica), (2) service business come questo BP. Vedi sezione F per come gestire la collaborazione.

---

## C. Servizio fatto-per-te (done-for-you): il modello operativo

Il servizio fatto-per-te è la gamba di ricavo principale nei primi 12 mesi. L'app Quickbrand è lo *strumento interno* che permette di consegnare in 3 giorni ciò che un'agenzia consegna in 3 settimane. L'app è il vantaggio di costo, non il prodotto venduto.

### Il prodotto venduto: UN solo eroe

**"Stai aprendo? In 3 giorni hai biglietti, volantini stampati, logo e sito. €349."**

Un'offerta sola, un prezzo solo, una pagina sola. Starter/Presenza/Manutenzione esistono ma si propongono solo dopo, in upsell. Ogni opzione extra in fase di vendita dimezza la conversione.

### Workflow delivery (pacchetto Apertura, target ≤5 ore)

| Step | Tempo | Strumento |
|---|---|---|
| 1. Brief (form online o call 15 min) | 30 min | Form dedicato |
| 2. Logo: 3 concept AI → scelta cliente | 45 min | LogoEditor AI (DeepSeek+Gemini) |
| 3. Card + flyer: generazione AI → selezione | 60 min | CardEditor + FlyerEditor AI |
| 4. Raffinatezza + export print-ready | 45 min | Export 300 DPI |
| 5. Landing 1 pagina (da dati flyer) | 60-90 min | Boilerplate/template |
| 6. Ordine stampa + consegna file | 30 min | Pixartprinting/Stampaprint |
| **Totale** | **~4,5-5h** | |

A €349 su 4,5h = **€77/ora lordi**. Il rischio unico: revisioni infinite. Regola scritta ovunque: **1 round di revisione incluso, poi €25/round**.

### Script vendita (contatto diretto nuove aperture)

> "Ciao, ho visto che aprite tra poco [da lista CCIAA / insegna in allestimento]. Io faccio il pacchetto apertura: biglietti da visita, 250 volantini stampati, logo e sito — pronto in 3 giorni, €349 tutto incluso. Ti mando due esempi di lavori fatti per [settore]? Se ti piacciono partiamo questa settimana."

Tre elementi: (1) dimostra di sapere che stanno aprendo (personalizzato, non spam), (2) prezzo detto subito (filtra i non-target), (3) prova (portfolio settore). Se rispondono "quanto costa?" hai già perso: il prezzo va detto PRIMA che lo chiedano.

### Upsell naturale (dopo consegna)

- Mese 1: "Ti serve anche Google Business Profile + 3 grafiche social? €341 e hai il pacchetto Presenza completo."
- Mese 2: "Aggiornamenti sito + 1 grafica/mese, €59/mese" (manutenzione — venduta solo a chi hai già servito, mai a freddo: margine €25-35/ora ma cash flow ricorrente).
- Referral meccanico: ogni pacchetto include 50 biglietti extra + "porta un amico, -20% per entrambi". A Cagliari il passaparola batte qualsiasi ads.

---

## D. Meta Ads (Instagram/Facebook): costi reali di una campagna fatta bene

Benchmark (WordStream, giugno 2026, dati US; l'Italia è tipicamente -30/50% su CPC/CPM):

| Metrica | Media US (tutti i settori) | Servizi consumer US | **Stima realistica Italia locale** |
|---|---|---|---|
| CPC (costo per click) | $1.72 | $3.08 | **€0.40-1.00** |
| CTR | 0.90% | 0.62% | 0.8-1.5% |
| CPA (costo per lead/azione) | $18.68 | $31.11 | **€8-20** |
| CPM (costo per 1000 impression) | ~$10-15 | ~$15-20 | **€4-9** |

### Budget campagna test (fase validazione, 1 mese)

| Voce | Costo |
|---|---|
| Budget ads (€10/giorno × 30 gg) | €300 |
| Creatività (3-5 varianti, fatte in casa con Quickbrand stesso) | €0 |
| Landing page (la tua, già esistente) | €0 |
| Pixel Meta + setup account | 2h tempo |
| **Totale mese 1** | **€300 + 4-6h** |

**Risultato atteso mese 1:** 30-60k impression geo-target Cagliari, 300-750 click, 15-40 lead, 1-3 clienti paganti. Con 2 clienti Apertura (€698) la campagna si ripaga 2.3×. Sotto 1 cliente: spegni e torna all'outreach diretto (che resta il canale primario).

### Struttura campagna consigliata

1. **Obiettivo: Lead Generation** (form nativo Meta, non conversioni su sito) — i lead form Meta costano 30-50% in meno e per servizi locali convertono meglio. Campi: nome, telefono, "quando apri?"
2. **Targeting:** raggio 25km Cagliari, 25-55 anni, interessi "piccola impresa/imprenditoria/ristorazione". Niente lookalike finché non hai 50+ clienti.
3. **Creatività:** carosello prima/dopo (branding brutto → branding Quickbrand), testo "Apri tra poco? Tutto pronto in 3 giorni, €349". La creatività conta più del targeting nel 2026 (Advantage+ gestisce già il resto).
4. **Stagionalità:** budget concentrato feb-mag (aperture + pre-stagione turistica) e set-ott. Q4 (nov-dic) costa +40% per l'e-commerce — ridurre.

### Quando ha senso spendere di più

- Scala a €20-30/giorno solo se CPA < €25 e almeno 2 mesi consecutivi in positivo.
- Sopra €1.000/mese di budget valuta un media buyer freelance (€300-500/mese di fee) — sotto quella cifra gestisci da solo, il margine non copre il professionista.
- **Regola:** non spendere in ads prima di avere 5 consegne reali fatte bene. Le ads amplificano ciò che esiste; se il delivery è fragile, comprano solo insoddisfazione più in fretta.

---

## E. Sito web: design e automazione

### Cosa serve al business (non al cliente)

Il sito Quickbrand stesso è oggi l'app. Per vendere il servizio serve una **landing pubblica** separata (o la HomePage esistente adattata): 1 offerta (Apertura €349), 3-5 esempi portfolio, form contatto/WhatsApp, 3 recensioni. Costa 0€ se fatta in casa (la HomePage AIDA di Phase 13b è già l'80% del lavoro). Un designer freelance per una landing custom costerebbe €300-800 — spreco in fase di validazione.

### Gap prodotto: il cliente vuole il sito *pubblicato*, non i file

Questo è il gap più grosso vs Durable: loro pubblicano siti, noi generiamo documenti. Nel pacchetto Apertura oggi "sito 1 pagina" è lavoro manuale (2-3h). Soluzioni in ordine di effort:

| Approccio | Come | Effort | Costo ricorrente |
|---|---|---|---|
| **1. Boilerplate manuale** (ora) | Template HTML statico, compili a mano, deploy Netlify/Vercel free | 0h dev, 2-3h/cliente | €0 |
| **2. Landing generator interno** | Nuovo modulo app: da dati flyer → HTML statico → export ZIP. Tu deployi per il cliente | ~40h dev, 30 min/cliente | €0 |
| **3. Publish 1-click** | Modulo + API Vercel: deploy automatico su `nome.quickbrand.it` o dominio cliente | ~80h dev, 5 min/cliente | €0-20/anno per dominio |
| **4. Builder self-service** | Il cliente edita la sua landing nell'app | 200h+ dev | — fuori scope anno 1 |

**Raccomandazione:** step 2 subito (Q3 2026), step 3 quando hai 5+ siti/mese. Lo step 4 è la trappola: diventare un website builder generico = competere con Durable.

### Funzionalità utili da integrare (priorità)

| # | Feature | Perché | Effort |
|---|---|---|---|
| 1 | Stripe Checkout | Vendita online senza email manuali (spec esistente) | ~20h |
| 2 | Landing generator (step 2 sopra) | Chiude il gap vs Durable nel pacchetto Apertura | ~40h |
| 3 | QR menu ristoranti | Verticale forte del target (bar/ristoranti): QR → menu PDF/landing | ~15h |
| 4 | Google Business Profile helper | Checklist/export dati GMB (è nel pacchetto Presenza ma oggi manuale) | ~10h |
| 5 | Multi-lingua EN/DE export | Turismo Sardegna = tedeschi/inglesi, i B&B pagano per questo | ~20h |
| 6 | Fatturazione elettronica | Solo dopo €30k/anno fatturato | post |
| 7 | White label per agenzie | Solo quando 3+ agenzie chiedono | post |

**NON fare:** marketplace template, chatbot clienti, app mobile, website builder generico. Distrazioni che consumano il vantaggio di velocità.

---

## F. Collaborazioni senza cedere quote dell'azienda

Scenario: una persona propone di "fare insieme" un progetto simile, ma l'asset di valore (l'app, il brand, i clienti) deve restare di una sola proprietà. Strutture possibili senza equity:

| Modello | Come funziona | Quando usarlo | Rischio |
|---|---|---|---|
| **Revenue share su progetto** | X% (10-25%) sui ricavi dei clienti che la persona porta, per 12-24 mesi | Collaboratore commerciale | Basso: niente clienti = niente costo |
| **Fee fissa a progetto** | €Y fisso per ogni pacchetto venduto/consegnato | Delivery partner | Basso |
| **Licenza d'uso** | La persona usa l'app per i SUOI clienti, paga fee mensile o per progetto | Chi vuole fare il suo business parallelo | Medio: serve contratto chiaro su IP |
| **Partnership su verticale nuovo** | Collaboratore sviluppa un settore (es. wedding) con brand condiviso, rev share 70/30 | Espansione senza tempo proprio | Medio-alto: definire uscita |
| **Semplice fornitura** | Paghi ore di lavoro a tariffa, niente percentuali | Competenze tecniche spot | Nullo |

**Regole di protezione (valide sempre):**
1. **IP dell'app: mai in discussione.** Il codice resta di chi l'ha scritto. Qualsiasi collaborazione è sui *ricavi*, non sull'*asset*. Contratto scritto (anche semplice, ma scritto) che dice: l'app, il brand Quickbrand e il codice restano di proprietà esclusiva; la collaborazione copre solo [definire].
2. **Cliente di chi è di chi.** Se il collaboratore porta il cliente, rev share su quel cliente per X mesi, poi basta. I clienti acquisiti dall'azienda restano dell'azienda.
3. **Niente esclusiva reciproca lunga.** Massimo 6-12 mesi, rinnovabile.
4. **Campanelli d'allarme su persona "ambigua":** chiede accesso admin al codice/server "per imparare"; vuole quote "perché l'idea era mia" (le idee non valgono niente, vale l'esecuzione — e l'esecuzione qui è 2.100+ test e mesi di lavoro); propone di registrare dominio/partita IVA "insieme"; parla di percentuali prima di aver portato un solo cliente.
5. **Test pratico:** proponi il modello 1 (rev share su clienti portati). Chi porta valore reale accetta: è la struttura più win-win. Chi punta all'asset rifiuta — e hai la risposta che cercavi.

**Alternativa se la persona ha competenze complementari forti (es. vendita):** valuta un "founder commerciale" con vesting su *nuova entità* separata (non sull'app): nuova SRL dove l'app entra in licenza, quote 70/30 o 60/40 con vesting 4 anni. Ma solo dopo 3-6 mesi di collaborazione provata su progetti reali, mai a scatola chiusa.

---

## G. Piano aggiornato: prossimi 90 giorni

| Settimana | Azione | Obiettivo |
|---|---|---|
| 1-2 | Portfolio: 5 esempi settore (ristorante, B&B, bar, negozio, studio) fatti con l'app | Credibilità |
| 2-3 | Landing vendita Apertura €349 (HomePage adattata) + form contatto | Conversione |
| 3-6 | 30 contatti diretti nuove aperture (CCIAA + giro fisico) | 1-2 clienti paganti |
| 4 | Prima consegna Apertura, cronometrata | Validare ≤5h delivery |
| 6-8 | Meta Ads test €300 (solo se ≥1 consegna fatta) | CPA < €25 |
| 8-12 | 3-5 consegne totali + primo upsell manutenzione | €1.000-1.500 ricavi |

Gate di validazione invariato: **2 clienti paganti su 30 contatti entro 60 giorni**. Se non accade, il problema è messaggio/target, non il prodotto.
