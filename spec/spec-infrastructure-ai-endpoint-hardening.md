---
title: AI Endpoint Hardening — Zod validation + rate-limit su /ai/chat e /ai/chat/stream
version: 1.0
date_created: 2026-07-05
last_updated: 2026-07-05
owner: Giovanni Cidu
tags: [infrastructure, ai, security, api, zod, rate-limit, hardening]
---

# Introduction

Endpoint `/ai/chat` e `/ai/chat/stream` in `api/index.ts` non hanno
validazione Zod né (per `/ai/chat`) rate-limit esplicito. `/ai/copy-flyer`
è il riferimento: ha Zod schema + rate-limit scope `flyerCopy` 10/min/IP.
Questa spec allinea i 2 endpoint al livello di `/ai/copy-flyer`, riducendo
superficie di attacco e abuso token (costo DeepSeek a carico del
proprietario se abuse).

## 1. Purpose & Scope

**Purpose**: validazione input + rate-limit su endpoint AI non protetti.

**Scope**:
- `api/index.ts` handler `handleAI` (righe 970-1200 circa)
- Nuovo `api/__tests__/ai.test.ts`
- Nessuna modifica a `/ai/copy-flyer` (già validato, riferimento)

**Audience**: sviluppatore backend, security review.

**Assunzioni**:
- `DEEPSEEK_API_KEY` env var richiesta (503 se mancante, già gestito).
- Auth delegata al client (`dataService.chatWithAI` manda `userEmail`).
  Questa spec aggiunge verifica `userEmail` lato server (non solo trust).
- Rate-limit esistenti: `flyerCopy` 10/min, `aistream` 30/min. Nuovo:
  `aichat` 30/min/IP.
- Zod v4 (già dipendenza progetto).

## 2. Definitions

- **Rate-limit scope**: categoria per `consumeRateLimit(ip, scope, max,
  windowMs)`. Esistenti: `login`, `ai` (aistream 30/min), `flyerCopy`
  (10/min), `tokens`, `logs`.
- **Zod schema**: validazione input strutturata (già usata in tutti gli
  endpoint non-AI).
- **Auth userEmail**: email utente estratta da body (non da JWT/session,
  perché l'app non usa JWT). Pattern esistente in `/users/*` endpoints.
- **Tool passthrough**: `/ai/chat/stream` passa `tools` al provider
  (DeepSeek function calling). Zod valida shape ma non semantica tool.

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: Aggiungere Zod schema per `/ai/chat`:
  ```typescript
  const aiChatSchema = z.object({
    model: z.string().optional(),
    messages: z.array(z.object({
      role: z.enum(['system', 'user', 'assistant', 'tool']),
      content: z.string(),
      tool_call_id: z.string().optional(),
      name: z.string().optional()
    })).min(1).max(50),
    response_format: z.object({ type: z.literal('json_object') }).optional(),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().positive().max(8192).optional(),
    userEmail: z.string().email().optional() // per auth/tracking
  });
  ```
- **REQ-002**: Aggiungere rate-limit `/ai/chat` scope `aichat` 30/min/IP:
  ```typescript
  const rl = consumeRateLimit(ip, 'aichat', 30, 60_000);
  if (!rl.ok) return res.status(429).set('Retry-After', String(rl.retryAfter)).json({ error: 'Too many requests' });
  ```
- **REQ-003**: Aggiungere Zod schema per `/ai/chat/stream`:
  ```typescript
  const aiChatStreamSchema = z.object({
    model: z.string().optional(),
    messages: z.array(z.object({
      role: z.enum(['system', 'user', 'assistant', 'tool']),
      content: z.string(),
      tool_call_id: z.string().optional(),
      name: z.string().optional()
    })).min(1).max(50),
    tools: z.array(z.any()).optional(), // tool definitions, shape non strict
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().positive().max(8192).optional(),
    userEmail: z.string().email().optional()
  });
  ```
- **REQ-004**: `/ai/chat/stream` già ha rate-limit `aistream` 30/min.
  Mantenere. Aggiungere Zod validation prima del rate-limit check.
- **REQ-005**: Su Zod parse fallito: ritornare `400` con
  `{ error: 'Invalid body', details: zodError.issues }` (pattern esistente
  in altri endpoint).
- **REQ-006**: Se `userEmail` presente nel body, log per tracking (no
  PII nel log payload, solo email + timestamp + endpoint). Se assente,
  log "anonymous ai request" (permitted, come pre-refactor).
- **REQ-007**: Mantenere timeout esistenti: `/ai/chat` 25s,
  `/ai/chat/stream` 60s.
- **REQ-008**: Mantenere mapping errori DeepSeek (401/402/429 → status
  coerente).
- **CON-001**: Zero breaking change per client `dataService.chatWithAI`
  e `dataService.streamChatWithAI`. I campi inviati sono già compatibili
  con lo schema.
- **CON-002**: `messages` cap 50 (match `MAX_SESSION_MESSAGES` in
  chatStore, evita payload gigante).
- **CON-003**: `temperature` range 0-2 (DeepSeek supporta, valori fuori
  ignorati o error).
- **CON-004**: `max_tokens` cap 8192 (limite ragionevole, DeepSeek V4
  max output 384K ma per client 8192 basta).
- **GUD-001**: Schema Zod coerente con `/ai/copy-flyer` (stesso pattern
  `z.object({...})` + `.optional()` per opzionali).
- **GUD-002**: Rate-limit headers `Retry-After` (secondi) su 429, come
  `/ai/copy-flyer`.
- **PAT-001**: Validazione PRIMA del rate-limit check (fail fast su body
  malformato, non consuma quota).
- **PAT-002**: Log strutturato JSON (conforme AGENTS.md "Logging").

## 4. Interfaces & Data Contracts

**Endpoint post-hardening**:

| Path | Method | Zod | Rate-limit | Timeout | Auth |
|------|--------|-----|------------|---------|------|
| `/ai/chat` | POST | `aiChatSchema` | `aichat` 30/min/IP, `Retry-After` | 25s | `userEmail` body opzionale, log |
| `/ai/chat/stream` | POST | `aiChatStreamSchema` | `aistream` 30/min/IP (esistente) | 60s | `userEmail` body opzionale, log |
| `/ai/copy-flyer` | POST | (esistente) | `flyerCopy` 10/min/IP | 25s | (esistente) |

**Error response shape** (400):

```json
{
  "error": "Invalid body",
  "details": [
    { "path": ["messages", 0, "role"], "message": "Invalid enum value" }
  ]
}
```

**Error response shape** (429):

```json
{ "error": "Too many requests" }
```

Header: `Retry-After: 30` (secondi).

## 5. Acceptance Criteria

- **AC-001**: Given POST `/ai/chat` con body malformato (no `messages`),
  When eseguito, Then ritorna `400` con `{ error: 'Invalid body' }`.
- **AC-002**: Given POST `/ai/chat` con `messages: []` (array vuoto),
  Then ritorna `400` (min 1).
- **AC-003**: Given POST `/ai/chat` con `messages: [{role: 'invalid',
  content: 'x'}]`, Then ritorna `400` (enum role).
- **AC-004**: Given POST `/ai/chat` con body valido, When 31a richiesta
  in 60s da stesso IP, Then ritorna `429` con `Retry-After` header.
- **AC-005**: Given POST `/ai/chat` con body valido, When 30a richiesta
  in 60s, Then ritorna `200` (al limite, non oltre).
- **AC-006**: Given POST `/ai/chat/stream` con body malformato, Then
  ritorna `400` (non 200 stream con errore downstream).
- **AC-007**: Given POST `/ai/chat/stream` con body valido, When 31a
  richiesta, Then `429` (rate-limit esistente preservato).
- **AC-008**: Given POST `/ai/chat` con `userEmail: 'test@example.com'`,
  When log esaminato, Then contiene email + timestamp (no PII aggiuntiva).
- **AC-009**: Given POST `/ai/chat` senza `userEmail`, When log esaminato,
  Then contiene "anonymous ai request".
- **AC-010**: Given test esistenti (se presenti su AI endpoint), When
  eseguiti, Then passano o aggiornati per nuovo Zod.
- **AC-011**: Given `npm test`, Then 1662+ verdi.
- **AC-012**: Given `npm run typecheck`, Then verde.

## 6. Test Automation Strategy

- **Test Levels**: Unit (endpoint handler con mock fetch DeepSeek).
- **Frameworks**: Vitest, mock `fetch` globale.
- **Test Data Management**: fixture body validi/invalidi.
- **CI/CD Integration**: `npm test` pre-push.
- **Coverage Requirements**: ≥70% su `handleAI` post-refactor.
- **Test nuovi** (~12 in `api/__tests__/ai.test.ts`):
  - `/ai/chat` body valido → 200 (mock fetch ritorna response DeepSeek)
  - `/ai/chat` body invalid (no messages) → 400
  - `/ai/chat` messages empty → 400
  - `/ai/chat` role invalid → 400
  - `/ai/chat` rate-limit 31a → 429 + Retry-After
  - `/ai/chat` userEmail log
  - `/ai/chat` anonymous log
  - `/ai/chat` timeout 25s (mock fetch abort)
  - `/ai/chat/stream` body valido → 200 SSE
  - `/ai/chat/stream` body invalid → 400
  - `/ai/chat/stream` rate-limit preservato
  - `/ai/copy-flyer` regression (non rotto)

## 7. Rationale & Context

Endpoint AI senza validazione = abuso potenziale. Un client malevolo (o
un bug nel client) può inviare payload arbitraio a DeepSeek a spese del
proprietario (`DEEPSEEK_API_KEY` server-side). `/ai/copy-flyer` già
dimostra il pattern corretto. Rate-limit previene DOS. Zod previene
injection campi non previsti. `userEmail` log abilita audit (chi usa
quanto). Costo: ~30 min implementation, ~1h test. ROI: chiusura 2 gap
OWASP A03 (Injection) + A07 (Auth Failures) parziali.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: DeepSeek V4 API — target del proxy. Nessuna modifica al
  protocollo.

### Third-Party Services
- Nessuna.

### Infrastructure Dependencies
- **INF-001**: Vercel Serverless Function (`api/index.ts` monolite).

### Data Dependencies
- **DAT-001**: `api/index.ts` handler `handleAI` (righe 970-1200).
- **DAT-002**: `consumeRateLimit`/`checkRateLimit` helper (esistenti in
  `api/index.ts`).
- **DAT-003**: `zod` v4 (dipendenza esistente).

### Technology Platform Dependencies
- **PLT-001**: TypeScript, zod, Vercel Node runtime.

### Compliance Dependencies
- **COM-001**: OWASP A03 (Injection) — Zod su tutti gli input AI.
- **COM-002**: OWASP A07 (Auth Failures) — `userEmail` log per audit.
- **COM-003**: GDPR — `userEmail` è PII, log non persistito (Vercel logs
  retention configurabile).

## 9. Examples & Edge Cases

**Esempio handler post-hardening** (`/ai/chat` estratto):

```typescript
if (path === '/ai/chat' && method === 'POST') {
  const parsed = aiChatSchema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.issues });
  }
  const ip = getClientIp(req);
  const rl = consumeRateLimit(ip, 'aichat', 30, 60_000);
  if (!rl.ok) {
    return res.status(429).set('Retry-After', String(rl.retryAfter)).json({ error: 'Too many requests' });
  }
  if (parsed.data.userEmail) {
    console.log(JSON.stringify({ event: 'ai_chat', email: parsed.data.userEmail, ts: Date.now() }));
  } else {
    console.log(JSON.stringify({ event: 'ai_chat_anon', ts: Date.now() }));
  }
  // ... fetch DeepSeek esistente (25s timeout)
}
```

**Edge case — messages > 50**: client manda 100 messaggi. Zod reject con
400. Client deve paginare (chatStore cap 50, non dovrebbe succedere in
pratica).

**Edge case — temperature = 5**: Zod reject (max 2). Client deve clampare
(orchestratore fa 0.7/0.2/0.4, mai >2).

**Edge case — `userEmail` invalid**: `userEmail: 'not-an-email'` → Zod
reject 400. Se client vuole anon, omette campo.

**Edge case — rate-limit reset**: dopo 60s, counter reset. 31a request
al secondo 59 → 429. Al secondo 61, nuova request → 200.

## 10. Validation Criteria

- Tutti AC-001..012 verdi.
- `api/__tests__/ai.test.ts` esiste con ≥12 test.
- Zod schema definito per `/ai/chat` e `/ai/chat/stream`.
- Rate-limit `aichat` 30/min/IP su `/ai/chat`.
- `/ai/copy-flyer` non rotto (regression test).
- `npm test` verde (1662 + ~12 nuovi).
- `npm run typecheck` verde.

## 11. Related Specifications / Further Reading

- `spec/spec-architecture-ai-base-orchestrator.md` — BaseOrchestrator
  client-side.
- `api/index.ts` handler `handleAI` — codice da refactorare.
- OWASP Top 10: A03 Injection, A07 Auth Failures.
- `src/utils/dataService.js` — client che chiama questi endpoint.