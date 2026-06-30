import type { BusinessCard, CardGrid } from '../utils/documentSchemas';
import { businessCardSchema, FONT_SCALE_MIN, FONT_SCALE_MAX } from '../utils/documentSchemas';
import { aiCardInputSchema } from './aiCardInputSchema';
import { stepMove, stepResize } from '../utils/gridUtils';

export interface CardMergeResult {
  card: BusinessCard;
  changes: string[];
}

// Phase 2.2 (REQ-A04): instradamento elementi grid per lato.
// Elementi del FRONTE → card.grid; elementi del RETRO → card.backGrid.
// Senza questo split, l'AI "sposta QR" scrive in card.grid e il retro
// (che legge da card.backGrid ?? card.grid) ignora la modifica.
const FRONT_GRID_KEYS = ['photo', 'name', 'title', 'company', 'logo'] as const;
const BACK_GRID_KEYS = ['contacts', 'qr', 'socials'] as const;
type GridTarget = 'grid' | 'backGrid';

function targetForKey(key: string): GridTarget {
  return (BACK_GRID_KEYS as readonly string[]).includes(key) ? 'backGrid' : 'grid';
}

// Helper: aggiorna una stringa solo se il nuovo valore è non-vuoto E
// diverso dal corrente. Protegge da AI che "pulisce" i campi per sbaglio
// (es. phone: "" quando l'utente aveva "XXXXX" o un numero reale).
function shouldUpdateString(newVal: unknown, curr: string): boolean {
  if (typeof newVal !== 'string') return false;
  if (newVal === curr) return false;
  if (newVal === '' && curr !== '') return false; // non cancellare
  return true;
}

// Helper: rileva AI hallucination sulla grid. Se TUTTI gli elementi sono
// a (0,0,1,1) o hanno size 0 o hanno position non-numerica, è un segnale
// che l'AI sta generando output casuale. In quel caso, ignora le mosse.
function isGridHallucinated(elements: Record<string, unknown>): boolean {
  const entries = Object.entries(elements);
  if (entries.length === 0) return false;
  // Tutti a (0,0,1,1) = AI non ha pensato alle posizioni
  const allAtOrigin = entries.every(([, el]) => {
    if (!el || typeof el !== 'object') return false;
    const e = el as { x?: unknown; y?: unknown; w?: unknown; h?: unknown };
    return e.x === 0 && e.y === 0 && e.w === 1 && e.h === 1;
  });
  if (allAtOrigin && entries.length > 1) return true;
  // Tutti con size <= 0 = invalido
  const allInvalidSize = entries.every(([, el]) => {
    if (!el || typeof el !== 'object') return false;
    const e = el as { w?: unknown; h?: unknown };
    return typeof e.w !== 'number' || typeof e.h !== 'number' || e.w <= 0 || e.h <= 0;
  });
  if (allInvalidSize) return true;
  return false;
}

export function mergeCardAIResponse(
  currentCard: BusinessCard,
  modified: Record<string, unknown>,
): CardMergeResult {
  // ─── Sanitizzazione Zod ────────────────────────────────────
  // Phase 2.2 REQ-I01: usiamo `aiCardInputSchema` (più permissivo) invece
  // di `businessCardSchema.partial()` per permettere all'AI di inviare
  // valori fuori range per `fontScale` (es. 3.0) — il clamp a [0.7, 1.5]
  // è applicato qui sotto nel merge. Lo schema AI strippa comunque
  // `visible`, `enabled` e altri campi inventati.
  const preprocessed: Record<string, unknown> = { ...modified };
  if (preprocessed.grid && typeof preprocessed.grid === 'object') {
    const g = { ...(preprocessed.grid as Record<string, unknown>) };
    if (typeof g.cols !== 'number') g.cols = 4;
    if (typeof g.rows !== 'number') g.rows = 4;
    // fix: l'AI spesso invia `null` per gli elementi grid che NON vuole
    // modificare (es. sposta solo il logo, invia logo: {...} e null per
    // photo/name/title/...). Lo schema Zod rifiuta `null` su elementi
    // opzionali (z.object().optional() non accetta null espliciti), quindi
    // filtriamo via i null PRIMA della validazione: null ≡ "non menzionato".
    if (g.elements && typeof g.elements === 'object') {
      const els = { ...(g.elements as Record<string, unknown>) };
      for (const k of Object.keys(els)) {
        if (els[k] === null || els[k] === undefined) {
          delete els[k];
        }
      }
      g.elements = els;
    }
    preprocessed.grid = g;
  }
  const safeParse = aiCardInputSchema.safeParse(preprocessed);
  if (!safeParse.success) {
    return { card: currentCard, changes: [] };
  }
  const modifiedSafe = safeParse.data as Record<string, unknown>;

  const updated: BusinessCard = { ...currentCard };
  const changes: string[] = [];

  // ─── FRONT ──────────────────────────────────────────────
  if (modifiedSafe.front && typeof modifiedSafe.front === 'object') {
    const f = modifiedSafe.front as Record<string, unknown>;
    updated.front = { ...updated.front };

    if (typeof f.name === 'string' && f.name !== updated.front.name) {
      updated.front.name = f.name;
      changes.push(`Fronte: nome → "${f.name}"`);
    }
    if (typeof f.title === 'string' && f.title !== updated.front.title) {
      updated.front.title = f.title;
      changes.push(`Fronte: titolo → "${f.title}"`);
    }
    if (typeof f.company === 'string' && f.company !== updated.front.company) {
      updated.front.company = f.company;
      changes.push(`Fronte: azienda → "${f.company}"`);
    }
    if (typeof f.layout === 'string' && f.layout !== updated.front.layout) {
      updated.front.layout = f.layout as BusinessCard['front']['layout'];
      changes.push(`Fronte: layout → "${f.layout}"`);
    }
    // fix: se l'AI invia front.useGrid = true esplicitamente (es. "vai in
    // grid mode" o insieme a grid.elements.*), propaghiamolo.
    if (f.useGrid === true && !updated.front.useGrid) {
      updated.front.useGrid = true;
      changes.push('Fronte: griglia attivata');
    }
    // ─── Protezione: photoUrl/logoUrl ───────────────────────
    // MAI sovrascrivere. Sono base64 user-uploaded (foto profilo, logo).
    // L'AI non li ha mai visti nella richiesta originale. Se invia "" o null
    // o un qualsiasi valore, ignoriamo. (Lo spread di updated.front preserva
    // i valori esistenti; questo commento esplicito è il reminder.)
  }

  // ─── BACK ───────────────────────────────────────────────
  if (modifiedSafe.back && typeof modifiedSafe.back === 'object') {
    const b = modifiedSafe.back as Record<string, unknown>;
    updated.back = { ...updated.back };

    if (shouldUpdateString(b.phone, updated.back.phone)) {
      updated.back.phone = b.phone as string;
      changes.push(`Retro: telefono impostato`);
    }
    if (shouldUpdateString(b.email, updated.back.email)) {
      updated.back.email = b.email as string;
      changes.push(`Retro: email impostata`);
    }
    if (shouldUpdateString(b.website, updated.back.website)) {
      updated.back.website = b.website as string;
      changes.push(`Retro: sito web → "${b.website}"`);
    }
    if (shouldUpdateString(b.address, updated.back.address)) {
      updated.back.address = b.address as string;
      changes.push(`Retro: indirizzo impostato`);
    }
    if (shouldUpdateString(b.vatNumber, updated.back.vatNumber)) {
      updated.back.vatNumber = b.vatNumber as string;
      changes.push(`Retro: P.IVA impostata`);
    }
    // Socials: array non vuoto, e non identico al corrente
    if (Array.isArray(b.socials)) {
      const newSocials = b.socials as BusinessCard['back']['socials'];
      if (newSocials.length > 0 && JSON.stringify(newSocials) !== JSON.stringify(updated.back.socials)) {
        updated.back.socials = newSocials;
        changes.push(`Retro: social aggiornati (${newSocials.length} elementi)`);
      }
    }
    if (shouldUpdateString(b.qrPayload, updated.back.qrPayload)) {
      updated.back.qrPayload = b.qrPayload as string;
      changes.push(`Retro: payload QR aggiornato`);
    }
    if (shouldUpdateString(b.qrLabel, updated.back.qrLabel)) {
      updated.back.qrLabel = b.qrLabel as string;
      changes.push(`Retro: etichetta QR aggiornata`);
    }
    // Phase 2.2 REQ-I01: services (array), servicesLabel, qrSize.
    if (Array.isArray(b.services)) {
      const newServices = (b.services as unknown[]).filter((s): s is string => typeof s === 'string');
      if (newServices.length > 0 && JSON.stringify(newServices) !== JSON.stringify(updated.back.services)) {
        updated.back.services = newServices.slice(0, 8).map((s) => String(s).slice(0, 80));
        changes.push(`Retro: servizi aggiornati (${updated.back.services.length} elementi)`);
      }
    }
    if (shouldUpdateString(b.servicesLabel, updated.back.servicesLabel)) {
      updated.back.servicesLabel = (b.servicesLabel as string).slice(0, 40);
      changes.push(`Retro: etichetta servizi → "${updated.back.servicesLabel}"`);
    }
    if (typeof b.qrSize === 'string' && ['small', 'medium', 'large'].includes(b.qrSize)) {
      if (b.qrSize !== updated.back.qrSize) {
        updated.back.qrSize = b.qrSize as BusinessCard['back']['qrSize'];
        changes.push(`Retro: dimensione QR → "${b.qrSize}"`);
      }
    }
    // fix: stesso fix del fronte (vedi sopra)
    if (b.useGrid === true && !updated.back.useGrid) {
      updated.back.useGrid = true;
      changes.push('Retro: griglia attivata');
    }
  }

  // ─── STYLE ──────────────────────────────────────────────
  if (modifiedSafe.style && typeof modifiedSafe.style === 'object') {
    const s = modifiedSafe.style as Record<string, unknown>;
    updated.style = { ...updated.style };

    if (typeof s.sizePreset === 'string' && s.sizePreset !== updated.style.sizePreset) {
      updated.style.sizePreset = s.sizePreset as BusinessCard['style']['sizePreset'];
      changes.push(`Stile: formato → "${s.sizePreset}"`);
    }
    if (shouldUpdateString(s.bgColor, updated.style.bgColor)) {
      updated.style.bgColor = s.bgColor as string;
      changes.push(`Stile: colore sfondo → ${s.bgColor}`);
    }
    if (shouldUpdateString(s.textColor, updated.style.textColor)) {
      updated.style.textColor = s.textColor as string;
      changes.push(`Stile: colore testo → ${s.textColor}`);
    }
    if (shouldUpdateString(s.accentColor, updated.style.accentColor)) {
      updated.style.accentColor = s.accentColor as string;
      changes.push(`Stile: colore accento → ${s.accentColor}`);
    }
    if (shouldUpdateString(s.fontFamily, updated.style.fontFamily)) {
      updated.style.fontFamily = s.fontFamily as string;
      changes.push(`Stile: font → "${s.fontFamily}"`);
    }
    if (typeof s.borderStyle === 'string' && s.borderStyle !== updated.style.borderStyle) {
      updated.style.borderStyle = s.borderStyle as BusinessCard['style']['borderStyle'];
      changes.push(`Stile: bordo → "${s.borderStyle}"`);
    }
    // Phase 2.2 REQ-I01: fontScale (number clampa a [0.7, 1.5])
    if (typeof s.fontScale === 'number') {
      const clamped = Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, s.fontScale));
      if (clamped !== updated.style.fontScale) {
        updated.style.fontScale = clamped;
        changes.push(`Stile: dimensione testo → ${clamped}`);
      }
    }
  }

  // ─── GRID ───────────────────────────────────────────────
  // Phase 2.2 (REQ-A04): instradamento per lato. Elementi FRONT vanno in
  // updated.grid, elementi BACK in updated.backGrid. Ogni lato mantiene la
  // propria grid (cols/rows/elements). L'AI può modificare un lato alla
  // volta; l'altro lato resta intatto.
  //
  // Phase 2.2 (REQ-A06): per mosse e resize multi-cella, usiamo stepMove /
  // stepResize (graduali per-asse) invece di clampMove/clampResize
  // (all-or-nothing). Una richiesta AI di spostare di 2 celle con la
  // destinazione occupata avanza di 1 invece di essere scartata.
  if (modifiedSafe.grid && typeof modifiedSafe.grid === 'object') {
    const g = modifiedSafe.grid as Record<string, unknown>;
    const elements = g.elements as Record<string, unknown> | undefined;
    if (elements && typeof elements === 'object' && !isGridHallucinated(elements)) {
      for (const key of Object.keys(elements)) {
        const el = elements[key] as { x: number; y: number; w: number; h: number };
        if (!el || typeof el !== 'object') continue;
        if (typeof el.x !== 'number' || typeof el.y !== 'number' ||
            typeof el.w !== 'number' || typeof el.h !== 'number') continue;
        if (el.w <= 0 || el.h <= 0) continue;

        const target: GridTarget = targetForKey(key);
        if (target === 'grid' && !updated.front.useGrid) {
          updated.front = { ...updated.front, useGrid: true };
          changes.push('Fronte: griglia attivata');
        }
        if (target === 'backGrid' && !updated.back.useGrid) {
          updated.back = { ...updated.back, useGrid: true };
          changes.push('Retro: griglia attivata');
        }
        const currentTargetGrid: CardGrid = updated[target] ?? {
          cols: (typeof g.cols === 'number' ? g.cols : 4),
          rows: (typeof g.rows === 'number' ? g.rows : 4),
          elements: {},
        };
        const newTargetGrid: CardGrid = {
          ...currentTargetGrid,
          cols: (typeof g.cols === 'number' ? g.cols : currentTargetGrid.cols),
          rows: (typeof g.rows === 'number' ? g.rows : currentTargetGrid.rows),
          elements: { ...currentTargetGrid.elements },
        };
        const current = currentTargetGrid.elements[key as keyof typeof currentTargetGrid.elements];
        let sanitized = el;
        if (current) {
          const dx = el.x - current.x;
          const dy = el.y - current.y;
          const dw = el.w - current.w;
          const dh = el.h - current.h;
          if (dx !== 0 || dy !== 0) {
            const { x, y } = stepMove(currentTargetGrid, key, dx, dy);
            sanitized = { x, y, w: el.w, h: el.h };
          }
          if (dw !== 0 || dh !== 0) {
            const r = stepResize(currentTargetGrid, key, dw, dh);
            sanitized = { x: r.x, y: r.y, w: r.w, h: r.h };
          }
        } else {
          // Nuovo elemento: clamp ai bordi della grid di destinazione.
          const cols = currentTargetGrid.cols;
          const rows = currentTargetGrid.rows;
          const w = Math.max(1, Math.min(cols, el.w));
          const h = Math.max(1, Math.min(rows, el.h));
          const x = Math.max(0, Math.min(cols - w, el.x));
          const y = Math.max(0, Math.min(rows - h, el.y));
          sanitized = { x, y, w, h };
        }
        const sameAsCurrent = !!current && sanitized.x === current.x && sanitized.y === current.y &&
          sanitized.w === current.w && sanitized.h === current.h;
        const sameAsRequested = sanitized.x === el.x && sanitized.y === el.y &&
          sanitized.w === el.w && sanitized.h === el.h;

        newTargetGrid.elements = { ...newTargetGrid.elements, [key]: sanitized };

        if (sameAsCurrent) {
          // Nessuna modifica effettiva: richiesta impossibile per collisione/bordi.
          changes.push(`Griglia: ${key} bloccato (collisione) — posizione richiesta non raggiungibile`);
        } else {
          updated[target] = newTargetGrid;
          if (sameAsRequested) {
            changes.push(`Griglia: ${key} posizionato a (${sanitized.x}, ${sanitized.y}) ${sanitized.w}×${sanitized.h}`);
          } else {
            changes.push(`Griglia: ${key} parziale (collisione) — richiesto (${el.x}, ${el.y}) ${el.w}×${el.h}, applicato (${sanitized.x}, ${sanitized.y}) ${sanitized.w}×${sanitized.h}`);
          }
        }
      }
    }
  }

  if (changes.length > 0) {
    updated.updatedAt = new Date().toISOString();
  }

  return { card: updated, changes };
}
