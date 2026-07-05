---
title: AI Card & Flyer Tools — Tool registry per moduli senza tool
version: 1.0
date_created: 2026-07-05
last_updated: 2026-07-05
owner: Giovanni Cidu
tags: [tool, ai, card, flyer, tool-registry, mixin, refactor]
---

# Introduction

`ToolRegistry` esiste ma è usato solo da `AIOrchestrator` (quote, 12
tool). `CardAIOrchestrator` e `FlyerAIOrchestrator` non hanno tool: AI
modifica JSON direttamente. Questa spec aggiunge tool mirati per card
(e flyer) per operazioni deterministiche che l'AI fa male via JSON
diretto (es. apply_palette, switch_layout). Estrae `ToolAwareOrchestrator`
intermedio per condividere `registerTools` tra orchestratori con tool.

## 1. Purpose & Scope

**Purpose**: tool deterministici per card/flyer dove JSON edit è error-
prone (es. palette incoerente, layout invalido). Tool = funzione pura
validata, AI chiama tool invece di modificare JSON a mano.

**Scope**:
- Nuovi tool definitions in `src/ai/tools/definitions.ts` (sezione card
  + flyer)
- Nuovi executor in `src/ai/cardOrchestrator.ts` (registerCardTools) e
  `flyerOrchestrator.ts` (registerFlyerTools)
- Estrazione `ToolAwareOrchestrator extends BaseOrchestrator` (spec 5)
  con `registerTools` shared
- `AIOrchestrator` refactor: `extends ToolAwareOrchestrator`
- `CardAIOrchestrator`/`FlyerAIOrchestrator`: `extends ToolAwareOrchestrator`
- Test nuovi in `cardOrchestrator.test.ts`, `flyerOrchestrator.test.ts`

**Audience**: sviluppatore AI.

**Assunzioni**:
- Spec 5 (BaseOrchestrator) completata. Questa spec dipende da quella.
- `ToolRegistry` esistente (`src/ai/tools/registry.ts`) resta invariato.
- Tool definitions shape (`ToolDefinition[]`) invariata.
- Provider supporta tool calling (DeepSeek V4 sì, `supportsTools` true).
- Card tool opera su `BusinessCard`, flyer tool su `Flyer`. `ToolExecutor`
  generico resta `(args, quote: PremiumQuote) => ToolResult`; per card/
  flyer si parametrizza o si fa cast interno.

## 2. Definitions

- **ToolRegistry**: classe esistente `src/ai/tools/registry.ts`.
- **ToolDefinition**: shape `{ type: 'function', function: { name,
  description, parameters: { type, properties, required } } }`.
- **ToolExecutor**: `(args, payload) => ToolResult`. Per quote `payload`
  è `PremiumQuote`. Per card è `BusinessCard`, flyer `Flyer`.
- **ToolAwareOrchestrator**: abstract intermedio (spec 5 base + tool
  registry). `AIOrchestrator`, `CardAIOrchestrator`, `FlyerAIOrchestrator`
  estendono.
- **ToolResult**: `{ payload, changes }` (generico, non `quote`).

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: Definire 4 tool card in `definitions.ts`:
  - `apply_palette`: args `{ palette: 'premium'|'minimal'|'moderno'|'classico' }`,
    applica set colori coerenti (tabella PALETTE da spec 2)
  - `switch_layout`: args `{ layout: 'centered'|'left'|'split'|'right'|'top'|'bottom'|'minimal'|'photo-circle'|'compact' }`,
    cambia `front.layout` + riposiziona grid elements coerentemente
  - `add_service`: args `{ service: string (max 80 char) }`, aggiunge a
    `back.services` (cap 8, errore se pieno)
  - `remove_empty_socials`: no args, rimuove socials con `url` vuoto o
    `"XXXXX"` placeholder
- **REQ-002**: Definire 3 tool flyer:
  - `shorten_body`: args `{ ratio: number 0.3-0.8 }`, tronca body al
    ratio indicato (es. 0.5 = metà). Rispetta `bodyCharBudget`.
  - `change_tone`: args `{ tone: 'formale'|'giovanile'|'tecnico' }`,
    riformula body/cta.label nel tono. NON tocca headline/subheadline.
  - `add_urgency`: args `{ phrase: string (max 50 char) }`, aggiunge
    frase urgenza al body. Se brief originale ha data, usa quella; se
    no, usa phrase generica ("Solo oggi", "Ultimi posti").
- **REQ-003**: Estrazione `ToolAwareOrchestrator extends BaseOrchestrator`:
  - Campo `protected toolRegistry: ToolRegistry`
  - Metodo `protected registerTools(definitions: ToolDefinition[])`:
    crea `new ToolRegistry()`, loop definitions per popolare, executor
    registrati via override in sottoclasse
  - Abstract `protected registerExecutors(reg: ToolRegistry): void`:
    sottoclasse registra executor specifici
  - `get toolRegistry()` / `set toolRegistry()` (come AIOrchestrator
    esistente)
- **REQ-004**: `AIOrchestrator extends ToolAwareOrchestrator`:
  - `registerExecutors` registra i 12 executor quote esistenti
  - `processPrompt` usa `this.toolRegistry.execute` (invariato)
- **REQ-005**: `CardAIOrchestrator extends ToolAwareOrchestrator`:
  - `registerExecutors` registra 4 executor card
  - `processCardPrompt` abilita tool se `needsTools` (nuova funzione per
    card, keyword: "palette", "layout", "aggiungi servizio", "rimuovi
    social vuoti") + provider.supportsTools
  - Multi-turn: dopo tool, seconda chiamata per JSON finale (come quote)
- **REQ-006**: `FlyerAIOrchestrator extends ToolAwareOrchestrator`:
  - `registerExecutors` registra 3 executor flyer
  - `generateCopy`/`refineCopy` usano tool se `needsFlyerTools` (keyword:
    "accorcia", "cambia tono", "aggiungi urgenza")
  - Multi-turn: dopo tool, seconda chiamata per JSON finale
- **REQ-007**: `ToolExecutor` generic: cambiare signature da
  `(args, quote: PremiumQuote)` a `(args, payload: unknown)`. Executor
  fa cast interno al tipo atteso (es. `payload as BusinessCard`). Type-
  safe via runtime check (Zod) se necessario.
- **REQ-008**: Tool definitions card/flyer aggiunti a `TOOL_DEFINITIONS`
  array in `definitions.ts` con `module: 'card'|'flyer'` tag (campo
  extra opzionale per filtrare).
- **CON-001**: Zero breaking change per client. `useAI`/`useAICard`/
  `useAIFlyer` signature identiche.
- **CON-002**: Tool card/flyer opzionali: se provider non supporta
  tool, fallback a JSON diretto (come pre-refactor).
- **CON-003**: Dipende da spec 5 (BaseOrchestrator). Eseguire dopo.
- **GUD-001**: Tool name prefissati per modulo: `card_apply_palette`,
  `card_switch_layout`, `flyer_shorten_body` (evita collision).
- **PAT-001**: Tool = funzione pura, no side effect, no I/O.
- **PAT-002**: Multi-turn pattern identico a quote (spec 5 base fornisce
  `handleStream`/`parseJsonResponse`).

## 4. Interfaces & Data Contracts

**ToolAwareOrchestrator**:

```typescript
export abstract class ToolAwareOrchestrator extends BaseOrchestrator {
  protected toolRegistry: ToolRegistry;

  constructor() {
    super();
    this.toolRegistry = new ToolRegistry();
    // Popola definitions
    for (const def of TOOL_DEFINITIONS) {
      if (this.applicableTools().includes(def.function.name)) {
        this.toolRegistry.registerDefinition(def);
      }
    }
    this.registerExecutors(this.toolRegistry);
  }

  protected abstract applicableTools(): string[];
  protected abstract registerExecutors(reg: ToolRegistry): void;

  get toolRegistry(): ToolRegistry { return this._toolRegistry; }
  set toolRegistry(reg: ToolRegistry) { this._toolRegistry = reg; }
}
```

**Tool definitions card** (4):

| Tool | Args | Effetto |
|------|------|---------|
| `card_apply_palette` | `{palette: enum}` | Set bgColor/textColor/accentColor |
| `card_switch_layout` | `{layout: enum}` | front.layout + grid riposizionata |
| `card_add_service` | `{service: string max 80}` | back.services.push, cap 8 |
| `card_remove_empty_socials` | (nessuno) | Filter back.socials url non vuoto/XXXXX |

**Tool definitions flyer** (3):

| Tool | Args | Effetto |
|------|------|---------|
| `flyer_shorten_body` | `{ratio: 0.3-0.8}` | Tronca body rispetto budget |
| `flyer_change_tone` | `{tone: enum}` | Riformula body + cta.label |
| `flyer_add_urgency` | `{phrase: max 50}` | Aggiungi frase urgenza al body |

**ToolExecutor generico**:

```typescript
export type ToolExecutor = (args: Record<string, unknown>, payload: unknown) => ToolResult;
export type ToolResult = { payload: unknown; changes: string };
```

## 5. Acceptance Criteria

- **AC-001**: Given `card_apply_palette` tool con `{palette: 'premium'}`,
  When eseguito su card con bgColor `#ffffff`, Then ritorna card con
  `accentColor: '#1e3a5f'` (navy premium).
- **AC-002**: Given `card_switch_layout` con `{layout: 'split'}`, When
  eseguito, Then `front.layout === 'split'` + grid elements riposizionati
  coerentemente (es. photo x=0 w=2, text x=2 w=2).
- **AC-003**: Given `card_add_service` con service string valida, When
  eseguito su card con 8 servizi, Then ritorna changes "max 8 raggiunto"
  (no aggiunta).
- **AC-004**: Given `card_remove_empty_socials`, When eseguito su card
  con socials `[{platform:'ig', url:''}, {platform:'fb', url:'valid'}]`,
  Then ritorna card con solo social fb.
- **AC-005**: Given `flyer_shorten_body` con `{ratio: 0.5}`, When
  eseguito su flyer con body 800 char, Then ritorna body ~400 char
  (rispetta `bodyCharBudget`).
- **AC-006**: Given `flyer_change_tone` con `{tone: 'giovanile'}`, When
  eseguito, Then body/cta.label riformulati, headline/subheadline
  invariati.
- **AC-007**: Given `flyer_add_urgency` con `{phrase: 'Solo oggi'}`,
  When eseguito, Then body contiene "Solo oggi" (append o prepend).
- **AC-008**: Given `CardAIOrchestrator.processCardPrompt` con prompt
  "applica palette premium", When eseguito, Then AI chiama
  `card_apply_palette` (verificabile via spy o log tool).
- **AC-009**: Given provider che NON supporta tool, When
  `processCardPrompt` eseguito, Then fallback a JSON diretto (no crash).
- **AC-010**: Given `npm test`, Then 1662+ verdi (test esistenti +
  nuovi).
- **AC-011**: Given `npm run typecheck`, Then verde.

## 6. Test Automation Strategy

- **Test Levels**: Unit (executor funzioni pure, orchestrator integration
  con mock provider).
- **Frameworks**: Vitest, mock `AIProvider`.
- **Test Data Management**: fixture `BusinessCard`/`Flyer` inline.
- **CI/CD Integration**: `npm test` pre-push.
- **Coverage Requirements**: ≥80% su nuovi executor.
- **Test nuovi** (~16):
  - `cardApplyPalette.test.ts`: 4 test (premium, minimal, moderno, invalid
    palette → error)
  - `cardSwitchLayout.test.ts`: 3 test (split, centered, invalid)
  - `cardAddService.test.ts`: 3 test (valid, cap 8, over 80 char)
  - `cardRemoveEmptySocials.test.ts`: 2 test (mixed, all empty)
  - `flyerShortenBody.test.ts`: 3 test (0.5, 0.3, respect budget)
  - `flyerChangeTone.test.ts`: 3 test (formale, giovanile, tecnico)
  - `flyerAddUrgency.test.ts`: 2 test (with date, generic phrase)
  - `cardOrchestrator.test.ts` +2 test (tool path, no-tool fallback)
  - `flyerOrchestrator.test.ts` +2 test (tool path, no-tool fallback)

## 7. Rationale & Context

AI via JSON diretto sbaglia palette (mescola colori), layout (invalid
combo), servizi (oltre cap 8). Tool deterministiche: `apply_palette`
garantisce set coerente, `switch_layout` riposiziona grid senza collision,
`add_service` enforce cap 8. Stesso pattern di quote (12 tool esistenti
funzionano bene). `ToolAwareOrchestrator` elimina duplicazione futura
(logo v2, social, onboarding possono avere tool). Dipendenza: spec 5.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: DeepSeek V4 API — tool calling supportato.

### Third-Party Services
- Nessuna.

### Infrastructure Dependencies
- Nessuna.

### Data Dependencies
- **DAT-001**: `src/ai/tools/definitions.ts`, `registry.ts` (estendere).
- **DAT-002**: `src/ai/index.ts`, `cardOrchestrator.ts`, `flyerOrchestrator.ts`
  (refactor extends).
- **DAT-003**: spec 5 `BaseOrchestrator` (dipendenza).

### Technology Platform Dependencies
- **PLT-001**: TypeScript, Vitest.

### Compliance Dependencies
- Nessuna.

## 9. Examples & Edge Cases

**Esempio `card_apply_palette` executor**:

```typescript
const PALETTES = {
  premium: { bg: '#ffffff', text: '#1a1a1a', accent: '#1e3a5f' },
  minimal: { bg: '#ffffff', text: '#1a1a1a', accent: '#333333' },
  moderno: { bg: '#0F1117', text: '#ffffff', accent: '#FF3B3B' },
  classico: { bg: '#ffffff', text: '#1A1A1A', accent: '#E62020' }
};

function executeCardApplyPalette(args: { palette: string }, payload: unknown): ToolResult {
  const card = payload as BusinessCard;
  const set = PALETTES[args.palette];
  if (!set) return { payload: card, changes: `Palette sconosciuta: ${args.palette}` };
  return {
    payload: { ...card, style: { ...card.style, bgColor: set.bg, textColor: set.text, accentColor: set.accent } },
    changes: `Palette ${args.palette} applicata: accent=${set.accent}`
  };
}
```

**Edge case — provider no tool**: `provider.supportsTools === false` →
`processCardPrompt` non passa `tools` a `provider.stream`, AI modifica
JSON direttamente (fallback esistente).

**Edge case — tool arg invalid**: `apply_palette` con `palette: 'foo'` →
executor ritorna `changes: 'Palette sconosciuta'`, card invariata. AI
riceve feedback, può riprovare.

**Edge case — `card_switch_layout` collision**: switch a split riposiziona
photo (0,0,2,4) + text (2,0,2,4). Tool deve garantire niente collision
(usa `clampMove` da `gridUtils.ts`).

## 10. Validation Criteria

- Tutti AC-001..011 verdi.
- 4 tool card + 3 tool flyer registrati.
- `ToolAwareOrchestrator` abstract estratto.
- 3 orchestratori `extends ToolAwareOrchestrator`.
- `npm test` verde (1662 + ~16 nuovi).
- `npm run typecheck` verde.

## 11. Related Specifications / Further Reading

- `spec/spec-architecture-ai-base-orchestrator.md` — BaseOrchestrator
  (dipendenza).
- `src/ai/tools/registry.ts`, `definitions.ts` — file estendere.
- `src/ai/index.ts` `registerTools` privato — pattern riferimento.
- `src/utils/gridUtils.ts` `clampMove` — per `card_switch_layout`
  collision-free.