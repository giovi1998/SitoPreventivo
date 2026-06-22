import type { BusinessCard, CardGrid } from '../utils/documentSchemas';
import { businessCardSchema } from '../utils/documentSchemas';
import { clampMove, clampResize } from '../utils/gridUtils';

export interface CardMergeResult {
  card: BusinessCard;
  changes: string[];
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
  // Strip di QUALSIASI campo non presente nello schema businessCardSchema.
  // Questo cattura campi inventati dall'AI come `visible`, `enabled`, ecc.
  // Usa .partial() per rendere tutti i top-level field opzionali (AI può
  // inviare solo i campi che vuole modificare). I nested objects (front,
  // back, style, grid) restano required-if-present.
  // Pre-process: aggiungi cols/rows default se mancanti (Zod li richiede).
  const preprocessed: Record<string, unknown> = { ...modified };
  if (preprocessed.grid && typeof preprocessed.grid === 'object') {
    const g = { ...(preprocessed.grid as Record<string, unknown>) };
    if (typeof g.cols !== 'number') g.cols = 4;
    if (typeof g.rows !== 'number') g.rows = 4;
    preprocessed.grid = g;
  }
  const safeParse = businessCardSchema.partial().safeParse(preprocessed);
  if (!safeParse.success) {
    // Input completamente invalido → nessuna modifica
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
  }

  // ─── GRID ───────────────────────────────────────────────
  if (modifiedSafe.grid && typeof modifiedSafe.grid === 'object') {
    const g = modifiedSafe.grid as Record<string, unknown>;
    const elements = g.elements as Record<string, unknown> | undefined;
    if (elements && typeof elements === 'object' && !isGridHallucinated(elements)) {
      const currentGrid: CardGrid = updated.grid ?? {
        cols: 4,
        rows: 4,
        elements: {},
      };
      const newGrid: CardGrid = {
        ...currentGrid,
        cols: (typeof g.cols === 'number' ? g.cols : currentGrid.cols),
        rows: (typeof g.rows === 'number' ? g.rows : currentGrid.rows),
        elements: { ...currentGrid.elements },
      };
      for (const key of Object.keys(elements)) {
        const el = elements[key] as { x: number; y: number; w: number; h: number };
        if (!el || typeof el !== 'object') continue;
        // Valida che abbia coordinate numeriche
        if (typeof el.x !== 'number' || typeof el.y !== 'number' ||
            typeof el.w !== 'number' || typeof el.h !== 'number') continue;
        if (el.w <= 0 || el.h <= 0) continue;
        const current = currentGrid.elements[key as keyof typeof currentGrid.elements];
        let sanitized = el;
        if (current) {
          const dx = el.x - current.x;
          const dy = el.y - current.y;
          const dw = el.w - current.w;
          const dh = el.h - current.h;
          if (dx !== 0 || dy !== 0) {
            const { x, y } = clampMove(currentGrid, key, dx, dy);
            sanitized = { x, y, w: el.w, h: el.h };
          }
          if (dw !== 0 || dh !== 0) {
            const r = clampResize(currentGrid, key, dw, dh);
            sanitized = { x: r.x, y: r.y, w: r.w, h: r.h };
          }
        } else {
          // Nuovo elemento aggiunto dall'AI: clamp ai bordi della grid.
          // Non possiamo usare clampMove perché l'elemento non esiste in grid
          // (wouldCollideOnMove ritornerebbe false in modo non significativo).
          const cols = currentGrid.cols;
          const rows = currentGrid.rows;
          const w = Math.max(1, Math.min(cols, el.w));
          const h = Math.max(1, Math.min(rows, el.h));
          const x = Math.max(0, Math.min(cols - w, el.x));
          const y = Math.max(0, Math.min(rows - h, el.y));
          sanitized = { x, y, w, h };
        }
        newGrid.elements = { ...newGrid.elements, [key]: sanitized };
        changes.push(`Griglia: ${key} posizionato a (${sanitized.x}, ${sanitized.y}) ${sanitized.w}×${sanitized.h}`);
      }
      updated.grid = newGrid;
    }
  }

  if (changes.length > 0) {
    updated.updatedAt = new Date().toISOString();
  }

  return { card: updated, changes };
}
