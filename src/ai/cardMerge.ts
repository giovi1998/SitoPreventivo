import type { BusinessCard } from '../utils/documentSchemas';

export interface CardMergeResult {
  card: BusinessCard;
  changes: string[];
}

export function mergeCardAIResponse(
  currentCard: BusinessCard,
  modified: Record<string, unknown>,
): CardMergeResult {
  const updated: BusinessCard = { ...currentCard };
  const changes: string[] = [];

  // ─── FRONT ──────────────────────────────────────────────
  if (modified.front && typeof modified.front === 'object') {
    const f = modified.front as Record<string, unknown>;
    updated.front = { ...updated.front };

    if (f.name !== undefined && f.name !== updated.front.name) {
      updated.front.name = f.name as string;
      changes.push(`Fronte: nome → "${f.name}"`);
    }
    if (f.title !== undefined && f.title !== updated.front.title) {
      updated.front.title = f.title as string;
      changes.push(`Fronte: titolo → "${f.title}"`);
    }
    if (f.company !== undefined && f.company !== updated.front.company) {
      updated.front.company = f.company as string;
      changes.push(`Fronte: azienda → "${f.company}"`);
    }
    if (f.layout !== undefined && f.layout !== updated.front.layout) {
      updated.front.layout = f.layout as BusinessCard['front']['layout'];
      changes.push(`Fronte: layout → "${f.layout}"`);
    }
    // NEVER overwrite photoUrl/logoUrl — they are user-uploaded base64
    // The AI might return null or a placeholder, but we preserve the real images
  }

  // ─── BACK ───────────────────────────────────────────────
  if (modified.back && typeof modified.back === 'object') {
    const b = modified.back as Record<string, unknown>;
    updated.back = { ...updated.back };

    if (b.phone !== undefined && b.phone !== updated.back.phone) {
      updated.back.phone = b.phone as string;
      changes.push(`Retro: telefono impostato`);
    }
    if (b.email !== undefined && b.email !== updated.back.email) {
      updated.back.email = b.email as string;
      changes.push(`Retro: email impostata`);
    }
    if (b.website !== undefined && b.website !== updated.back.website) {
      updated.back.website = b.website as string;
      changes.push(`Retro: sito web → "${b.website}"`);
    }
    if (b.address !== undefined && b.address !== updated.back.address) {
      updated.back.address = b.address as string;
      changes.push(`Retro: indirizzo impostato`);
    }
    if (b.vatNumber !== undefined && b.vatNumber !== updated.back.vatNumber) {
      updated.back.vatNumber = b.vatNumber as string;
      changes.push(`Retro: P.IVA impostata`);
    }
    if (b.socials !== undefined) {
      const newSocials = b.socials as BusinessCard['back']['socials'];
      const oldSocials = updated.back.socials;
      if (JSON.stringify(newSocials) !== JSON.stringify(oldSocials)) {
        updated.back.socials = newSocials;
        changes.push(`Retro: social aggiornati (${newSocials.length} elementi)`);
      }
    }
    if (b.qrPayload !== undefined && b.qrPayload !== updated.back.qrPayload) {
      updated.back.qrPayload = b.qrPayload as string;
      changes.push(`Retro: payload QR aggiornato`);
    }
    if (b.qrLabel !== undefined && b.qrLabel !== updated.back.qrLabel) {
      updated.back.qrLabel = b.qrLabel as string;
      changes.push(`Retro: etichetta QR aggiornata`);
    }
  }

  // ─── STYLE ──────────────────────────────────────────────
  if (modified.style && typeof modified.style === 'object') {
    const s = modified.style as Record<string, unknown>;
    updated.style = { ...updated.style };

    if (s.sizePreset !== undefined && s.sizePreset !== updated.style.sizePreset) {
      updated.style.sizePreset = s.sizePreset as BusinessCard['style']['sizePreset'];
      changes.push(`Stile: formato → "${s.sizePreset}"`);
    }
    if (s.bgColor !== undefined && s.bgColor !== updated.style.bgColor) {
      updated.style.bgColor = s.bgColor as string;
      changes.push(`Stile: colore sfondo → ${s.bgColor}`);
    }
    if (s.textColor !== undefined && s.textColor !== updated.style.textColor) {
      updated.style.textColor = s.textColor as string;
      changes.push(`Stile: colore testo → ${s.textColor}`);
    }
    if (s.accentColor !== undefined && s.accentColor !== updated.style.accentColor) {
      updated.style.accentColor = s.accentColor as string;
      changes.push(`Stile: colore accento → ${s.accentColor}`);
    }
    if (s.fontFamily !== undefined && s.fontFamily !== updated.style.fontFamily) {
      updated.style.fontFamily = s.fontFamily as string;
      changes.push(`Stile: font → "${s.fontFamily}"`);
    }
    if (s.borderStyle !== undefined && s.borderStyle !== updated.style.borderStyle) {
      updated.style.borderStyle = s.borderStyle as BusinessCard['style']['borderStyle'];
      changes.push(`Stile: bordo → "${s.borderStyle}"`);
    }
  }

  // ─── GRID ───────────────────────────────────────────────
  if (modified.grid && typeof modified.grid === 'object') {
    const g = modified.grid as Record<string, unknown>;
    const elements = g.elements as Record<string, unknown> | undefined;
    if (elements && typeof elements === 'object') {
      const currentGrid = updated.grid ?? {
        cols: 4,
        rows: 4,
        elements: {},
      };
      const newGrid = {
        ...currentGrid,
        cols: (g.cols as number) ?? currentGrid.cols,
        rows: (g.rows as number) ?? currentGrid.rows,
        elements: { ...currentGrid.elements },
      };
      for (const key of Object.keys(elements)) {
        const el = elements[key] as { x: number; y: number; w: number; h: number };
        if (el && typeof el === 'object') {
          newGrid.elements = { ...newGrid.elements, [key]: el };
          changes.push(`Griglia: ${key} spostato a (${el.x}, ${el.y}) ${el.w}×${el.h}`);
        }
      }
      updated.grid = newGrid;
    }
  }

  if (changes.length > 0) {
    updated.updatedAt = new Date().toISOString();
  }

  return { card: updated, changes };
}
