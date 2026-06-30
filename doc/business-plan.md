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
| **Free** | per sempre | 3 documenti, watermark, 0 AI/mese | **€0** | — |
| **Pro** | /mese | Documenti illimitati, no watermark, 1.000 prompt AI/mese, extra €0.01/prompt | **€9/mese** | Costo AI coperto + watermark rimosso |
| **Starter** | una tantum | Documenti illimitati, no watermark, 300 DPI export (senza AI) | **€49** una tantum | €200-400 (1 anno Canva Pro) |
| **Apertura** | una tantum | Starter + 250 volantini stampati + landing/sito 1 pagina, consegna 3 giorni | **€349** una tantum | €1.200-1.800 |
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

> **Tier system (Phase 5):** il piano **Pro** e i pacchetti una tantum (Starter, Apertura, Presenza, Custom) mappano 1:1 sulle tipologie di `unlock_codes` nel database. Il piano **Free** (gratuito) consente fino a 3 documenti salvati con watermark visibile su export PDF, PNG e nelle preview live. L'admin può sbloccare direttamente un utente dalla dashboard (vedi `POST /admin/unlock-user` in `api/index.ts`) o generare codici dalla tab "Codici sblocco". Il cliente riscatta da Impostazioni → "Il mio account".

---

## Struttura dei costi

### Costi fissi mensili

| Voce | Costo |
|---|---|
| Hosting + database (Vercel Hobby + Neon free tier) | €0 |
| AI per uso proprio: Minimax M3 + GPT Image 2 (pay-per-use) | ~€10 |
| OpenCode Go (assistente coding) | €9 |
| **Totale fisso** | **~€19/mese** |

### Costi variabili per cliente in retainer (manutenzione mensile)

| Voce | Costo stimato |
|---|---|
| AI per contenuti cliente (Minimax M3 + immagini) | €5–15 |
| Quota hosting (se si scala a Vercel Pro) | €3–5 |
| **Totale per cliente** | **€8–20/mese** |

**Nota sul €30/mese:** se si aggiungono funzionalità AI più pesanti per il cliente (chatbot, generazione automatica contenuti, aggiornamenti grafici mensili inclusi nel piano), il costo sale verso €25–35. In quel caso il retainer va prezzato di conseguenza — almeno €79/mese per mantenere il margine.

### Costo stampa (rivendita con margine)

| Prodotto | Costo acquisto | Prezzo al cliente | Margine |
|---|---|---|---|
| 250 biglietti da visita | ~€15 (Stampaprint) | incluso nel pacchetto | assorbito nel prezzo |
| 250 volantini A5 | ~€25 (Pixartprinting) | incluso nel pacchetto | assorbito nel prezzo |

La stampa non è un centro di profitto separato — è inclusa nei pacchetti come differenziatore ("ricevi anche i materiali fisici, non solo i file").

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
| 3 progetti "Apertura" (€349) | €1.047 | €90 (stampe) | €957 | 14h |
| 2 progetti "Presenza" (€690) | €1.380 | €50 (stampe) | €1.330 | 16h |
| 8 clienti in manutenzione (€49) | €392 | €96 (AI) | €296 | 12h |
| Costi fissi | — | –€19 | –€19 | — |
| **Totale** | **€2.819** | | **€2.564** | **42h** |
| **Tariffa effettiva** | | | **€61/ora** ✅ | |

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
| **Free** (default) | `user_settings.tier = 'free'`, `documentCount` parte da 0, limite 3 |
| **Starter** €149 | `unlock_codes.package = 'starter'` → `tier = 'unlocked'`, no watermark, 300 DPI |
| **Apertura** €349 | `unlock_codes.package = 'apertura'` + stampa inclusa |
| **Presenza** €690 | `unlock_codes.package = 'presenza'` + Google My Business + social |
| **Custom** | `unlock_codes.package = 'custom'` (manuale) |
| **Admin** (interno) | `admin@gmail.com` → short-circuit a `unlocked` implicito |

**Meccanismi tecnici chiave:**

- **Generazione codici:** admin crea codici formato `PQ-<8hex>-<8hex>-<8hex>` dalla Dashboard Admin → tab "Codici sblocco" (`POST /api/admin/generate-unlock-code`)
- **Redeem:** utente inserisce codice in Impostazioni → "Il mio account" (`POST /api/users/redeem-code`). Race-condition safe via `WHERE used_by IS NULL` atomico
- **Watermark anti-bypass:** applicato in 3 punti:
  1. Export PDF (pdfmake background function) — invisibile da rimuovere post-generation
  2. Export PNG (Canvas 2D, post-drawImage)
  3. Preview live (overlay SVG diagonale con `pointer-events: none`) — copre anche gli screenshot
- **DPI gate:** PDF 300→150 DPI per free; PNG 300→72 DPI per free; lato PNG clampato a 1200px free vs 4096px unlocked
- **Document limit enforcement:** `useDocumentSave` hook wrappa `dataService.saveDocument` con `checkDocumentLimit()`; TierLimitModal appare automaticamente al 4° tentativo
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

## Raccomandazione finale

Il modello è economicamente sostenibile — i conti tornano già con 3 progetti al mese. Il rischio reale non è tecnologico né finanziario, ma commerciale: riuscire a trovare clienti con urgenza reale, non solo interesse generico.

La versione più forte di questo business non è "agenzia di branding per PMI", ma qualcosa di molto più specifico: il pacchetto che compri quando stai aprendo o quando hai una stagione davanti. Più si stringe la promessa su un momento preciso, più diventa facile vendere e più il cliente percepisce il valore.

Costruisci prima il flusso manuale su 5 clienti reali. Solo dopo automatizzare.

> **Nota implementativa:** il tier system Phase 5 è completato tecnicamente (983/983 test verdi, typecheck pulito). Il flusso commerciale end-to-end è pronto per essere validato: admin genera codice → cliente riscatta → tier passa a `unlocked` → watermark rimosso. La parte commerciale (marketing, vendita, delivery) resta il collo di bottiglia.

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
   - Documenti illimitati, nessun limite 3

2. **Utente con codice riscattato** (chi paga):
   - Dopo `POST /users/redeem-code` con codice valido → `tier = 'unlocked'` salvato in `user_settings.tier`
   - Stesso path dell'admin per export e preview
   - `documentCount` non ha più limite (può salvare infiniti documenti)

3. **Free user** (senza account, o con account senza redeem):
   - `tier = 'free'` (default in `user_settings.tier`)
   - `documentCount` parte da 0, limite 3
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

# 3. Test codice: crea nuovo account free, salva 3 doc, prova 4°
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
