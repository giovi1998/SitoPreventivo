import type { BusinessCard, CardGrid } from '../documentSchemas';

export type GridElementKey =
  | 'photo'
  | 'name'
  | 'title'
  | 'company'
  | 'logo'
  | 'qr'
  | 'contacts'
  | 'socials'
  | 'services';

export type GridSide = 'front' | 'back';

export interface GridElementOption {
  value: GridElementKey;
  label: string;
}

export const FRONT_ELEMENT_KEYS: readonly GridElementKey[] = [
  'photo',
  'name',
  'title',
  'company',
  'logo',
];

export const BACK_ELEMENT_KEYS: readonly GridElementKey[] = [
  'contacts',
  'qr',
  'socials',
  'services',
];

export function elementKeysForSide(side: GridSide): readonly GridElementKey[] {
  return side === 'front' ? FRONT_ELEMENT_KEYS : BACK_ELEMENT_KEYS;
}

export function hasElementContent(
  key: GridElementKey,
  card: BusinessCard,
  side: GridSide,
): boolean {
  const front = card.front ?? {};
  if (side === 'front') {
    if (key === 'photo') return !!front.photoUrl;
    if (key === 'logo') return !!front.logoUrl;
    if (key === 'name') return (front.name ?? '').trim().length > 0;
    if (key === 'title') return (front.title ?? '').trim().length > 0;
    if (key === 'company') return (front.company ?? '').trim().length > 0;
    return false;
  }
  // back
  const back = card.back ?? {};
  if (key === 'contacts') {
    return !!(
      (back.phone ?? '').trim() ||
      (back.email ?? '').trim() ||
      (back.website ?? '').trim() ||
      (back.address ?? '').trim() ||
      (back.vatNumber ?? '').trim()
    );
  }
  if (key === 'qr') {
    return !!((back.qrPayload ?? '').trim() || (back.website ?? '').trim());
  }
  if (key === 'socials') {
    return (back.socials ?? []).some((s) => s.platform && s.url);
  }
  if (key === 'services') {
    return (back.services ?? []).some((s) => (s ?? '').trim().length > 0);
  }
  return false;
}

const LABELS: Record<GridElementKey, string> = {
  photo: 'Foto',
  name: 'Nome',
  title: 'Ruolo',
  company: 'Azienda',
  logo: 'Logo',
  contacts: 'Contatti',
  qr: 'QR',
  socials: 'Social',
  services: 'Servizi',
};

export function allElementOptionsForSide(side: GridSide): GridElementOption[] {
  return elementKeysForSide(side).map((key) => ({ value: key, label: LABELS[key] }));
}

export function getAvailableGridElements(
  side: GridSide,
  card: BusinessCard,
): GridElementOption[] {
  return elementKeysForSide(side)
    .filter((key) => hasElementContent(key, card, side))
    .map((key) => ({ value: key, label: LABELS[key] }));
}

export function hasGridElements(side: GridSide, card: BusinessCard): boolean {
  const grid = side === 'back' ? card.backGrid : card.grid;
  if (!grid) return false;
  for (const [key, rect] of Object.entries(grid.elements)) {
    if (rect && hasElementContent(key as GridElementKey, card, side)) return true;
  }
  return false;
}

/**
 * Grid usata per collisioni/move/resize: ignora celle senza contenuto
 * (es. `services` vuoto non deve bloccare lo spostamento di `socials`).
 * L'elemento selezionato resta sempre, così i check self non si rompono.
 */
export function gridForCollisions(
  grid: CardGrid,
  card: BusinessCard,
  side: GridSide,
  keepKey?: string,
): CardGrid {
  const elements: CardGrid['elements'] = {};
  for (const [key, rect] of Object.entries(grid.elements ?? {})) {
    if (!rect || typeof rect.w !== 'number') continue;
    if (key === keepKey || hasElementContent(key as GridElementKey, card, side)) {
      (elements as Record<string, typeof rect>)[key] = rect;
    }
  }
  return { cols: grid.cols, rows: grid.rows, elements };
}

/**
 * Rimuove dalla griglia gli elementi senza contenuto reale (es. `services`
 * con lista vuota, `socials` senza voci valide). Usata prima di salvare o
 * esportare (JSON/Collection) così i documenti persistiti non trascinano
 * posizioni "fantasma" mai mostrate in preview né in export SVG/PDF/PNG.
 * Non viene chiamata durante l'editing interattivo (patchGrid) per non
 * far scomparire una cella appena posizionata mentre l'utente sta ancora
 * digitando il contenuto corrispondente.
 */
export function pruneEmptyGridElements(
  grid: CardGrid | undefined,
  card: BusinessCard,
  side: GridSide,
): CardGrid | undefined {
  if (!grid) return grid;
  const elements: CardGrid['elements'] = {};
  for (const [key, rect] of Object.entries(grid.elements ?? {})) {
    if (rect && hasElementContent(key as GridElementKey, card, side)) {
      (elements as Record<string, typeof rect>)[key] = rect;
    }
  }
  return { cols: grid.cols, rows: grid.rows, elements };
}

/** Applica `pruneEmptyGridElements` a entrambi i lati (fronte + retro). */
export function pruneCardGrids(card: BusinessCard): BusinessCard {
  return {
    ...card,
    grid: pruneEmptyGridElements(card.grid, card, 'front'),
    backGrid: pruneEmptyGridElements(card.backGrid, card, 'back'),
  };
}
